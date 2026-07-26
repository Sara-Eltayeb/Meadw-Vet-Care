const SHEET_ID = '1JhSODtviGHzXru6Eb5MhfXfVIF5vtJk3pclzzv7j2l4';
const GID = '1277715587';
const fallback = [
  ['MVC-004','Consultation','Dog','230','20','Yes','Mon-Fri','5','Telehealth video consult'],
  ['MVC-001','Consultation','Dog','55','25','Yes','Mon-Sat','0','15% off this month','General consultation'],
  ['MVC-043','Dental','Dog','325','90','Yes','Mon-Fri','4','Free nail trim included','Scale & polish (dental)'],
  ['MVC-088','Emergency','Dog','260','60','No','24/7','2','20% off in July','Emergency stabilisation'],
  ['MVC-085','Emergency','Dog','150','40','No','24/7','2','','Out-of-hours emergency consult'],
  ['MVC-066','Diagnostics','Cat','185','45','Yes','Mon-Fri','0','Book online & save 10%','Ultrasound scan'],
  ['MVC-052','Surgery','Cat','180','90','Yes','Mon-Fri','8','20% off in July','Neutering (spay/castrate)'],
  ['MVC-014','Preventive','Dog','60','30','Yes','Mon-Sat','6','Free nail trim included','Annual wellness check'],
  ['MVC-037','Microchip & ID','Dog','95','40','Yes','Mon-Fri','3','Pet passport & travel cert','Microchipping'],
  ['MVC-034','Microchip & ID','Dog','30','15','No','Mon-Sat','5','','Microchipping'],
  ['MVC-005','Consultation','Cat','30','20','Yes','Mon-Fri','7','Telehealth video consult'],
  ['MVC-003','Consultation','Rabbit','55','25','Yes','Mon-Sat','5','20% off in July','General consultation'],
  ['MVC-084','Consultation','Bird','50','30','Yes','Tue-Thu','5','','Avian health check'],
  ['MVC-083','Consultation','Small mammal','42','25','Yes','Mon-Fri','2','Free nail trim included','Small-mammal health check'],
  ['MVC-077','Grooming','Dog','18','15','No','Mon-Sat','5','20% off in July','Nail clipping'],
  ['MVC-031','Vaccination','Dog','38','15','Yes','Mon-Sat','3','','Kennel cough vaccine']
];
let services = fallback.map(makeService);
let selectedFilter = 'All';

function makeService(row) { return { id: row[0], category: row[1], species: row[2], price: Number(String(row[3]).replace(/[^\d.-]/g, '')) || 0, duration: row[4], appointment: row[5], availability: row[6], slots: row[7], offer: row[8] || '', name: row[9] || row[8] || 'General consultation' }; }
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
}
function euro(n) { return `€${Number(n).toLocaleString('en-IE')}`; }
function renderServices() {
  const visible = services.filter(s => selectedFilter === 'All' || s.species === selectedFilter);
  document.querySelector('#serviceCount').textContent = `${services.length >= 90 ? '90+' : services.length} services`;
  document.querySelector('#serviceList').innerHTML = visible.slice(0, 9).map(s => `<div class="service-row"><div><strong>${s.name}</strong><small>${s.category} · ${s.species}</small></div><div><div class="price">${euro(s.price)}</div><div class="tag">${s.slots} slots</div></div></div>`).join('');
}
function answer(question) {
  const q = question.toLowerCase();
  let found = services.filter(s => (q.includes('dog') ? s.species === 'Dog' : q.includes('cat') ? s.species === 'Cat' : q.includes('rabbit') ? s.species === 'Rabbit' : true));
  if (q.includes('microchip')) found = services.filter(s => s.category === 'Microchip & ID');
  else if (q.includes('telehealth')) found = services.filter(s => s.name.toLowerCase().includes('telehealth'));
  else if (q.includes('offer') || q.includes('discount')) found = services.filter(s => s.offer);
  else if (q.includes('emergency')) found = services.filter(s => s.category === 'Emergency');
  else if (q.includes('dental')) found = services.filter(s => s.category === 'Dental');
  found = found.slice(0, 4);
  if (!found.length) return { text: `I couldn't find a matching service in the live directory. Try asking about a species, service, price or offer.` };
  const subject = q.includes('offer') || q.includes('discount') ? 'Here are the current offers I found:' : `I found ${found.length === 1 ? 'this service' : 'these services'} in Meadow's live directory:`;
  return { text: subject, cards: found };
}
function send(question) {
  if (!question.trim()) return;
  const conversation = document.querySelector('#conversation');
  conversation.insertAdjacentHTML('beforeend', `<div class="message user">${question.replace(/[<>]/g, '')}</div>`);
  const result = answer(question);
  const cards = result.cards ? `<div class="answer-card">${result.cards.map(s => `<div><strong>${s.name}</strong><small>${s.species} · ${s.duration} min · ${s.availability}</small></div><div><b>${euro(s.price)}</b><span>${s.offer || `${s.slots} slots`}</span></div>`).join('')}</div>` : '';
  setTimeout(() => { conversation.insertAdjacentHTML('beforeend', `<div class="message bot"><strong>Meadow Guide</strong><br>${result.text}${cards}</div>`); conversation.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 250);
}
document.querySelector('#chatForm').addEventListener('submit', e => { e.preventDefault(); const input = document.querySelector('#questionInput'); send(input.value); input.value = ''; });
