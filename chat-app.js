import { createMathEditorModule } from "./math-editor.js";
import { normalizeMathDelimiters, tokenizeLatex, serializeMathNodeLatex, serializeNodeToLatex, serializeEditorDocForBackend } from "./editor-serialization.js";
import { Schema } from "https://esm.sh/prosemirror-model@1.23.0";
import { EditorState, TextSelection } from "https://esm.sh/prosemirror-state@1.4.3";
import { EditorView } from "https://esm.sh/prosemirror-view@1.33.10";
import { keymap } from "https://esm.sh/prosemirror-keymap@1.2.2";
import { baseKeymap } from "https://esm.sh/prosemirror-commands@1.7.0";
import { history } from "https://esm.sh/prosemirror-history@1.4.1";

    const STORAGE_KEY = "ai-chat-history";
    const SUMMARY_STORAGE_KEY = "ai-chat-state-summary";
    const MAX_MESSAGES_FOR_BACKEND = 20;

    const messagesEl = document.getElementById("messages");
    const promptEditorEl = document.getElementById("prompt-editor-textarea");
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

    const editorSchema = new Schema({
      nodes: {
        doc: { content: "block+" },
        paragraph: { content: "inline*", group: "block", toDOM: () => ["p", 0] },
        text: { group: "inline" },
        inline_math: {
          group: "inline",
          inline: true,
          atom: true,
          attrs: { latex: { default: "" }, template: { default: null }, slots: { default: [] } },
          toDOM: (node) => ["span", { class: "math-node math-inline", "data-latex": node.attrs.latex }, node.attrs.latex]
        },
        block_math: {
          group: "block",
          atom: true,
          attrs: { latex: { default: "" }, template: { default: null }, slots: { default: [] } },
          toDOM: (node) => ["div", { class: "math-node math-block", "data-latex": node.attrs.latex }, node.attrs.latex]
        }
      }
    });

    function buildInitialDoc() {
      return editorSchema.node("doc", null, [editorSchema.node("paragraph")]);
    }

    const pmPlugins = [history(), keymap(baseKeymap)];

    function parseMathTemplate(latex) {
      if (latex === "\\frac{□}{□}") {
        return { template: "frac", slots: ["", ""], latex: "" };
      }
      return { template: null, slots: [], latex };
    }

    function createMathNodeView(displayMode) {
      return (node, view, getPos) => {
        const dom = document.createElement(displayMode ? "div" : "span");
        dom.className = `math-node ${displayMode ? "math-block" : "math-inline"}`;
        if (node.attrs.template !== "frac") {
          mathEditorModule.renderKatexToElement(dom, serializeMathNodeLatex(node), displayMode);
          return { dom };
        }

        dom.classList.add("math-template-node");
        const visual = document.createElement(displayMode ? "div" : "span");
        visual.className = "math-template-visual";
        const slotsWrap = document.createElement("span");
        slotsWrap.className = "math-template-slots";
        const slotEls = [0, 1].map((slotIndex) => {
          const slotEl = document.createElement("span");
          slotEl.className = "math-slot";
          slotEl.contentEditable = "true";
          slotEl.tabIndex = 0;
          slotEl.setAttribute("role", "textbox");
          slotEl.setAttribute("aria-label", slotIndex === 0 ? "Murtoluvun osoittaja" : "Murtoluvun nimittäjä");
          slotEl.dataset.slotIndex = String(slotIndex);
          slotEl.textContent = (node.attrs.slots || ["", ""])[slotIndex] || "";
          slotEl.addEventListener("focus", () => {
            const pos = typeof getPos === "function" ? getPos() : null;
            if (typeof pos === "number") {
              view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(pos + 1))));
            }
          });
          slotEl.addEventListener("input", () => {
            const nextSlots = [...(node.attrs.slots || ["", ""])];
            nextSlots[slotIndex] = slotEl.textContent || "";
            const pos = typeof getPos === "function" ? getPos() : null;
            if (typeof pos !== "number") return;
            const nextLatex = `\\frac{${nextSlots[0] || ""}}{${nextSlots[1] || ""}}`;
            view.dispatch(view.state.tr.setNodeMarkup(pos, null, { ...node.attrs, slots: nextSlots, latex: nextLatex }));
          });
          slotEl.addEventListener("keydown", (event) => {
            if (event.key === "Backspace" || event.key === "Delete") {
              event.stopPropagation();
            }
            if (event.key === "Tab" && event.shiftKey) {
              event.preventDefault();
              slotEls[Math.max(slotIndex - 1, 0)].focus();
              return;
            }
            if (event.key === "Tab" || event.key === "ArrowRight" || event.key === "ArrowDown") {
              event.preventDefault();
              slotEls[Math.min(slotIndex + 1, slotEls.length - 1)].focus();
            }
            if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
              event.preventDefault();
              slotEls[Math.max(slotIndex - 1, 0)].focus();
            }
            if ((event.key === "Backspace" || event.key === "Delete") && !(slotEl.textContent || "").length && slotIndex > 0) {
              event.preventDefault();
              slotEls[slotIndex - 1].focus();
            }
          });
          return slotEl;
        });

        const templateLatex = `\\frac{${(node.attrs.slots || ["", ""])[0] || "\\square"}}{${(node.attrs.slots || ["", ""])[1] || "\\square"}}`;
        mathEditorModule.renderKatexToElement(visual, templateLatex, displayMode);
        slotsWrap.append(slotEls[0], slotEls[1]);
        dom.replaceChildren(visual, slotsWrap);
        return { dom };
      };
    }

    const pmView = new EditorView(promptEditorEl, {
      state: EditorState.create({ doc: buildInitialDoc(), plugins: pmPlugins }),
      nodeViews: {
        inline_math: createMathNodeView(false),
        block_math: createMathNodeView(true)
      },
      dispatchTransaction(transaction) {
        const nextState = pmView.state.apply(transaction);
        pmView.updateState(nextState);
        updateComposerPreview();
      }
    });

    const editor = {
      getText() {
        return serializeNodeToLatex(pmView.state.doc);
      },
      clearContent() {
        pmView.updateState(EditorState.create({ doc: buildInitialDoc(), plugins: pmPlugins }));
        updateComposerPreview();
      },
      focus() {
        pmView.focus();
      },
      insertMathAtCursor(latex, mode = "inline") {
        const parsed = parseMathTemplate(latex);
        const mathNode = editorSchema.node(mode === "display" ? "block_math" : "inline_math", parsed);
        const { from, to } = pmView.state.selection;
        let tr = pmView.state.tr.replaceRangeWith(from, to, mathNode);
        tr = tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(from + 1, tr.doc.content.size))));
        pmView.dispatch(tr.scrollIntoView());
      }
    };

    promptEditorEl.setAttribute("data-placeholder", "Kirjoita viesti tähän… Lisää kaava painikkeella (rivinsisäinen tai omalla rivillään).");
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
      // Koosteen esikatselu poistettu käyttöliittymästä.
    }

    // Serialisointi OpenAI:lle: teksti + inlineMath->$...$ + blockMath->$$...$$.
    function serializeEditorForBackend() {
      return serializeEditorDocForBackend(pmView.state.doc);
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
      const normalizedContent = normalizeMathDelimiters(String(content || "")).trim();
      if (!normalizedContent) return;
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
    addFormulaButton.addEventListener("click", () => {
      const isMobile = window.matchMedia("(max-width: 640px)").matches;
      if (isMobile && mathEditorModalEl.classList.contains("is-open")) {
        mathEditorModule.closeMathEditor();
        addFormulaButton.setAttribute("aria-expanded", "false");
        return;
      }
      mathEditorModule.openMathEditor();
      addFormulaButton.setAttribute("aria-expanded", "true");
    });
    mathEditorModule.setupEventListeners();
    clearHistoryButton.addEventListener("click", clearHistory);
    screenshotInput.addEventListener("change", handleScreenshotChange);
    clearScreenshotButton.addEventListener("click", () => {
      clearPendingScreenshot();
      setStatus("Kuvakaappaus poistettu.");
    });

    function closeActiveMathTool() {
      const activeSlot = document.activeElement?.closest?.(".math-slot");
      if (activeSlot) {
        activeSlot.blur();
        editor.focus();
        return true;
      }

      if (mathEditorModalEl.classList.contains("is-open")) {
        mathEditorModule.closeMathEditor();
        addFormulaButton.setAttribute("aria-expanded", "false");
        return true;
      }
      return false;
    }

    pmView.dom.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        sendMessage();
        return;
      }

      if (event.key === "Enter" && !event.shiftKey && !event.altKey && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        sendMessage();
        return;
      }

      if (event.key === "Escape" && closeActiveMathTool()) {
        event.preventDefault();
      }
    });

    mathEditorModalEl.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        mathEditorModule.closeMathEditor();
        addFormulaButton.setAttribute("aria-expanded", "false");
      }
    });

    loadHistory();
    loadStateSummary();
    saveHistory();
    renderHistory();
    mathEditorModule.renderMathSymbolPalette();
    if (!window.matchMedia("(max-width: 640px)").matches) {
      mathEditorModule.openMathEditor();
      addFormulaButton.setAttribute("aria-expanded", "true");
    }
    updateComposerPreview();
    editor.focus();
