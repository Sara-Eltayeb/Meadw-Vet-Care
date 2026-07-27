export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'POST required' });
  if (!process.env.OPENAI_API_KEY) return response.status(503).json({ error: 'OPENAI_API_KEY is not configured' });
  const { question, services = [] } = request.body || {};
  if (!question) return response.status(400).json({ error: 'Question is required' });
  const [holidayResponse, weatherResponse, sheetResponse] = await Promise.all([
    fetch(`https://date.nager.at/api/v3/PublicHolidays/${new Date().getFullYear()}/IE`),
    fetch('https://api.open-meteo.com/v1/forecast?latitude=53.3498&longitude=-6.2603&current=temperature_2m,weather_code&timezone=Europe%2FDublin'),
    fetch('https://docs.google.com/spreadsheets/d/1JhSODtviGHzXru6Eb5MhfXfVIF5vtJk3pclzzv7j2l4/gviz/tq?tqx=out:json&gid=1277715587')
  ]);
  let holidays = holidayResponse.ok ? await holidayResponse.json() : [];
  let weather = weatherResponse.ok ? await weatherResponse.json() : null;
  let liveServices = services;
  if (sheetResponse.ok) {
    try {
      const raw = await sheetResponse.text();
      const start = raw.indexOf('('), end = raw.lastIndexOf(')');
      const sheet = JSON.parse(raw.slice(start + 1, end));
      const rows = sheet.table?.rows || [];
      if (rows.length) liveServices = rows.slice(1).map(row => row.c?.map(cell => cell?.f ?? cell?.v ?? '') || []);
    } catch { /* Use the browser's sheet data if the server cannot parse it. */ }
  }
  const context = JSON.stringify({ services: liveServices, holidays, weather });
  const result = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.1,
      messages: [
        { role: 'system', content: 'You are Meadow Guide, the confident but careful assistant for an Irish veterinary clinic. Answer only from the supplied clinic data. Never invent prices, availability, opening hours, diagnoses, or public holiday details. If information is missing, say it is not confirmed and recommend contacting the clinic. For urgent medical issues, advise calling the clinic or emergency service. Keep answers concise and friendly. Mention the relevant source when useful.' },
        { role: 'user', content: `Clinic data (JSON): ${context}\n\nClient question: ${question}` }
      ]
    })
  });
  const payload = await result.json();
  if (!result.ok) return response.status(502).json({ error: 'AI provider error' });
  return response.status(200).json({ answer: payload.choices?.[0]?.message?.content || 'No answer returned.' });
}
