# AI-widget (Vercel)

Kevyt chat-sovellus, jossa:

- frontend on `index.html`
- backend on Vercel Functionissa `api/chat.js` (reitillä `/api/chat`)
- OpenAI-avainta käytetään vain palvelinpuolella ympäristömuuttujasta `OPENAI_API_KEY`

## Tiedostorakenne

```
.
├── api/
│   └── chat.js
├── index.html
└── README.md
```

## Julkaisu Verceliin (ilman paikallista CLI:tä)

1. Tallenna nämä tiedostot GitHub-repoon.
2. Avaa Vercel ja **Add New Project**.
3. Valitse GitHub-repo.
4. Framework voi olla **Other** (ei build-vaihetta tarvita).
5. Lisää ympäristömuuttuja:
   - Name: `OPENAI_API_KEY`
   - Value: oma OpenAI API key
   - Environment: vähintään **Production** (halutessa myös Preview/Development)
6. Deploy.

## Tarvitaanko `vercel.json`?

Ei tässä minimirakenteessa. Vercel tunnistaa suoraan:

- `index.html` staattisena etusivuna
- `api/chat.js` serverless-funktiona reitille `/api/chat`

`vercel.json` tarvitaan vasta, jos haluat erikoisreitityksiä tai muuta lisäkonfiguraatiota.
