# Sunset Keys

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Abelpardede12/agent-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Abelpardede12/agent-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original top-down open-city crime mini-game set in a fictional sun-soaked coastal city. Walk the streets, jack a car, dodge traffic, outrun the Keys PD under a wanted-star system, and run five timed drop missions for Vex the fixer — each one pays cash and raises the heat. Traffic, pedestrians, police chases, a minimap, synthesized sound, touch controls, and a local save are all in the game. Everything is original: no real places, people, brands, or borrowed assets.

## Controls

- **On foot:** WASD / arrow keys to walk · **E** enter / exit nearest car
- **Driving:** W accelerate · S brake / reverse · A / D steer · Space handbrake
- **P** pause · **M** mute
- **Touch:** left virtual stick to move / drive, E and BRK buttons

Stealing a car, hitting a pedestrian, or ramming a police cruiser raises your wanted level (0–5 stars). Cops chase and ram you; get caught on foot or boxed in and you're busted — you lose half your cash. Reach the golden beacon before the timer ends to bank each mission's reward.

## How to run

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. No build step, no network requests — the game is plain static files under `game/`.

## Files

- `game/index.html` — canvas + HUD + menus
- `game/src/main.js` — boot, game loop, state machine, save/load
- `game/src/city.js` — city generation (grid, buildings, beach, pier) and drawing
- `game/src/player.js` — on-foot + driving physics, carjacking, collisions
- `game/src/traffic.js` — traffic cars and pedestrians
- `game/src/police.js` — wanted system, police chase, busted / wasted
- `game/src/missions.js` — the five-mission chain from Vex
- `game/src/hud.js` — HUD, minimap, toasts, menus
- `game/src/audio.js` — synthesized WebAudio (engine, siren, chimes)
- `game/src/input.js` — keyboard + touch controls
- `game/src/shots.js` — screenshot staging (`?shot=drive|foot|chase|mission`)
- `main.ts` — entry program: copies `game/` + `screenshots/` and writes `dossier.json`

## License

MIT — see `LICENSE`.
