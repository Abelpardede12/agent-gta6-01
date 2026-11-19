// The jobs: a fixer called Vex texts the player timed checkpoint runs across the city.
// Reach the beacon before the clock runs out and the cash is yours; chain jobs without
// failing one and the pay climbs. Fail the clock and the streak resets, but the city keeps
// offering work — there is always another run.

import { MISSION } from './config.js';
import { randomRoadPoint } from './city.js';
import { pick } from './random.js';

const JOB_NAMES = [
  'Pier Run', 'Downtown Dash', 'Beach Blitz', 'Sunset Sprint', 'Harbor Haul',
  'Neon Nights', 'Palm Court Pickup', 'Rooftop Relay', 'Boardwalk Bolt', 'Keys Caper',
];

const VEX_LINES = [
  'Vex: Package at the marker. Fast feet, faster wheels.',
  'Vex: Client is waiting. Don\'t keep them waiting.',
  'Vex: Take the back streets if the heat is on you.',
  'Vex: This one pays well. Don\'t scratch the paint.',
  'Vex: Clock\'s ticking, Keys. Move.',
];

export function createMissions(rng, city) {
  return {
    rng,
    city,
    active: null,
    cooldown: MISSION.firstCooldown,
    streak: 0,
    total: 0,
    bestStreak: 0,
    line: '',
  };
}

function startMission(missions, player) {
  const spot = randomRoadPoint(
    missions.rng, player.x, player.y, 480, 1050,
  );
  const dist = Math.hypot(spot.x - player.x, spot.y - player.y);
  const timeLimit = Math.max(
    MISSION.minTime,
    Math.min(MISSION.maxTime, dist / 26 + 14 - missions.streak * 1.5),
  );
  missions.active = {
    x: spot.x,
    y: spot.y,
    timeLeft: timeLimit,
    total: timeLimit,
    reward: MISSION.baseReward + missions.streak * MISSION.streakBonus,
    name: pick(missions.rng, JOB_NAMES),
  };
  missions.line = pick(missions.rng, VEX_LINES);
  return missions.active;
}

export function stepMissions(missions, dt, player, events) {
  if (!missions.active) {
    missions.cooldown -= dt;
    if (missions.cooldown <= 0) {
      const job = startMission(missions, player);
      events.push({ type: 'mission-start', job, line: missions.line });
    }
    return;
  }
  const job = missions.active;
  job.timeLeft -= dt;
  const dist = Math.hypot(job.x - player.x, job.y - player.y);
  if (dist < MISSION.reachRadius) {
    missions.streak += 1;
    missions.total += 1;
    missions.bestStreak = Math.max(missions.bestStreak, missions.streak);
    events.push({ type: 'mission-done', job, streak: missions.streak });
    missions.active = null;
    missions.cooldown = 3.5;
    return;
  }
  if (job.timeLeft <= 0) {
    events.push({ type: 'mission-failed', job });
    missions.streak = 0;
    missions.active = null;
    missions.cooldown = MISSION.failCooldown;
  }
}

/** A job's pay, for the HUD's mission line. */
export function missionReward(missions) {
  return MISSION.baseReward + missions.streak * MISSION.streakBonus;
}
