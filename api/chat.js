export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'POST required' });
  if (!process.env.OPENAI_API_KEY) return response.status(503).json({ error: 'OPENAI_API_KEY is not configured' });
  const { question, services = [], holidays = [], weather = null } = request.body || {};
  if (!question) return response.status(400).json({ error: 'Question is required' });
  const context = JSON.stringify({ services, holidays, weather });
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
