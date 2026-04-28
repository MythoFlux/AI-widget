    import { Editor, Node, mergeAttributes } from "https://esm.sh/@tiptap/core@2.11.5";
    import StarterKit from "https://esm.sh/@tiptap/starter-kit@2.11.5";
    import Placeholder from "https://esm.sh/@tiptap/extension-placeholder@2.11.5";
    import { createMathEditorModule } from "./math-editor.js";

    const STORAGE_KEY = "ai-chat-history";
    const MAX_MESSAGES_FOR_BACKEND = 20;

    const messagesEl = document.getElementById("messages");
    const promptEditorEl = document.getElementById("prompt-editor");
    const sendButton = document.getElementById("send");
    const addFormulaButton = document.getElementById("add-formula");
    const clearHistoryButton = document.getElementById("clear-history");
    const screenshotInput = document.getElementById("screenshot");
    const clearScreenshotButton = document.getElementById("clear-screenshot");
    const attachmentPreviewEl = document.getElementById("attachment-preview");
    const attachmentImageEl = document.getElementById("attachment-image");
    const statusEl = document.getElementById("status");
    const mathEditorModalEl = document.getElementById("math-editor-modal");
    const mathSymbolSearchEl = document.getElementById("math-symbol-search");
    const mathSymbolCategoriesEl = document.getElementById("math-symbol-categories");
    const mathLatexOutputEl = document.getElementById("math-latex-output");
    const mathPreviewRenderEl = document.getElementById("math-preview-render");
    const insertFormulaButton = document.getElementById("insert-formula");
    const cancelFormulaButton = document.getElementById("cancel-formula");
    const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;

    const defaultInitialMessage = {
      role: "assistant",
      content: "Hei! Lähetä viesti, niin vastaan palvelinpuolen API-kutsun kautta.",
      includeInModelContext: false
    };

    let conversationHistory = [];
    let pendingScreenshotDataUrl = "";
    let pendingScreenshotName = "";

    const mathEditorModule = createMathEditorModule({
      Node,
      mergeAttributes,
      elements: {
        mathEditorModalEl,
        mathSymbolSearchEl,
        mathSymbolCategoriesEl,
        mathLatexOutputEl,
        mathPreviewRenderEl,
        insertFormulaButton,
        cancelFormulaButton
      },
      setStatus
    });

    function getImageFileFromClipboardEvent(event) {
      const clipboardItems = event?.clipboardData?.items;
      if (!clipboardItems || clipboardItems.length === 0) return null;

      const imageItem = Array.from(clipboardItems).find((item) => item.type.startsWith("image/"));
      if (!imageItem) return null;

      return imageItem.getAsFile();
    }

    function handleImagePaste(event) {
      const imageFile = getImageFileFromClipboardEvent(event);
      if (!imageFile) return false;

      event.preventDefault();
      processScreenshotFile(imageFile);
      return true;
    }

    const editor = new Editor({
      element: promptEditorEl,
      extensions: [
        StarterKit.configure({
          heading: false,
          bulletList: false,
          orderedList: false,
          codeBlock: false,
          blockquote: false,
          horizontalRule: false
        }),
        Placeholder.configure({
          placeholder: "Kirjoita viesti tähän… Lisää kaava painikkeella (rivinsisäinen tai omalla rivillään)."
        }),
        mathEditorModule.InlineMath,
        mathEditorModule.BlockMath
      ],
      content: "<p></p>",
      editorProps: {
        handlePaste(view, event) {
          if (handleImagePaste(event)) {
            return true;
          }
          return false;
        }
      }
    });

    mathEditorModule.attachEditor(editor);

    function isValidHistoryItem(item) {
      return item &&
        (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string" &&
        item.content.trim().length > 0;
    }

    function renderHistory() {
      const nextChildren = conversationHistory.map(createMessageElement);
      messagesEl.replaceChildren(...nextChildren);

      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function createMessageElement(message) {
      const article = document.createElement("article");
      article.className = `message ${message.role}`;

      const label = document.createElement("span");
      label.className = "label";
      label.textContent = message.role === "user" ? "Sinä" : "AI";

      const content = document.createElement("div");
      content.className = "message-content";
      renderMessageContent(content, message.content);

      article.appendChild(label);
      article.appendChild(content);
      return article;
    }

    function tokenizeLatex(text) {
      // Etsitään sekä $$display$$ että $inline$ -kaavat.
      const tokens = [];
      const mathPattern = /\$\$([\s\S]+?)\$\$|\$([^\n$]+?)\$/g;
      let lastIndex = 0;
      let match;

      while ((match = mathPattern.exec(text)) !== null) {
        const matchedText = match[0];
        const start = match.index;
        const end = start + matchedText.length;

        if (start > lastIndex) {
          tokens.push({ type: "text", value: text.slice(lastIndex, start) });
        }

        const latex = match[1] ?? match[2] ?? "";
        const displayMode = typeof match[1] === "string";
        tokens.push({ type: "math", value: latex, displayMode });
        lastIndex = end;
      }

      if (lastIndex < text.length) {
        tokens.push({ type: "text", value: text.slice(lastIndex) });
      }

      return tokens;
    }

    function renderMessageContent(container, rawText) {
      container.replaceChildren();
      const tokens = tokenizeLatex(rawText);

      for (const token of tokens) {
        if (token.type === "text") {
          container.appendChild(document.createTextNode(
            token.value
          ));
          continue;
        }

        const mathElement = document.createElement(token.displayMode ? "div" : "span");
        mathEditorModule.renderKatexToElement(mathElement, token.value, token.displayMode);
        container.appendChild(mathElement);
      }
    }

    // Serialisointi OpenAI:lle: teksti + inlineMath->$...$ + blockMath->$$...$$.
    function serializeEditorForBackend() {
      const node = editor.state.doc;
      const chunks = [];

      function walk(currentNode) {
        if (currentNode.type.name === "text") {
          chunks.push(currentNode.text || "");
          return;
        }
        if (currentNode.type.name === "hardBreak") {
          chunks.push("\n");
          return;
        }
        if (currentNode.type.name === "inlineMath") {
          chunks.push(`$${currentNode.attrs.latex || ""}$`);
          return;
        }
        if (currentNode.type.name === "blockMath") {
          chunks.push(`\n$$${currentNode.attrs.latex || ""}$$\n`);
          return;
        }

        currentNode.content?.forEach((childNode) => walk(childNode));
        if (currentNode.type.name === "paragraph") {
          chunks.push("\n");
        }
      }

      walk(node);
      return chunks.join("").replace(/\n{3,}/g, "\n\n").trim();
    }

    // Mahdollinen deserialisointi myöhempää editorin palautusta varten.
    function deserializeTextToEditorDoc(text) {
      const docContent = [];
      const blockRegex = /\$\$([\s\S]+?)\$\$/g;
      let last = 0;
      let blockMatch;

      function pushInlineParagraph(segment) {
        if (!segment) return;
        const inlineContent = [];
        const inlineRegex = /\$([^\n$]+?)\$/g;
        let inlineLast = 0;
        let inlineMatch;
        while ((inlineMatch = inlineRegex.exec(segment)) !== null) {
          if (inlineMatch.index > inlineLast) {
            inlineContent.push({ type: "text", text: segment.slice(inlineLast, inlineMatch.index) });
          }
          inlineContent.push({ type: "inlineMath", attrs: { latex: inlineMatch[1] } });
          inlineLast = inlineMatch.index + inlineMatch[0].length;
        }
        if (inlineLast < segment.length) {
          inlineContent.push({ type: "text", text: segment.slice(inlineLast) });
        }
        docContent.push({ type: "paragraph", content: inlineContent.length ? inlineContent : [{ type: "text", text: "" }] });
      }

      while ((blockMatch = blockRegex.exec(text)) !== null) {
        pushInlineParagraph(text.slice(last, blockMatch.index).trim());
        docContent.push({ type: "blockMath", attrs: { latex: blockMatch[1] || "" } });
        last = blockMatch.index + blockMatch[0].length;
      }
      pushInlineParagraph(text.slice(last).trim());

      if (docContent.length === 0) {
        docContent.push({ type: "paragraph" });
      }
      return { type: "doc", content: docContent };
    }

    function saveHistory() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversationHistory));
    }

    function loadHistory() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
          conversationHistory = [defaultInitialMessage];
          return;
        }

        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
          conversationHistory = [defaultInitialMessage];
          return;
        }

        const validMessages = parsed.filter(isValidHistoryItem).map((item) => ({
          role: item.role,
          content: item.content,
          includeInModelContext: item.includeInModelContext !== false
        }));

        conversationHistory = validMessages.length > 0 ? validMessages : [defaultInitialMessage];
      } catch {
        conversationHistory = [defaultInitialMessage];
      }
    }

    function addMessageToHistory(role, content, options = {}) {
      const includeInModelContext = options.includeInModelContext !== false;
      conversationHistory.push({ role, content, includeInModelContext });
      saveHistory();
      renderHistory();
    }

    function buildMessagesForBackend() {
      const messagesForModel = conversationHistory
        .filter((message) => message.includeInModelContext !== false)
        .map((message) => ({ role: message.role, content: message.content }));

      return messagesForModel.slice(-MAX_MESSAGES_FOR_BACKEND);
    }

    function setStatus(text, isError = false) {
      statusEl.textContent = text;
      statusEl.classList.toggle("error", isError);
    }

    function clearPendingScreenshot() {
      pendingScreenshotDataUrl = "";
      pendingScreenshotName = "";
      screenshotInput.value = "";
      attachmentImageEl.removeAttribute("src");
      attachmentPreviewEl.hidden = true;
    }

    function setPendingScreenshot(name, dataUrl) {
      pendingScreenshotName = name;
      pendingScreenshotDataUrl = dataUrl;
      attachmentImageEl.src = dataUrl;
      attachmentPreviewEl.hidden = false;
    }

    function handleScreenshotChange(event) {
      const file = event.target.files?.[0];
      if (!file) {
        clearPendingScreenshot();
        return;
      }

      processScreenshotFile(file);
    }

    function processScreenshotFile(file) {
      if (!file) {
        clearPendingScreenshot();
        return;
      }

      if (!file.type.startsWith("image/")) {
        clearPendingScreenshot();
        setStatus("Vain kuvatiedostot ovat sallittuja.", true);
        return;
      }

      if (file.size > MAX_SCREENSHOT_BYTES) {
        clearPendingScreenshot();
        setStatus("Kuvan maksimikoko on 5 Mt.", true);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = typeof reader.result === "string" ? reader.result : "";
        if (!dataUrl.startsWith("data:image/")) {
          clearPendingScreenshot();
          setStatus("Kuvan lukeminen epäonnistui.", true);
          return;
        }

        setPendingScreenshot(file.name, dataUrl);
        setStatus(`Kuvakaappaus valmis: ${file.name}`);
      };
      reader.onerror = () => {
        clearPendingScreenshot();
        setStatus("Kuvan lukeminen epäonnistui.", true);
      };
      reader.readAsDataURL(file);
    }

    async function sendMessage() {
      const message = serializeEditorForBackend();
      if (!message && !pendingScreenshotDataUrl) return;

      const hasScreenshot = Boolean(pendingScreenshotDataUrl);
      const userVisibleMessage = hasScreenshot
        ? (message ? `${message}\n\n📎 Kuvakaappaus liitetty: ${pendingScreenshotName}` : `📎 Kuvakaappaus liitetty: ${pendingScreenshotName}`)
        : message;

      addMessageToHistory("user", userVisibleMessage);
      editor.commands.clearContent(true);
      sendButton.disabled = true;
      clearHistoryButton.disabled = true;
      screenshotInput.disabled = true;
      clearScreenshotButton.disabled = true;
      setStatus("Ladataan...");

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: buildMessagesForBackend(),
            latestUserImage: pendingScreenshotDataUrl || null
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Tuntematon virhe");
        }

        addMessageToHistory("assistant", data.reply || "(Tyhjä vastaus)");
        setStatus("");
        clearPendingScreenshot();
      } catch (error) {
        setStatus(`Virhe: ${error.message}`, true);
        addMessageToHistory("assistant", `⚠️ Virhe: ${error.message}`);
      } finally {
        sendButton.disabled = false;
        clearHistoryButton.disabled = false;
        screenshotInput.disabled = false;
        clearScreenshotButton.disabled = false;
        editor.commands.focus();
      }
    }

    function clearHistory() {
      const confirmed = window.confirm("Oletko varma, että haluat tyhjentää keskustelun?");
      if (!confirmed) return;

      conversationHistory = [defaultInitialMessage];
      localStorage.removeItem(STORAGE_KEY);
      messagesEl.replaceChildren(createMessageElement(defaultInitialMessage));
      messagesEl.scrollTop = messagesEl.scrollHeight;
      setStatus("Keskustelu tyhjennetty.");
      editor.commands.focus();
    }

    function setupKnownNonAppWarningFilter() {
      window.addEventListener("unhandledrejection", (event) => {
        const reasonText = String(event.reason?.message || event.reason || "");
        const isKnownExtensionWarning = reasonText.includes(
          "A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received"
        );

        if (isKnownExtensionWarning) {
          event.preventDefault();
          console.info(
            "[AI-chat] Sivu ohitti selaimen lisäosan aiheuttaman unhandledrejection-varoituksen."
          );
        }
      });
    }

    setupKnownNonAppWarningFilter();
    sendButton.addEventListener("click", sendMessage);
    addFormulaButton.addEventListener("click", () => mathEditorModule.openMathEditor());
    mathEditorModule.setupEventListeners();
    clearHistoryButton.addEventListener("click", clearHistory);
    screenshotInput.addEventListener("change", handleScreenshotChange);
    clearScreenshotButton.addEventListener("click", () => {
      clearPendingScreenshot();
      setStatus("Kuvakaappaus poistettu.");
    });
    document.addEventListener("paste", handleImagePaste);

    promptEditorEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        sendMessage();
      }
    });

    loadHistory();
    saveHistory();
    renderHistory();
    mathEditorModule.renderMathSymbolPalette();
    editor.commands.focus();
  
