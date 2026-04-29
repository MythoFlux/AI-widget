export function normalizeMathDelimiters(text) {
  if (typeof text !== "string" || text.length === 0) return "";
  return text
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, latex) => `$$${latex.trim()}$$`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, latex) => `$${latex.trim()}$`);
}

export function tokenizeLatex(text) {
  const tokens = [];
  const mathPattern = /\$\$([\s\S]+?)\$\$|\$([^\n$]+?)\$/g;
  let lastIndex = 0;
  let match;

  while ((match = mathPattern.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (start > lastIndex) tokens.push({ type: "text", value: text.slice(lastIndex, start) });
    tokens.push({ type: "math", value: match[1] ?? match[2] ?? "", displayMode: typeof match[1] === "string" });
    lastIndex = end;
  }

  if (lastIndex < text.length) tokens.push({ type: "text", value: text.slice(lastIndex) });
  return tokens;
}

export function serializeMathNodeLatex(node) {
  if (node.attrs?.template === "frac") {
    const [num = "", den = ""] = node.attrs?.slots || [];
    return `\\frac{${num}}{${den}}`;
  }
  return node.attrs?.latex || "";
}

export function serializeNodeToLatex(node) {
  if (node.type?.name === "text") return node.text || "";
  if (node.type?.name === "inline_math") return `$${serializeMathNodeLatex(node)}$`;
  if (node.type?.name === "block_math") return `$$${serializeMathNodeLatex(node)}$$`;
  let output = "";
  node.forEach((child, _offset, index) => {
    output += serializeNodeToLatex(child);
    if (node.type?.name === "doc" && index < node.childCount - 1) output += "\n";
  });
  return output;
}

export function serializeEditorDocForBackend(doc) {
  return normalizeMathDelimiters(serializeNodeToLatex(doc)).trim();
}
