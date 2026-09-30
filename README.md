# Autonomous Robot Fleet Dashboard

A live dashboard for a simulated warehouse robot fleet — positions, battery, task dispatch, an alert log, and real weather for context.

**Stack:** HTML5 Canvas, CSS3, Bootstrap 5, JavaScript, Node.js, Express.js

## Features

- **6 simulated robots** moving on a warehouse floor, updated server-side every 1.5 seconds
- **Task dispatch:** select a robot in the table, click anywhere on the floor, and it drives there
- **Battery simulation:** drains while moving or idle, and each robot automatically returns to the charging station below 15% and resumes work above 95%
- **Alert log:** dispatches, completions, low-battery warnings and charge-complete events, newest first
- **Fleet stats:** total robots, active count, charging count, average battery
- **Live weather:** Johannesburg conditions from Open-Meteo, cached 10 minutes

## Why Open-Meteo instead of scraping a weather site

The original brief called for scraped weather data, but Open-Meteo provides the same information through a free, keyless, terms-of-service-friendly API — no HTML parsing, no risk of breaking when a site redesigns its page, no scraping policy to worry about. It's a straightforward swap that gets you real weather more reliably.

## Project structure

```
robot-fleet-dashboard/
├── server.js          Express server: fleet API, task endpoint, weather proxy
├── fleet-engine.js    Simulation: movement, battery, auto-charging, alert log
├── package.json
└── public/
    ├── index.html     Page markup
    ├── style.css      Styles
    └── app.js         Canvas rendering, polling, task dispatch, weather display
```

## Run locally

Requires Node.js 18 or newer.

```bash
npm install
npm start
```

Open http://localhost:3000

## How the simulation works

`fleet-engine.js` holds the whole fleet in memory and advances it once per tick (1.5s, set by `TICK_MS` in `server.js`):

- **idle** — battery drains slowly
- **moving** — heading to a manually assigned task, battery drains faster
- **working** — arrived, running the task for a few ticks
- **returning** — battery hit 15%, auto-overriding any task to head to the charging station
- **charging** — docked, battery rising; releases back to idle at 95%

Every state change writes a line to the alert log, capped at 40 entries.

## API

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/fleet` | Current tick, world size, charging station, and every robot's position/battery/status |
| GET | `/api/alerts` | Most recent 20 alert log entries |
| POST | `/api/robots/:id/task` | Dispatch a robot — body: `{ x, y, label }` |
| GET | `/api/weather` | Cached Johannesburg weather from Open-Meteo |

## Customise

- **Fleet size and names:** `ROBOT_NAMES` in `fleet-engine.js`
- **Speed, battery drain/charge rates, low-battery threshold:** the constants at the top of `fleet-engine.js`
- **Tick rate:** `TICK_MS` in `server.js`
- **Weather location:** `WEATHER_LAT` / `WEATHER_LON` in `server.js`

## Deploy to Render

1. Push the project to a GitHub repository.
2. Create a new **Web Service** on Render and connect the repository.
3. Set these options:
   - **Root directory:** the folder containing `server.js` and `package.json`
   - **Build command:** `npm install`
   - **Start command:** `npm start`
4. Deploy. Render sets the `PORT` variable automatically.

Note: the fleet state lives in server memory, so it resets on every restart or redeploy — there are no real robots to lose track of, but don't expect persistence across deploys.

## Troubleshooting

- **Blank page or "Cannot GET /":** check that `index.html`, `style.css` and `app.js` are inside a `public/` folder next to `server.js`.
- **Weather shows "unavailable":** Open-Meteo may be briefly unreachable; the dashboard falls back to the last cached reading when it can.
- **Nothing moves on the floor:** make sure a robot row is selected (it highlights gold) before clicking the floor.

## Ideas for next steps

- Swap polling for Socket.IO so updates push instead of poll
- A queue of multiple waypoints per robot instead of one task at a time
- Persist fleet state to a database so history survives restarts
