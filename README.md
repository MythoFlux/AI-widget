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

## Vianmääritys: konsolin varoitukset (Radix / Zustand / async listener)

Jos konsolissa näkyy esimerkiksi:

- `[DEPRECATED] Default export is deprecated. Instead use import { create } from 'zustand'.`
- ``DialogContent` requires a `DialogTitle` ...`
- `Warning: Missing 'Description' or aria-describedby=...`
- `A listener indicated an asynchronous response by returning true ...`

niin ne eivät tule tämän repositorion koodista (tässä projektissa ei käytetä Reactia, Radixia tai Zustandia). Yleisin syy on selaimen lisäosa, joka injektoi oman käyttöliittymän sivulle.

Tarkista näin:

1. Avaa sivu Incognito/Private-ikkunassa ilman lisäosia.
2. Poista lisäosat väliaikaisesti käytöstä (etenkin AI-/hakemisto-/overlay-lisäosat).
3. Lataa sivu uudelleen ja vertaa konsolilokia.

Lisäksi `index.html` sisältää nyt suodattimen tunnetulle lisäosan aiheuttamalle `unhandledrejection`-viestille, jotta sovelluksen oma toiminta ei häiriinny tästä kohinasta.
