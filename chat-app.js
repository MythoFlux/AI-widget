    import { createMathEditorModule } from "./math-editor.js";

    const STORAGE_KEY = "ai-chat-history";
    const SUMMARY_STORAGE_KEY = "ai-chat-state-summary";
    const MAX_MESSAGES_FOR_BACKEND = 20;

    const messagesEl = document.getElementById("messages");
    const promptEditorEl = document.getElementById("prompt-editor");
    const composerPreviewEl = document.getElementById("composer-preview");
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
    let stateSummary = "";
    let pendingScreenshotDataUrl = "";
    let pendingScreenshotName = "";

    const mathEditorModule = createMathEditorModule({
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

    const editor = {
      getText() {
        return promptEditorEl.value || "";
      },
      clearContent() {
        promptEditorEl.value = "";
        updateComposerPreview();
      },
      focus() {
        promptEditorEl.focus();
      },
      insertMathAtCursor(latex, mode = "inline") {
        const token = mode === "display" ? `$$${latex}$$` : `$${latex}$`;
        const start = promptEditorEl.selectionStart ?? promptEditorEl.value.length;
        const end = promptEditorEl.selectionEnd ?? promptEditorEl.value.length;
        const prefix = promptEditorEl.value.slice(0, start);
        const suffix = promptEditorEl.value.slice(end);
        const padBefore = mode === "display" && prefix && !prefix.endsWith("\n") ? "\n" : "";
        const padAfter = mode === "display" && suffix && !suffix.startsWith("\n") ? "\n" : "";
        promptEditorEl.value = `${prefix}${padBefore}${token}${padAfter}${suffix}`;
        const nextCursor = (prefix + padBefore + token).length;
        promptEditorEl.focus();
        promptEditorEl.setSelectionRange(nextCursor, nextCursor);
        updateComposerPreview();
      }
    };

    promptEditorEl.placeholder = "Kirjoita viesti tähän… Lisää kaava painikkeella (rivinsisäinen tai omalla rivillään).";
    promptEditorEl.addEventListener("paste", handleImagePaste);

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

    function normalizeMathDelimiters(text) {
      if (typeof text !== "string" || text.length === 0) return "";
      return text
        .replace(/\\\[([\s\S]+?)\\\]/g, (_, latex) => `$$${latex.trim()}$$`)
        .replace(/\\\(([\s\S]+?)\\\)/g, (_, latex) => `$${latex.trim()}$`);
    }

    function renderMessageContent(container, rawText) {
      container.replaceChildren();
      const normalizedText = normalizeMathDelimiters(rawText);
      const tokens = tokenizeLatex(normalizedText);

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

    function updateComposerPreview() {
      const text = editor.getText().trim();
      if (!text) {
        composerPreviewEl.textContent = "Kaavojen esikatselu näkyy tässä.";
        return;
      }
      renderMessageContent(composerPreviewEl, text);
    }

    // Serialisointi OpenAI:lle: teksti + inlineMath->$...$ + blockMath->$$...$$.
    function serializeEditorForBackend() {
      return normalizeMathDelimiters(editor.getText()).trim();
    }

    function saveHistory() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversationHistory));
    }

    function saveStateSummary() {
      localStorage.setItem(SUMMARY_STORAGE_KEY, stateSummary);
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

    function loadStateSummary() {
      try {
        const rawSummary = localStorage.getItem(SUMMARY_STORAGE_KEY);
        stateSummary = typeof rawSummary === "string" ? rawSummary : "";
      } catch {
        stateSummary = "";
      }
    }

    function addMessageToHistory(role, content, options = {}) {
      const includeInModelContext = options.includeInModelContext !== false;
      const normalizedContent = normalizeMathDelimiters(content);
      conversationHistory.push({ role, content: normalizedContent, includeInModelContext });
      saveHistory();
      renderHistory();
    }

    function buildMessagesForBackend() {
      const messagesForModel = conversationHistory
        .filter((message) => message.includeInModelContext !== false)
        .map((message) => ({ role: message.role, content: message.content }));

      return messagesForModel.slice(-MAX_MESSAGES_FOR_BACKEND);
    }

    async function updateStateSummary(previousSummary, latestUserMessage, latestAssistantReply) {
      const response = await fetch("/api/state-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          previousSummary,
          latestUserMessage,
          latestAssistantReply
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Tilayhteenvedon päivitys epäonnistui.");
      }

      if (typeof data.updatedSummary !== "string") {
        throw new Error("Tilayhteenvedon vastaus oli virheellinen.");
      }

      stateSummary = data.updatedSummary;
      saveStateSummary();
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
      editor.clearContent();
      sendButton.disabled = true;
      clearHistoryButton.disabled = true;
      screenshotInput.disabled = true;
      clearScreenshotButton.disabled = true;
      setStatus("Ladataan...");

      try {
        const previousSummary = stateSummary;
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: buildMessagesForBackend(),
            latestUserImage: pendingScreenshotDataUrl || null,
            stateSummary
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Tuntematon virhe");
        }

        addMessageToHistory("assistant", data.reply || "(Tyhjä vastaus)");
        setStatus("");
        clearPendingScreenshot();

        try {
          await updateStateSummary(previousSummary, userVisibleMessage, data.reply || "(Tyhjä vastaus)");
        } catch (summaryError) {
          console.error("State summaryn päivitys epäonnistui:", summaryError);
        }
      } catch (error) {
        setStatus(`Virhe: ${error.message}`, true);
        addMessageToHistory("assistant", `⚠️ Virhe: ${error.message}`);
      } finally {
        sendButton.disabled = false;
        clearHistoryButton.disabled = false;
        screenshotInput.disabled = false;
        clearScreenshotButton.disabled = false;
        editor.focus();
      }
    }

    function clearHistory() {
      const confirmed = window.confirm("Oletko varma, että haluat tyhjentää keskustelun?");
      if (!confirmed) return;

      conversationHistory = [defaultInitialMessage];
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(SUMMARY_STORAGE_KEY);
      stateSummary = "";
      messagesEl.replaceChildren(createMessageElement(defaultInitialMessage));
      messagesEl.scrollTop = messagesEl.scrollHeight;
      setStatus("Keskustelu tyhjennetty.");
      editor.focus();
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

    promptEditorEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        sendMessage();
      }
    });
    promptEditorEl.addEventListener("input", updateComposerPreview);

    loadHistory();
    loadStateSummary();
    saveHistory();
    renderHistory();
    mathEditorModule.renderMathSymbolPalette();
    updateComposerPreview();
    editor.focus();
  
