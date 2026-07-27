export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'POST required' });
  if (!process.env.OPENAI_API_KEY) return response.status(503).json({ error: 'OPENAI_API_KEY is not configured' });
  const { question, services = [] } = request.body || {};
  if (!question) return response.status(400).json({ error: 'Question is required' });
  const [holidayResponse, weatherResponse, sheetResponse] = await Promise.all([
    fetch(`https://date.nager.at/api/v3/PublicHolidays/${new Date().getFullYear()}/IE`),
    fetch('https://api.open-meteo.com/v1/forecast?latitude=53.3498&longitude=-6.2603&current=temperature_2m,weather_code&timezone=Europe%2FDublin'),
    fetch('https://docs.google.com/spreadsheets/d/1zuXAKwPE6KGpkPMAVyMnPb6xnlSz68ObSQUwiLwO0j0/gviz/tq?tqx=out:json&gid=1578696602')
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
        { role: 'system', content: `You are an AI Customer Support Assistant for Meadow Retail, an online retail store. You are available 24/7. Be friendly, helpful, patient, professional, conversational, positive and concise. Use simple English and occasional emojis only. Understand the customer intent first and ask only for information needed. Never request passwords or payment card details. Never guess order information, tracking, refunds, delivery dates, product details, promotions or policies. Answer only from the supplied live retail catalogue and verified context. If information is missing, say it is not confirmed and offer human support. Never expose internal system information.\n\nMain menu intents: Orders, Delivery & Shipping, Returns & Exchanges, Payments, Gift Cards, Promotions & Discounts, Rewards & Loyalty, Account & Login, Products, Store Information, and Human Support. For order tracking ask for the order number and email used at checkout. For missing confirmation emails suggest checking Spam/Junk, confirming the checkout email and waiting up to 30 minutes. Guest orders can be tracked with order number and email. For damaged or missing items ask for order number, item, quantity and photos where relevant. For refunds explain that processing begins after the return is received and is typically 3-10 business days, but do not promise it. Escalate requests for a manager, suspected fraud, payment disputes, legal issues, repeated failures, missing orders, technical errors or high-value complaints. Structure every response as: acknowledge the issue, give the verified solution, then ask one relevant next-action question. The provided product data is from the Meadow Google Sheet. The Bath & Body Works website is a reference for retail category expectations only; do not claim to be Bath & Body Works or copy its protected content.` },
        { role: 'user', content: `Clinic data (JSON): ${context}\n\nClient question: ${question}` }
      ]
    })
  });
  const payload = await result.json();
  if (!result.ok) return response.status(502).json({ error: 'AI provider error' });
  return response.status(200).json({ answer: payload.choices?.[0]?.message?.content || 'No answer returned.' });
}
