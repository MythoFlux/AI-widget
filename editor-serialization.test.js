import test from "node:test";
import assert from "node:assert/strict";
import { serializeMathNodeLatex, serializeEditorDocForBackend, tokenizeLatex } from "./editor-serialization.js";

test("murtoluvun insertio ja slotin täyttö serialisoituu oikein", () => {
  const mathNode = { attrs: { template: "frac", slots: ["a+1", "b-2"] } };
  assert.equal(serializeMathNodeLatex(mathNode), "\\frac{a+1}{b-2}");
});

test("tekstin + kaavan sekoitettu syöttö tokenisoituu oikein", () => {
  const tokens = tokenizeLatex("Hei $x+1$ maailma $$y=2$$");
  assert.deepEqual(tokens, [
    { type: "text", value: "Hei " },
    { type: "math", value: "x+1", displayMode: false },
    { type: "text", value: " maailma " },
    { type: "math", value: "y=2", displayMode: true }
  ]);
});

test("lähetys ja historian uudelleenlataus säilyttää serialisoidun sisällön", () => {
  const doc = {
    type: { name: "doc" },
    childCount: 1,
    forEach(cb) {
      cb({
        type: { name: "paragraph" },
        childCount: 3,
        forEach(innerCb) {
          innerCb({ type: { name: "text" }, text: "Ratkaise " }, 0, 0);
          innerCb({ type: { name: "inline_math" }, attrs: { template: "frac", slots: ["1", "2"] } }, 0, 1);
          innerCb({ type: { name: "text" }, text: " nyt" }, 0, 2);
        }
      }, 0, 0);
    }
  };

  const serialized = serializeEditorDocForBackend(doc);
  const history = [{ role: "user", content: serialized, includeInModelContext: true }];
  const raw = JSON.stringify(history);
  const loaded = JSON.parse(raw);
  assert.equal(loaded[0].content, "Ratkaise $\\frac{1}{2}$ nyt");
});
