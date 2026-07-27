# Meadow Vet Care

Static GitHub Pages chatbot connected to the public Meadow Google Sheet, Irish public holidays, and Dublin weather.

## AI mode

The browser first requests `/api/chat`. The serverless function sends the current Google Sheet services plus holiday/weather data to OpenAI, with instructions not to invent clinic facts. If the endpoint is unavailable, the browser uses its local grounded answer engine.

Deploy `api/chat.js` on Vercel or Netlify and configure:

```text
OPENAI_API_KEY=your-key
OPENAI_MODEL=gpt-4o-mini
```

Then set `window.MEADOW_AI_ENDPOINT` to the deployed function URL before `script.js` loads, or host the static site on the same platform. Never put `OPENAI_API_KEY` in `script.js` or GitHub Pages files.

The Google Sheet must remain shared as `Anyone with the link: Viewer` for the browser to refresh services dynamically.
