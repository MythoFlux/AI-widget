export function createMathEditorModule({ Node, mergeAttributes, elements, setStatus }) {
  const {
    mathEditorModalEl,
    mathSymbolSearchEl,
    mathSymbolCategoriesEl,
    mathLatexOutputEl,
    mathPreviewRenderEl,
    insertFormulaButton,
    cancelFormulaButton
  } = elements;

  let editor = null;
  let pendingMathEdit = null;

  const mathSymbolGroups = [
    {
      name: "Perus",
      symbols: [
        { label: "plus", latex: "+" }, { label: "miinus", latex: "-" }, { label: "kertopiste", latex: "\\cdot " }, { label: "ristitulo", latex: "\\times " }, 
        { label: "jakomerkki", latex: "\\div " },
        { label: "yhtäsuuruus", latex: "=" }, { label: "erisuuruus", latex: "\\neq " }, { label: "suunnilleen", latex: "\\approx " }, { label: "plusmiinus", latex: "\\pm " }, 
        { label: "miinusplus", latex: "\\mp " }, { label: "jakolasku", latex: ":" },
        { label: "prosentti", latex: "~\\%" }, { label: "promille", latex: "~‰" }, { label: "ääretön", latex: "\\infty " }, 
        { label: "pieni väli", latex: "a\\, b" },
        { label: "keskikokoinen väli", latex: "a~b" }, { label: "desimaalipilkku ilman välilyöntiä", latex: "a{,}b" }
      ]
    },
    {
      name: "Murtoluvut & potenssit",
      symbols: [
        { label: "murtoluku", latex: "\\frac{a}{b}" }, { label: "potenssimerkintä", latex: "x^n" }, { label: "neliöjuuri", latex: "\\sqrt{x}" },
        { label: "yleinen juuri", latex: "\\sqrt[n]{x}" }, { label: "alaindeksi", latex: "x_i" }, { label: "ala- ja yläindeksi", latex: "x_i^j" }, 
        { label: "|x|", latex: "\\left|x\\right|" }, { label: "vasen ala- ja yläindeksi", latex: "~_{a}^{b}X" }
      ]
    },
    
    {
      name: "Sulkeet ja pystyviivat",
      symbols: [
        { label: "skaalautuvat kaarisulkeet", latex: "\\left( x \\right)" }, { label: "skaalautuvat hakasulkeet", latex: "\\left[ x \\right]" },
        { label: "skaalautuvat aaltosulkeet", latex: "\\left{ x \\right}" }, { label: "skaalautuvat kulmasulkeet", latex: "\\left\\langle x \\right\\rangle" },
        { label: "Erotin", latex: "A\\mid B" }, { label: "Pystyviiva", latex: "\\vert" }, 
        { label: "skaalautuva normi", latex: "\\left\\Vert \\mathbf{a} \\right\\Vert" }
      ]
    },
    {
      name: "Operaattorit",
      symbols: [
        { label: "Σ", latex: "\\sum_{i=1}^{n}" }, { label: "Π", latex: "\\prod_{i=1}^{n}" }, { label: "∫", latex: "\\int_{a}^{b}" }, { label: "lim", latex: "\\lim_{x \\to \\infty}" },
        { label: "sin", latex: "\\sin\\left(x\\right)" }, { label: "cos", latex: "\\cos\\left(x\\right)" }, { label: "log", latex: "\\log\\left(x\\right)" }, { label: "ln", latex: "\\ln\\left(x\\right)" }
      ]
    },
    {
      name: "Ympäristöt",
      symbols: [
        { label: "kohdistetut rivit", latex: "\\begin{aligned}\na &= b + c \\\\\nd &= e - f\n\\end{aligned}" },
        { label: "yhtälöpari", latex: "\\begin{cases}\nx + y = 1 \\\\\n2x - y = 3\n\\end{cases}" },
        { label: "matriisi", latex: "\\begin{bmatrix}\na & b \\\\\nc & d\n\\end{bmatrix}" },
        { label: "teksti", latex: "\\text{T}" }
      ]
    },
    {
      name: "Kreikkalaiset",
      symbols: [
        { label: "α", latex: "\\alpha " }, { label: "β", latex: "\\beta " }, { label: "γ", latex: "\\gamma " }, { label: "δ", latex: "\\delta " },
        { label: "ε", latex: "\\epsilon " }, { label: "ζ", latex: "\\zeta " }, { label: "η", latex: "\\eta " }, { label: "θ", latex: "\\theta " },
        { label: "ι", latex: "\\iota " }, { label: "κ", latex: "\\kappa " }, { label: "λ", latex: "\\lambda " }, { label: "μ", latex: "\\mu " },
        { label: "ν", latex: "\\nu " }, { label: "ξ", latex: "\\xi " }, { label: "ο", latex: "ο" }, { label: "π", latex: "\\pi " },
        { label: "ρ", latex: "\\rho " }, { label: "σ", latex: "\\sigma " }, { label: "τ", latex: "\\tau " }, { label: "υ", latex: "\\upsilon " },
        { label: "φ", latex: "\\phi " }, { label: "χ", latex: "\\chi " }, { label: "ψ", latex: "\\psi " }, { label: "ω", latex: "\\omega " },
        { label: "Α", latex: "Α" }, { label: "Β", latex: "Β" }, { label: "Γ", latex: "\\Gamma " }, { label: "Δ", latex: "\\Delta " },
        { label: "Ε", latex: "Ε" }, { label: "Ζ", latex: "Ζ" }, { label: "Η", latex: "Η" }, { label: "Θ", latex: "\\Theta " },
        { label: "Ι", latex: "Ι" }, { label: "Κ", latex: "Κ" }, { label: "Λ", latex: "\\Lambda " }, { label: "Μ", latex: "Μ" },
        { label: "Ν", latex: "Ν" }, { label: "Ξ", latex: "\\Xi " }, { label: "Ο", latex: "Ο" }, { label: "Π", latex: "\\Pi " },
        { label: "Ρ", latex: "Ρ" }, { label: "Σ", latex: "\\Sigma " }, { label: "Τ", latex: "Τ" }, { label: "Υ", latex: "\\Upsilon " },
        { label: "Φ", latex: "\\Phi " }, { label: "Χ", latex: "Χ" }, { label: "Ψ", latex: "\\Psi " }, { label: "Ω", latex: "\\Omega " }
      ]
    }
  ];

  function renderKatexToElement(element, latex, displayMode, fallbackText = null) {
    if (!element) return false;
    const fallback = fallbackText ?? `${displayMode ? "$$" : "$"}${latex}${displayMode ? "$$" : "$"}`;
    if (typeof window.katex === "undefined") {
      element.textContent = fallback;
      return false;
    }
    try {
      window.katex.render(latex, element, {
        displayMode,
        throwOnError: false
      });
      return true;
    } catch {
      element.textContent = fallback;
      element.classList.add("math-error");
      return false;
    }
  }

  function getCurrentMathMode() {
    return document.querySelector('input[name="math-mode"]:checked')?.value || "inline";
  }

  function updateMathPreview(latex = "") {
    mathPreviewRenderEl.classList.remove("math-error");
    renderKatexToElement(mathPreviewRenderEl, latex, getCurrentMathMode() === "display");
  }

  function syncMathPreviewFromLatex() {
    updateMathPreview(mathLatexOutputEl.value.trim());
  }

  function insertLatexIntoEditor(snippet) {
    const textarea = mathLatexOutputEl;
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    textarea.value = `${textarea.value.slice(0, start)}${snippet}${textarea.value.slice(end)}`;
    const nextCursor = start + snippet.length;
    textarea.focus();
    textarea.setSelectionRange(nextCursor, nextCursor);
    syncMathPreviewFromLatex();
  }

  function renderMathSymbolPalette() {
    const query = mathSymbolSearchEl.value.trim().toLowerCase();
    const groups = mathSymbolGroups
      .map((group) => ({
        ...group,
        symbols: group.symbols.filter((symbol) => {
          if (!query) return true;
          return symbol.label.toLowerCase().includes(query) || symbol.latex.toLowerCase().includes(query);
        })
      }))
      .filter((group) => group.symbols.length > 0);

    mathSymbolCategoriesEl.replaceChildren();
    for (const group of groups) {
      const section = document.createElement("section");
      section.className = "symbol-group";

      const heading = document.createElement("h4");
      heading.textContent = group.name;
      section.appendChild(heading);

      const grid = document.createElement("div");
      grid.className = "symbol-grid";

      for (const symbol of group.symbols) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "symbol-button";
        const buttonLabel = symbol.label || symbol.latex;
        button.setAttribute("aria-label", buttonLabel);
        renderKatexToElement(button, symbol.latex, false, symbol.label);
        button.title = buttonLabel;
        button.querySelectorAll("[title]").forEach((el) => el.removeAttribute("title"));
        button.addEventListener("click", () => insertLatexIntoEditor(symbol.latex));
        grid.appendChild(button);
      }

      section.appendChild(grid);
      mathSymbolCategoriesEl.appendChild(section);
    }
  }

  function openMathEditor(mode = "inline", latex = "", pos = null, nodeType = null) {
    pendingMathEdit = pos !== null && Number.isFinite(pos) ? { pos, nodeType } : null;
    mathEditorModalEl.hidden = false;
    mathLatexOutputEl.value = latex;
    const selectedMode = mode === "display" ? "display" : "inline";
    const radioToSelect = document.querySelector(`input[name="math-mode"][value="${selectedMode}"]`);
    if (radioToSelect) radioToSelect.checked = true;
    renderMathSymbolPalette();
    updateMathPreview(latex);
    setStatus('Lisää kaava ja paina "Lisää tekstiin".');
    setTimeout(() => mathLatexOutputEl.focus(), 0);
  }

  function closeMathEditor() {
    mathEditorModalEl.hidden = true;
    pendingMathEdit = null;
    editor?.commands.focus();
  }

  function insertFormulaToPrompt() {
    if (!editor) return;

    const latex = mathLatexOutputEl.value.trim();
    if (!latex) {
      setStatus("Kirjoita ensin kaava editoriin.", true);
      return;
    }

    const mode = document.querySelector('input[name="math-mode"]:checked')?.value || "inline";
    const nodeName = mode === "display" ? "blockMath" : "inlineMath";
    const nodeAttrs = { latex };

    if (pendingMathEdit) {
      try {
        editor.commands.command(({ tr, state, dispatch }) => {
          const targetNode = state.doc.nodeAt(pendingMathEdit.pos);
          if (!targetNode) return false;
          const safeNodeName = targetNode.type.name === "inlineMath" || targetNode.type.name === "blockMath"
            ? targetNode.type.name
            : nodeName;
          const targetType = state.schema.nodes[safeNodeName];
          if (!targetType) return false;
          tr.setNodeMarkup(pendingMathEdit.pos, targetType, nodeAttrs);
          if (dispatch) dispatch(tr);
          return true;
        });
      } catch {
        editor.chain().focus().insertContent(mode === "display"
          ? [{ type: "blockMath", attrs: nodeAttrs }, { type: "paragraph" }]
          : { type: "inlineMath", attrs: nodeAttrs }).run();
      }
    } else {
      const insertionPayload = mode === "display"
        ? [{ type: "blockMath", attrs: nodeAttrs }, { type: "paragraph" }]
        : { type: "inlineMath", attrs: nodeAttrs };
      editor.chain().focus().insertContent(insertionPayload).run();
    }

    closeMathEditor();
    setStatus("Kaava lisätty viestiin.");
  }

  function createMathNode({ name, inline, group, cssClass, displayMode }) {
    return Node.create({
      name,
      group,
      inline,
      atom: true,
      selectable: true,
      draggable: false,
      addAttributes() {
        return {
          latex: {
            default: ""
          }
        };
      },
      parseHTML() {
        return [{ tag: `${inline ? "span" : "div"}[data-type="${name}"]` }];
      },
      renderHTML({ HTMLAttributes }) {
        return [inline ? "span" : "div", mergeAttributes(HTMLAttributes, {
          "data-type": name,
          "data-latex": HTMLAttributes.latex || ""
        })];
      },
      addNodeView() {
        return ({ node, getPos }) => {
          const dom = document.createElement(inline ? "span" : "div");
          dom.className = `math-node ${cssClass}`;
          dom.dataset.type = name;

          const updateMathNodeDom = (latexValue) => {
            dom.classList.remove("math-error");
            dom.dataset.latex = latexValue;
            renderKatexToElement(dom, latexValue, displayMode);
            dom.title = "Klikkaa muokataksesi kaavaa";
          };

          updateMathNodeDom(node.attrs.latex || "");

          dom.addEventListener("click", () => {
            const pos = typeof getPos === "function" ? getPos() : null;
            openMathEditor(displayMode ? "display" : "inline", node.attrs.latex || "", pos, name);
          });

          return {
            dom,
            update(updatedNode) {
              if (updatedNode.type.name !== name) return false;
              updateMathNodeDom(updatedNode.attrs.latex || "");
              return true;
            }
          };
        };
      }
    });
  }

  const InlineMath = createMathNode({
    name: "inlineMath",
    inline: true,
    group: "inline",
    cssClass: "math-inline",
    displayMode: false
  });

  const BlockMath = createMathNode({
    name: "blockMath",
    inline: false,
    group: "block",
    cssClass: "math-block",
    displayMode: true
  });

  function attachEditor(nextEditor) {
    editor = nextEditor;
  }

  function setupEventListeners() {
    insertFormulaButton.addEventListener("click", insertFormulaToPrompt);
    cancelFormulaButton.addEventListener("click", closeMathEditor);
    mathLatexOutputEl.addEventListener("input", syncMathPreviewFromLatex);
    mathSymbolSearchEl.addEventListener("input", renderMathSymbolPalette);
    document.querySelectorAll('input[name="math-mode"]').forEach((radio) => {
      radio.addEventListener("change", () => updateMathPreview(mathLatexOutputEl.value.trim()));
    });
    mathEditorModalEl.addEventListener("click", (event) => {
      if (event.target === mathEditorModalEl) closeMathEditor();
    });
  }

  return {
    InlineMath,
    BlockMath,
    openMathEditor,
    renderKatexToElement,
    setupEventListeners,
    attachEditor,
    renderMathSymbolPalette
  };
}
