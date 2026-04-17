function parseRequestBody(rawBody) {
  if (!rawBody) return {};
  if (typeof rawBody === "object") return rawBody;

  try {
    return JSON.parse(rawBody);
  } catch {
    return null;
  }
}

function extractReply(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const contentItems = data?.output?.[0]?.content;
  if (Array.isArray(contentItems)) {
    const textItem = contentItems.find((item) => item?.type === "output_text" && typeof item.text === "string");
    if (textItem?.text?.trim()) return textItem.text.trim();
  }

  return "";
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Vain POST on sallittu." });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "OPENAI_API_KEY puuttuu palvelimelta." });
  }

  const body = parseRequestBody(req.body);
  if (body === null) {
    return res.status(400).json({ error: "Virheellinen JSON body." });
  }

  const message = (body.message || "").toString().trim();
  if (!message) {
    return res.status(400).json({ error: "Body-muoto: { \"message\": \"käyttäjän viesti\" }" });
  }

  try {
    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: message
      })
    });

    const data = await openaiResponse.json().catch(() => ({}));

    if (!openaiResponse.ok) {
      const errorMessage = data?.error?.message || "OpenAI API -kutsu epäonnistui.";
      return res.status(502).json({ error: errorMessage });
    }

    const reply = extractReply(data);
    if (!reply) {
      return res.status(502).json({ error: "OpenAI ei palauttanut vastaustekstiä." });
    }

    return res.status(200).json({ reply });
  } catch (error) {
    return res.status(500).json({ error: `Palvelinvirhe: ${error.message}` });
  }
};
