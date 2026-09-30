// Simulates a small warehouse robot fleet: movement toward assigned tasks,
// battery drain and auto-return-to-charge, and an alert log. No physical
// robots or hardware are involved — this models what a fleet manager's
// telemetry feed would look like so the dashboard has something real to show.

const WORLD = { width: 900, height: 500 };
const CHARGE_STATION = { x: 40, y: 460 };
const SPEED = 9;            // units per tick while moving
const LOW_BATTERY = 15;     // % that triggers auto-return-to-charge
const FULL_BATTERY = 95;    // % considered "charged enough" to resume

const ROBOT_NAMES = ['Atlas-1', 'Atlas-2', 'Scout-A', 'Scout-B', 'Hauler-1', 'Hauler-2'];

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

class FleetEngine {
  constructor() {
    this.robots = ROBOT_NAMES.map((name, i) => ({
      id: 'r' + (i + 1),
      name,
      x: CHARGE_STATION.x + 30 + (i % 3) * 60,
      y: CHARGE_STATION.y - Math.floor(i / 3) * 50,
      battery: 70 + Math.round(Math.random() * 25),
      status: 'idle',       // idle | moving | working | returning | charging
      target: null,         // { x, y, label }
      workTicksLeft: 0
    }));
    this.alerts = [];
    this.tick = 0;
  }

  log(message, level = 'info') {
    this.alerts.unshift({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, time: new Date().toISOString(), message, level });
    if (this.alerts.length > 40) this.alerts.length = 40;
  }

  assignTask(robotId, x, y, label) {
    const robot = this.robots.find(r => r.id === robotId);
    if (!robot) return { error: 'Robot not found.' };
    if (x < 0 || x > WORLD.width || y < 0 || y > WORLD.height) return { error: 'Target is outside the warehouse floor.' };
    if (robot.status === 'charging' && robot.battery < FULL_BATTERY) {
      return { error: `${robot.name} is charging (${robot.battery}%) and will resume once above ${FULL_BATTERY}%.` };
    }
    robot.target = { x, y, label: label || 'Task' };
    robot.status = 'moving';
    robot.workTicksLeft = 0;
    this.log(`${robot.name} dispatched to "${robot.target.label}".`, 'info');
    return { robot };
  }

  step() {
    this.tick++;
    for (const r of this.robots) {
      if (r.status === 'charging') {
        r.battery = Math.min(100, r.battery + 0.9);
        if (r.battery >= FULL_BATTERY) {
          r.status = 'idle';
          this.log(`${r.name} finished charging (${Math.round(r.battery)}%) and is ready for tasks.`, 'success');
        }
        continue;
      }

      // Auto-return-to-charge overrides any in-progress task
      if (r.battery <= LOW_BATTERY && r.status !== 'returning') {
        r.status = 'returning';
        r.target = { x: CHARGE_STATION.x, y: CHARGE_STATION.y, label: 'Charging station' };
        this.log(`${r.name} battery low (${Math.round(r.battery)}%) — returning to charge.`, 'warning');
      }

      if (r.status === 'moving' || r.status === 'returning') {
        const d = dist(r, r.target);
        if (d <= SPEED) {
          r.x = r.target.x; r.y = r.target.y;
          if (r.status === 'returning') {
            r.status = 'charging';
            this.log(`${r.name} docked at the charging station.`, 'info');
          } else {
            r.status = 'working';
            r.workTicksLeft = 2 + Math.floor(Math.random() * 3);
          }
        } else {
          r.x += (r.target.x - r.x) / d * SPEED;
          r.y += (r.target.y - r.y) / d * SPEED;
          r.battery = Math.max(0, r.battery - 0.15);
        }
      } else if (r.status === 'working') {
        r.battery = Math.max(0, r.battery - 0.1);
        r.workTicksLeft--;
        if (r.workTicksLeft <= 0) {
          const label = r.target ? r.target.label : 'task';
          this.log(`${r.name} completed "${label}".`, 'success');
          r.status = 'idle';
          r.target = null;
        }
      } else {
        // idle
        r.battery = Math.max(0, r.battery - 0.02);
      }
    }
  }

  state() {
    return {
      tick: this.tick,
      world: WORLD,
      chargeStation: CHARGE_STATION,
      robots: this.robots.map(r => ({
        id: r.id, name: r.name, x: Math.round(r.x), y: Math.round(r.y),
        battery: Math.round(r.battery * 10) / 10, status: r.status,
        target: r.target ? { x: r.target.x, y: r.target.y, label: r.target.label } : null
      }))
    };
  }
}

module.exports = { FleetEngine, WORLD, CHARGE_STATION };
