const SHEET_ID = '1zuXAKwPE6KGpkPMAVyMnPb6xnlSz68ObSQUwiLwO0j0';
const GID = '1578696602';
const fallback = [
  ['MW-001','Body Care','Body Care','16.95','500ml','In stock','Warm Vanilla Sugar','Moisturising body lotion'],
  ['MW-002','Candles','Candles','24.95','411g','In stock','A Thousand Wishes','Three-wick candle'],
  ['MW-003','Gifts','Gifts','29.95','Gift set','In stock','Japanese Cherry Blossom','Body care gift set']
];
let services = fallback.map(makeService);
let selectedFilter = 'All';
let holidays = [];
let weather = null;

function makeService(row) { return { id: row[0], category: row[1] || 'Product', species: row[2] || row[1] || 'Retail', price: Number(String(row[3]).replace(/[^\d.-]/g, '')) || 0, duration: row[4] || '', appointment: row[5] || '', availability: row[6] || '', slots: row[7] || '', offer: row[8] || '', name: row[9] || row[2] || row[1] || 'Product' }; }
function parseSheet(text) {
  const start = text.indexOf('('), end = text.lastIndexOf(')');
  if (start < 0 || end < 0) return [];
  const json = JSON.parse(text.slice(start + 1, end));
  return json.table.rows.slice(1).map(r => r.c.map(c => c ? (c.f ?? c.v ?? '') : '')).map(makeService);
}
async function loadLiveData() {
  try {
    const response = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${GID}`);
    const live = parseSheet(await response.text());
    if (live.length) { services = live; renderServices(); }
  } catch (error) { /* The local set keeps the guide useful when CORS or offline blocks Sheets. */ }
  try {
    const [holidayResponse, weatherResponse] = await Promise.all([
      fetch(`https://date.nager.at/api/v3/PublicHolidays/${new Date().getFullYear()}/IE`),
      fetch('https://api.open-meteo.com/v1/forecast?latitude=53.3498&longitude=-6.2603&current=temperature_2m,weather_code&timezone=Europe%2FDublin')
    ]);
    if (holidayResponse.ok) holidays = await holidayResponse.json();
    if (weatherResponse.ok) weather = await weatherResponse.json();
    renderSignals();
  } catch (error) { renderSignals(); }
}
function renderSignals() {
  if (!document.querySelector('#holidayName')) return;
  const today = new Date();
  const next = holidays.find(item => new Date(item.date) >= new Date(today.toDateString()));
  document.querySelector('#holidayName').textContent = next ? next.localName : 'No upcoming holiday found';
  document.querySelector('#holidayDate').textContent = next ? new Intl.DateTimeFormat('en-IE', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(next.date)) : 'Check opening hours manually';
  const temp = weather?.current?.temperature_2m;
  document.querySelector('#weatherValue').textContent = temp == null ? 'Weather unavailable' : `${Math.round(temp)}°C in Dublin`;
  document.querySelector('#weatherAdvice').textContent = temp >= 24 ? 'Warm: suggest cool-time walks' : temp == null ? 'Try again shortly' : 'No heat signal right now';
}
function euro(n) { return `€${Number(n).toLocaleString('en-IE')}`; }
function renderServices() {
  const visible = services.filter(s => selectedFilter === 'All' || s.category === selectedFilter || s.species === selectedFilter);
  document.querySelector('#serviceCount').textContent = `${services.length} products`;
  document.querySelector('#serviceList').innerHTML = visible.slice(0, 9).map(s => `<div class="service-row"><div><strong>${s.name}</strong><small>${s.category} · ${s.species}</small></div><div><div class="price">${euro(s.price)}</div><div class="tag">${s.slots} slots</div></div></div>`).join('');
}
function answer(question) {
  const q = question.toLowerCase();
  const nextHoliday = holidays.find(item => new Date(item.date) >= new Date(new Date().toDateString()));
  if (q.includes('holiday') || q.includes('bank holiday') || q.includes('open')) {
    if (!nextHoliday) return { text: `I cannot confirm an upcoming Irish public holiday from the live feed right now, so I will not guess store opening hours. Please check the store directly.` };
    const date = new Intl.DateTimeFormat('en-IE', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(nextHoliday.date));
    return { text: `The next Irish public holiday is ${nextHoliday.localName} on ${date}. Store opening hours are not confirmed in the retail catalogue, so please check the store schedule before visiting.` };
  }
  if (q.includes('weather') || q.includes('hot') || q.includes('walk') || q.includes('temperature')) {
    const temp = weather?.current?.temperature_2m;
    if (temp == null) return { text: `The Dublin weather feed has not responded yet. I cannot safely assess walking conditions without a current reading.` };
    return { text: `Dublin is ${Math.round(temp)}°C right now. ${temp >= 24 ? 'That is a warm-weather signal: suggest shorter, cooler walks and fresh water, especially for senior or flat-faced dogs.' : 'There is no heat signal from the current temperature. Keep normal outdoor-care advice in place.'}` };
  }
  let found = services.filter(s => (q.includes('dog') ? s.species === 'Dog' : q.includes('cat') ? s.species === 'Cat' : q.includes('rabbit') ? s.species === 'Rabbit' : true));
  if (q.includes('candle')) found = services.filter(s => `${s.category} ${s.name}`.toLowerCase().includes('candle'));
  else if (q.includes('gift')) found = services.filter(s => `${s.category} ${s.name}`.toLowerCase().includes('gift'));
  else if (q.includes('body') || q.includes('lotion')) found = services.filter(s => `${s.category} ${s.name}`.toLowerCase().includes('body') || `${s.category} ${s.name}`.toLowerCase().includes('lotion'));
  else if (q.includes('offer') || q.includes('discount')) found = services.filter(s => s.offer);
  else if (q.includes('emergency')) found = services.filter(s => s.category === 'Emergency');
  else if (q.includes('dental')) found = services.filter(s => s.category === 'Dental');
  found = found.slice(0, 4);
  if (!found.length) return { text: `I couldn't find a matching product in the live catalogue. Try asking about a product, category, price or offer.` };
  const subject = q.includes('offer') || q.includes('discount') ? 'Here are the current offers I found:' : `I found ${found.length === 1 ? 'this product' : 'these products'} in Meadow's live catalogue:`;
  return { text: subject, cards: found };
}
async function askAi(question) {
  const endpoint = window.MEADOW_AI_ENDPOINT || '/api/chat';
  const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question, services, holidays, weather }) });
  if (!response.ok) throw new Error('AI service unavailable');
  const data = await response.json();
  return { text: data.answer || 'I could not produce an answer from the connected clinic data.' };
}
async function send(question) {
  if (!question.trim()) return;
  const conversation = document.querySelector('#conversation');
  conversation.insertAdjacentHTML('beforeend', `<div class="message user">${question.replace(/[<>]/g, '')}</div>`);
  let result;
  try { result = await askAi(question); } catch (error) { result = answer(question); }
  const cards = result.cards ? `<div class="answer-card">${result.cards.map(s => `<div><strong>${s.name}</strong><small>${s.species} · ${s.duration} min · ${s.availability}</small></div><div><b>${euro(s.price)}</b><span>${s.offer || `${s.slots} slots`}</span></div>`).join('')}</div>` : '';
  setTimeout(() => { conversation.insertAdjacentHTML('beforeend', `<div class="message bot"><strong>Meadow Guide</strong><br>${result.text.replace(/[<>]/g, '')}${cards}</div>`); conversation.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 250);
}
document.querySelector('#chatForm').addEventListener('submit', e => { e.preventDefault(); const input = document.querySelector('#questionInput'); send(input.value); input.value = ''; });
