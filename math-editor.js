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
        { label: "vektoriviiva", latex: "\\overline{a} " }, { label: "aste", latex: "°" }, { label: "luonnollinen eksponenttifunktio", latex: "\\mathrm{e}^x" },
        { label: "pieni väli", latex: "a\\, b" },
        { label: "välilyönti", latex: "a~b" }, { label: "desimaalipilkku ilman välilyöntiä", latex: "a{,}b" },
        { label: "kolme pistettä", latex: "\\ldots" }
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
        { label: "skaalautuvat kaarisulkeet", latex: "\\left( ~\\right)" }, { label: "skaalautuvat hakasulkeet", latex: "\\left[ ~ \\right]" }, 
        { label: "skaalautuvat aaltosulkeet", latex: "\\left\\{ ~ \\right\\}" }, 
        { label: "skaalautuvat hakasulkeet (välin ilmaisemiseen)", latex: "\\left[ a,b \\right[" },
        { label: "skaalautuvat hakasulkeet (välin ilmaisemiseen)", latex: "\\left] a,b \\right]" },
        { label: "skaalautuvat hakasulkeet (välin ilmaisemiseen)", latex: "\\left] a,b \\right[" },
        { label: "skaalautuvat kulmasulkeet", latex: "\\left\\langle ~ \\right\\rangle" },
        { label: "erotin", latex: "A\\mid B" }, { label: "pystyviiva", latex: "\\vert" }, 
        { label: "skaalautuva normi", latex: "\\left\\Vert \\mathbf{a} \\right\\Vert" }, { label: "binomikerroin", latex: "\\binom{n}{k}" }
      ]
    },
    {
      name: "Relaatiot",
      symbols: [
        { label: "suurempi tai yhtä suuri", latex: "\\geq" }, { label: "pienempi tai yhtä suuri", latex: "\\leq" },
        { label: "pienempi kuin", latex: "<" }, { label: "suurempi kuin", latex: ">" }, { label: "Paljon pienempi kuin", latex: "\\ll" }, 
        { label: "paljon suurempi kuin", latex: "\\gg" }, { label: "identtisyys", latex: "\\equiv" }, { label: "Epäidenttisyys", latex: "\\not\\equiv" },
        { label: "verrannollisuus", latex: "\\propto" }, { label: "yhtenevyys", latex: "\\cong" }, { label: "epäyhtenevyys", latex: "\\not\\cong" },
        { label: "tilde", latex: "\\sim" }, { label: "yhdistetty funktio", latex: "\\circ" }
      ]
    },
    {
      name: "Joukot, nuolet ja kulmat",
      symbols: [
        { label: "kuuluu joukkoon", latex: "\\in" }, { label: "ei kuulu joukkoon", latex: "\\notin" },
        { label: "osajoukko", latex: "\\subset" }, { label: "ei osajoukko", latex: "\\not\\subset" }, { label: "yhdiste", latex: "\\cup" }, 
        { label: "leikkaus", latex: "\\cap" }, { label: "joukkojen erotus", latex: "\\setminus" },
        { label: "tai", latex: "\\vee" }, { label: "ja", latex: "\\wedge" }, { label: "negaatio", latex: "\\neg" },
        { label: "olemassaolo", latex: "\\exists" }, { label: "kaikille", latex: "\\forall" },
        { label: "tyhjä joukko", latex: "\\varnothing" }, { label: "luonnolliset luvut", latex: "\\mathbb{N}" },
        { label: "kokonaisluvut", latex: "\\mathbb{Z}" }, { label: "rationaaliluvut", latex: "\\mathbb{Q}" },
        { label: "reaaliluvut", latex: "\\mathbb{R}" }, { label: "kompleksiluvut", latex: "\\mathbb{C}" },
        { label: "implikaatio", latex: "\\Rightarrow" }, { label: "ekvivalenssi", latex: "\\Leftrightarrow" },
        { label: "nuoli oikealle", latex: "\\rightarrow" }, { label: "nuoli vasemmalle", latex: "\\leftarrow" }, { label: "nuoli ylös", latex: "\\uparrow" },
        { label: "nuoli alas", latex: "\\downarrow" }, { label: "nuoli yläviistoon", latex: "\\nearrow" }, { label: "nuoli alaviistoon", latex: "\\searrow" },
        { label: "kaksipäinen nuoli", latex: "\\leftrightarrow" }, { label: "tasapainonuoli", latex: "\\xrightleftharpoons[a]{b}" },
        { label: "vastakkaissuuntaisuus", latex: "\\rightleftarrows" }, { label: "yhdensuuntaisuus", latex: "\\parallel" },
        { label: "avaruuskulma", latex: "\\sphericalangle" }, { label: "kulma", latex: "\\angle" }, { label: "kohtisuoruus", latex: "\\perp" }
      ]
    },
    {
      name: "Operaattorit",
      symbols: [
        { label: "summa", latex: "\\sum_{i=1}^{n}" }, { label: "tulo", latex: "\\prod_{i=1}^{n}" }, { label: "integraali", latex: "\\int_{a}^{b}" }, 
        { label: "integraalin sijoitus", latex: "\\bigg/_{\\!\\!\\!\\!\\!{a}}^{b}" }, { label: "differentiaali", latex: "\\text{d}x " }, 
        { label: "raja-arvo", latex: "\\lim_{x \\to \\infty}" }, { label: "derivaatta", latex: "\\frac{text{d}}{text{d}x}" },
        { label: "osittaisderivaatta", latex: "\\partial" }, { label: "nabla", latex: "\\nabla" }, 
        { label: "ensimmäinen aikaderivaatta", latex: "\\dot{x}" }, { label: "toinen aikaderivaatta", latex: "\\ddot{x}" },
        { label: "sini", latex: "\\sin\\left(x\\right)" }, { label: "kosini", latex: "\\cos\\left(x\\right)" }, { label: "tangentti", latex: "\\tan\\left(x\\right)" },
        { label: "arkussini", latex: "\\arcsin\\left(x\\right)" }, { label: "arkuskosini", latex: "\\arccos\\left(x\\right)" },
        { label: "arkustangentti", latex: "\\arctan\\left(x\\right)" },
        { label: "10-kantainen logaritmi", latex: "\\log\\left(x\\right)" }, { label: "yleinen logaritmi", latex: "\\log_a\\left(x\\right)" },
        { label: "luonnollinen logaritmi", latex: "\\ln\\left(x\\right)" }
      ]
    },
    {
      name: "Ympäristöt",
      symbols: [
        { label: "kohdistetut rivit", latex: "\\begin{aligned}\na &= b + c \\\\\nd &= e - f\n\\end{aligned}" },
        { label: "yhtälöpari", latex: "\\begin{cases}\nx + y = 1 \\\\\n2x - y = 3\n\\end{cases}" },
        { label: "taulukko", latex: "\\begin{array}{l|l} a & b \\\\ \\hline c & d \\end{array}" },
        { label: "teksti", latex: "\\text{T}" }
      ]
    },
    {
      name: "Kreikkalaiset",
      symbols: [
        { label: "alfa", latex: "\\alpha " }, { label: "beeta", latex: "\\beta " }, { label: "gamma", latex: "\\gamma " }, { label: "delta", latex: "\\delta " },
        { label: "epsilon", latex: "\\epsilon " }, { label: "zeeta", latex: "\\zeta " }, { label: "eeta", latex: "\\eta " }, { label: "theeta", latex: "\\theta " },
        { label: "ioota", latex: "\\iota " }, { label: "kappa", latex: "\\kappa " }, { label: "lambda", latex: "\\lambda " }, { label: "myy", latex: "\\mu " },
        { label: "nyy", latex: "\\nu " }, { label: "ksii", latex: "\\xi " }, { label: "omikron", latex: "ο" }, { label: "pii", latex: "\\pi " },
        { label: "rhoo", latex: "\\rho " }, { label: "sigma", latex: "\\sigma " }, { label: "loppusigma", latex: "\\varsigma " }, { label: "tau", latex: "\\tau " }, 
        { label: "ypsilon", latex: "\\upsilon " }, { label: "fii", latex: "\\phi " }, { label: "vaihtoehtoinen fii", latex: "\\varphi " },
        { label: "khii", latex: "\\chi " }, { label: "psii", latex: "\\psi " }, { label: "oomega", latex: "\\omega " },
        { label: "Gamma", latex: "\\Gamma " }, { label: "Delta", latex: "\\Delta " }, { label: "Theeta", latex: "\\Theta " },
        { label: "Lambda", latex: "\\Lambda " }, { label: "Ksii", latex: "\\Xi " }, { label: "Pii", latex: "\\Pi " },
        { label: "Sigma", latex: "\\Sigma " }, { label: "Ypsilon", latex: "\\Upsilon " },
        { label: "Fii", latex: "\\Phi " }, { label: "Psii", latex: "\\Psi " }, { label: "Oomega", latex: "\\Omega " }
      ]
    },
        {
      name: "Vektorit ja matriisit",
      symbols: [
        { label: "nuolivektori", latex: "\\vec{v}" }, { label: "nuolivektori vasemmalle", latex: "\\overleftarrow{v}" },
        { label: "nuolivektori alapuolella", latex: "\\underrightarrow{v}" }, { label: "lihavoitu vektori", latex: "\\mathbf{v}" },
        { label: "matriisi", latex: "\\begin{bmatrix}\na & b \\\\\nc & d\n\\end{bmatrix}" },
        { label: "determinantti", latex: "\\begin{vmatrix}a & b\\\\ c & d\\end{vmatrix}" }
      ]
    },
        {
      name: "Valmiit pohjat",
      symbols: [
        { label: "toisen asteen yhtälön ratkaisukaava", latex: "x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}" },
        { label: "määrätty integraali", latex: "\\int_a^b f(x)\\,\\text{d}x" }
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
