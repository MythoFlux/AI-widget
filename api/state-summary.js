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

function isValidSummaryField(value) {
  if (value == null) return true;
  return typeof value === "string" && value.length <= 4000;
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

  const { previousSummary = "", latestUserMessage = "", latestAssistantReply = "" } = body;

  if (!isValidSummaryField(previousSummary) || typeof latestUserMessage !== "string" || typeof latestAssistantReply !== "string") {
    return res.status(400).json({
      error: "Kentät: previousSummary (string <= 4000), latestUserMessage (string), latestAssistantReply (string)."
    });
  }

  try {
    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        input: [
          {
            role: "developer",
            content: [
              {
                type: "input_text",
                text: "Päivitä lyhyt tilannekuva opiskelijan tehtävänratkaisusta. Säilytä vain opetuksen kannalta olennainen tieto:\n- mikä tehtävä on kyseessä\n- mitä opiskelija on jo ymmärtänyt tai tehnyt\n- missä kohtaa hän on jumissa\n- mikä on seuraava järkevä ohjaava askel\nÄlä kirjoita koko keskustelua. Pidä yhteenveto enintään 10 rivissä."
              }
            ]
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `Edellinen yhteenveto:\n${previousSummary || "(tyhjä)"}\n\nOpiskelijan viimeisin viesti:\n${latestUserMessage || "(tyhjä)"}\n\nAssistantin viimeisin vastaus:\n${latestAssistantReply || "(tyhjä)"}`
              }
            ]
          }
        ]
      })
    });

    const data = await openaiResponse.json().catch(() => ({}));

    if (!openaiResponse.ok) {
      const errorMessage = data?.error?.message || "OpenAI API -kutsu epäonnistui.";
      return res.status(502).json({ error: errorMessage });
    }

    const updatedSummary = extractReply(data);
    if (!updatedSummary) {
      return res.status(502).json({ error: "OpenAI ei palauttanut yhteenvetoa." });
    }

    return res.status(200).json({ updatedSummary: updatedSummary.slice(0, 4000) });
  } catch (error) {
    return res.status(500).json({ error: `Palvelinvirhe: ${error.message}` });
  }
};
