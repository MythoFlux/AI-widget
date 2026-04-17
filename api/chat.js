module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "OPENAI_API_KEY puuttuu palvelimelta" });
  }

  const message = (req.body?.message || "").toString().trim();
  if (!message) {
    return res.status(400).json({ error: "Body-muoto: { \"message\": \"...\" }" });
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

    const data = await openaiResponse.json();

    if (!openaiResponse.ok) {
      const errorMessage = data?.error?.message || "OpenAI API -kutsu epäonnistui";
      return res.status(502).json({ error: errorMessage });
    }

    const reply = data?.output_text?.trim();
    if (!reply) {
      return res.status(502).json({ error: "OpenAI ei palauttanut vastaustekstiä" });
    }

    return res.status(200).json({ reply });
  } catch (error) {
    return res.status(500).json({ error: `Palvelinvirhe: ${error.message}` });
  }
}
