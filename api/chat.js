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

function isValidMessage(message) {
  if (!message || typeof message !== "object") return false;
  if (!(message.role === "user" || message.role === "assistant")) return false;
  if (typeof message.content !== "string") return false;
  return message.content.trim().length > 0;
}

function isValidDataImageUrl(value) {
  if (typeof value !== "string") return false;
  return /^data:image\/[a-zA-Z0-9.+-]+;base64,[a-zA-Z0-9+/=\s]+$/.test(value);
}

function toResponsesInput(messages, options = {}) {
  const { latestUserImage } = options;
  const tutorInstruction = {
    role: "system",
    content: [
      {
        type: "input_text",
        text: "Toimit opiskelijaa auttavana opettajana matematiikan, fysiikan ja kemian tehtävissä. Auta vaiheittain: selitä ajattelu ja välivaiheet selkeästi, ja vältä antamasta pelkkää loppuvastausta ellei käyttäjä pyydä sitä erikseen. Kun kirjoitat matemaattisia lausekkeita, käytä LaTeX-muotoa. Käytä inline-kaavoihin merkintää $...$ ja erillisille riveille merkintää $$...$$. Älä käytä pelkkää Unicode-merkintää silloin, kun lauseke voidaan ilmaista LaTeXilla."
      }
    ]
  };

  const lastUserIndex = (() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === "user") return i;
    }
    return -1;
  })();

  const history = messages.map((message, index) => {
    const contentType = message.role === "assistant" ? "output_text" : "input_text";
    const content = [
      {
        type: contentType,
        text: message.content
      }
    ];

    if (latestUserImage && message.role === "user" && index === lastUserIndex) {
      content.push({
        type: "input_image",
        image_url: latestUserImage
      });
    }

    return {
      role: message.role,
      content
    };
  });

  return [tutorInstruction, ...history];
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

  if (!Array.isArray(body.messages)) {
    return res.status(400).json({ error: "Body-muoto: { \"messages\": [{ \"role\": \"user\", \"content\": \"...\" }] }" });
  }

  if (body.latestUserImage != null && !isValidDataImageUrl(body.latestUserImage)) {
    return res.status(400).json({ error: "latestUserImage pitää olla kelvollinen data:image/*;base64 URL." });
  }

  const validMessages = body.messages.filter(isValidMessage);
  if (validMessages.length === 0) {
    return res.status(400).json({ error: "messages-taulukossa pitää olla vähintään yksi kelvollinen viesti." });
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
        input: toResponsesInput(validMessages, { latestUserImage: body.latestUserImage || null })
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
