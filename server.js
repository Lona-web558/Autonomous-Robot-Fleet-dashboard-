const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const { FleetEngine } = require('./fleet-engine');

const app = express();
const PORT = process.env.PORT || 3000;
const TICK_MS = 1500;
const WEATHER_CACHE_MS = 10 * 60 * 1000;

// Johannesburg, since that's where this fleet is notionally deployed.
const WEATHER_LAT = -26.19;
const WEATHER_LON = 28.03;

const WMO_CODES = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Depositing rime fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Dense drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow',
  80: 'Light showers', 81: 'Showers', 82: 'Violent showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with hail'
};

const fleet = new FleetEngine();
setInterval(() => fleet.step(), TICK_MS);

app.use(express.json({ limit: '64kb' }));

app.get('/api/fleet', (req, res) => {
  res.json(fleet.state());
});

app.get('/api/alerts', (req, res) => {
  res.json(fleet.alerts.slice(0, 20));
});

app.post('/api/robots/:id/task', (req, res) => {
  const { x, y, label } = req.body || {};
  if (typeof x !== 'number' || typeof y !== 'number') {
    return res.status(400).json({ error: 'x and y must be numbers.' });
  }
  const result = fleet.assignTask(req.params.id, x, y, label);
  if (result.error) return res.status(400).json({ error: result.error });
  res.json({ ok: true });
});

let weatherCache = { time: 0, data: null };

app.get('/api/weather', async (req, res) => {
  try {
    if (!weatherCache.data || Date.now() - weatherCache.time > WEATHER_CACHE_MS) {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${WEATHER_LAT}&longitude=${WEATHER_LON}&current=temperature_2m,wind_speed_10m,weather_code`;
      const r = await fetch(url, { timeout: 8000 });
      if (!r.ok) throw new Error('Weather service returned ' + r.status);
      const json = await r.json();
      weatherCache = {
        time: Date.now(),
        data: {
          location: 'Johannesburg',
          temperatureC: json.current.temperature_2m,
          windKmh: json.current.wind_speed_10m,
          description: WMO_CODES[json.current.weather_code] || 'Unknown',
          source: 'Open-Meteo'
        }
      };
    }
    res.json({ ...weatherCache.data, fetchedAt: new Date(weatherCache.time).toISOString(), stale: false });
  } catch (err) {
    console.error(err);
    if (weatherCache.data) {
      return res.json({ ...weatherCache.data, fetchedAt: new Date(weatherCache.time).toISOString(), stale: true });
    }
    res.status(502).json({ error: 'Weather service is unreachable right now.' });
  }
});

const PUBLIC_DIR = path.join(__dirname);
app.use(express.static(PUBLIC_DIR));

app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.listen(PORT, () => console.log(`Robot fleet dashboard running on http://localhost:${PORT}`));
