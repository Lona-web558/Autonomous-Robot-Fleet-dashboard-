const canvas = document.getElementById('floor');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const fleetRows = document.getElementById('fleetRows');
const alertList = document.getElementById('alertList');
const weatherCard = document.getElementById('weatherCard');
const selectedHint = document.getElementById('selectedHint');

let world = { width: 900, height: 500 };
let chargeStation = { x: 40, y: 460 };
let robots = [];
let selectedId = null;
let scale = 1;

const STATUS_COLOR = {
  idle: '#8a9aa8', moving: '#3dd6d0', returning: '#3dd6d0', working: '#e8b931', charging: '#63d68e'
};

function el(tag, props = {}, ...kids) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  kids.forEach(k => node.append(k));
  return node;
}

function batteryColor(pct) {
  if (pct <= 20) return '#ff7b72';
  if (pct <= 50) return '#e8b931';
  return '#63d68e';
}

function resizeCanvas() {
  const maxW = canvas.parentElement.clientWidth || 640;
  scale = Math.min(1, maxW / world.width);
  canvas.width = world.width * scale;
  canvas.height = world.height * scale;
}

function drawFloor() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#1c2830';
  ctx.lineWidth = 1;
  const grid = 50 * scale;
  for (let x = 0; x <= canvas.width; x += grid) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
  for (let y = 0; y <= canvas.height; y += grid) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }

  // Charging station
  ctx.fillStyle = 'rgba(99, 214, 142, .18)';
  ctx.strokeStyle = '#63d68e';
  ctx.lineWidth = 2;
  const cs = { x: chargeStation.x * scale, y: chargeStation.y * scale };
  ctx.beginPath(); ctx.roundRect(cs.x - 28, cs.y - 20, 56, 40, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#63d68e';
  ctx.font = '10px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('CHARGE', cs.x, cs.y + 3);

  robots.forEach(r => {
    const x = r.x * scale, y = r.y * scale;
    if (r.target && (r.status === 'moving' || r.status === 'returning')) {
      ctx.strokeStyle = 'rgba(61, 214, 208, .35)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(r.target.x * scale, r.target.y * scale); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.beginPath();
    ctx.arc(x, y, r.id === selectedId ? 9 : 7, 0, Math.PI * 2);
    ctx.fillStyle = STATUS_COLOR[r.status] || '#8a9aa8';
    ctx.fill();
    if (r.id === selectedId) { ctx.strokeStyle = '#e8b931'; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.fillStyle = '#e6edf3';
    ctx.font = '10px Space Grotesk, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(r.name, x, y - 12);
  });
}

function renderTable() {
  fleetRows.replaceChildren(...robots.map(r => {
    const tr = el('tr', { className: r.id === selectedId ? 'selected' : '' });
    tr.onclick = () => { selectedId = r.id; renderTable(); drawFloor(); updateHint(); };

    const nameCell = el('td', {}, el('div', { className: 'robot-name', textContent: r.name }));
    const statusCell = el('td', {}, el('span', { className: `status-pill status-${r.status}`, textContent: r.status }));
    const batteryCell = el('td');
    const bar = el('div', { className: 'battery-bar' });
    bar.append(el('div', { className: 'battery-fill', style: `width:${r.battery}%; background:${batteryColor(r.battery)}` }));
    batteryCell.append(bar, el('div', { className: 'small text-muted mt-1', textContent: r.battery + '%' }));

    tr.append(nameCell, statusCell, batteryCell);
    return tr;
  }));
}

function updateHint() {
  const r = robots.find(x => x.id === selectedId);
  selectedHint.textContent = r ? `${r.name} selected — click the floor to dispatch it` : 'Select a robot, then click the floor to dispatch it';
}

function renderStats() {
  document.getElementById('statTotal').textContent = robots.length;
  document.getElementById('statActive').textContent = robots.filter(r => ['moving', 'working', 'returning'].includes(r.status)).length;
  document.getElementById('statCharging').textContent = robots.filter(r => r.status === 'charging').length;
  const avg = robots.length ? Math.round(robots.reduce((s, r) => s + r.battery, 0) / robots.length) : 0;
  document.getElementById('statBattery').textContent = avg + '%';
}

function renderAlerts(alerts) {
  alertList.replaceChildren(...alerts.map(a => el('li', { className: `level-${a.level}` },
    el('span', { className: 'time', textContent: new Date(a.time).toLocaleTimeString() }),
    document.createTextNode(a.message)
  )));
}

async function pollFleet() {
  try {
    const res = await fetch('/api/fleet');
    const data = await res.json();
    world = data.world; chargeStation = data.chargeStation; robots = data.robots;
    resizeCanvas();
    drawFloor();
    renderTable();
    renderStats();
    statusEl.className = 'status';
    statusEl.textContent = `Live — tick ${data.tick}.`;
  } catch (err) {
    statusEl.className = 'status error';
    statusEl.textContent = 'Could not reach the fleet server.';
  }
}

async function pollAlerts() {
  try {
    const res = await fetch('/api/alerts');
    renderAlerts(await res.json());
  } catch { /* non-critical */ }
}

async function pollWeather() {
  try {
    const res = await fetch('/api/weather');
    const w = await res.json();
    if (w.error) { weatherCard.textContent = 'Weather unavailable'; return; }
    weatherCard.innerHTML = '';
    weatherCard.append(
      document.createTextNode(`${w.location}: ${Math.round(w.temperatureC)}°C, ${w.description}, wind ${Math.round(w.windKmh)} km/h`),
      w.stale ? el('span', { className: 'stale', textContent: ' (cached)' }) : document.createTextNode('')
    );
  } catch {
    weatherCard.textContent = 'Weather unavailable';
  }
}

canvas.addEventListener('click', async e => {
  if (!selectedId) { updateHint(); return; }
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / scale * (canvas.width / rect.width);
  const y = (e.clientY - rect.top) / scale * (canvas.height / rect.height);
  try {
    const res = await fetch(`/api/robots/${selectedId}/task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x: Math.round(x), y: Math.round(y), label: 'Manual dispatch' })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    pollFleet(); pollAlerts();
  } catch (err) {
    statusEl.className = 'status error';
    statusEl.textContent = err.message;
  }
});

window.addEventListener('resize', () => { resizeCanvas(); drawFloor(); });

pollFleet(); pollAlerts(); pollWeather();
setInterval(pollFleet, 1500);
setInterval(pollAlerts, 3000);
setInterval(pollWeather, 60000);
