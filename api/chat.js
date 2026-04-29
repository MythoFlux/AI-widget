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

  const outputs = Array.isArray(data?.output) ? data.output : [];
  for (const output of outputs) {
    const contentItems = Array.isArray(output?.content) ? output.content : [];
    for (const item of contentItems) {
      if (item?.type === "output_text" && typeof item.text === "string" && item.text.trim()) {
        return item.text.trim();
      }
      if (item?.type === "text" && typeof item?.text === "string" && item.text.trim()) {
        return item.text.trim();
      }
    }
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

function isValidStateSummary(value) {
  if (value == null) return true;
  if (typeof value !== "string") return false;
  return value.length <= 4000;
}

function toResponsesInput(messages, options = {}) {
  const { latestUserImage, stateSummary } = options;
  const tutorInstruction = {
    role: "developer",
    content: [
      {
        type: "input_text",
        text: "Toimit opiskelijaa ohjaavana opettajana matematiikan, fysiikan ja kemian tehtävissä. Tavoite ei ole ratkaista tehtävää opiskelijan puolesta, vaan auttaa opiskelijaa etenemään itse. Anna vain yksi seuraava vihje kerrallaan. Esitä ohjaavia kysymyksiä. Älä anna koko ratkaisua yhdellä kertaa. Jos opiskelija tekee virheen, älä heti anna valmista korjausta, vaan ohjaa häntä huomaamaan virhe. Voit muistuttaa kaavasta tai periaatteesta, mutta älä sovella sitä loppuun asti opiskelijan puolesta. Jos opiskelija pyytää koko ratkaisua, yritä ensin tarjota vihje. Jos hän edelleen pyytää ratkaisua, anna ratkaisu vaiheittain. Kuvatehtävissä tulkitse ensin kuvassa oleva tehtävä. Jos kuva on epäselvä, pyydä tarkennusta äläkä arvaa. Käytä LaTeXia: inline-kaavat muodossa $...$ ja erilliset kaavarivit muodossa $$...$$. Pidä vastaukset lyhyinä, selkeinä ja ohjaavina. Älä aloita ohjausta alusta, jos keskustelun tilanne kertoo, missä ollaan menossa."
      }
    ]
  };

  const summaryInstruction = stateSummary
    ? {
      role: "developer",
      content: [
        {
          type: "input_text",
          text: `Nykyinen tilanne tehtävänratkaisussa:\n${stateSummary}`
        }
      ]
    }
    : null;

  const lastUserIndex = (() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === "user") return i;
    }
    return -1;
  })();

  const history = messages.map((message, index) => {
    const content = [
      {
        type: "input_text",
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

  const input = [tutorInstruction];
  if (summaryInstruction) input.push(summaryInstruction);
  return [...input, ...history];
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

  if (!isValidStateSummary(body.stateSummary)) {
    return res.status(400).json({ error: "stateSummary pitää olla merkkijono, enintään 4000 merkkiä." });
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
        input: toResponsesInput(validMessages, {
          latestUserImage: body.latestUserImage || null,
          stateSummary: body.stateSummary || ""
        })
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
