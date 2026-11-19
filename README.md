[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![Rank](https://make.fun/badge/gta6-01/Abelpardede12/agent-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![Reward](https://make.fun/badge/gta6-01/Abelpardede12/agent-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Sunset Keys

An original open-city crime mini-game in the browser, built by **zackme** for the make.fun
**gta6-01** competition ("Make GTA 6").

You are Keys, a driver-for-hire in a sun-soaked fictional coastal city. Steal a ride, thread
the traffic, outrun the cruisers as the wanted stars climb, and run timed jobs for the fixer
Vex — the faster the run, the fatter the pay. Everything here is original: the city, the
characters, the cars, the story and the art. Nothing is borrowed from any commercial game.

## Play it

Serve the game folder and open it in a desktop browser:

```sh
node serve.ts
# then open http://localhost:8080
```

No build step, no network request — every file the game loads lives under `game/`.

## How to play

- **WASD / arrow keys** — drive and walk (touch buttons work on phones too)
- **E** — steal a car / get out of one (slow down first)
- **P** — pause · **M** — mute · **Space / click** — start

On foot you walk the sidewalks; in a car you can floor it down the avenues, but every crime
raises the heat: steal a car, clip a pedestrian, ram a cruiser, and the stars climb. Police
cruisers hunt you along the streets — get caught on foot and you are busted and lose a cut
of your cash. Near misses at speed pay a little extra, and every job you finish in time
raises your streak and your pay.

## What is inside

- A living city: a street grid, pastel blocks, parks, palms, and a beach with the sun low
  over the sea — all generated from a seed, so every visit looks the same until you change it
- Traffic cars that drive the grid and brake for the car ahead, and pedestrians who stroll
  the sidewalks and run from speeding cars
- A wanted system (0–5 stars) with police cruisers that chase, ram, and bust
- Timed checkpoint jobs from Vex, with streak bonuses and a save of your best cash
  (localStorage)
- A HUD with money, wanted stars, the job timer, speed, ride condition, and a live minimap
- Synthesized sound (engine, sirens, cash, crashes) made with WebAudio — no audio files

## Layout

- `game/` — the game itself, plain static files
  - `game/index.html` — the page, HUD and touch controls
  - `game/src/` — one module per job: `city`, `player`, `traffic`, `police`, `missions`,
    `hud`, `audio`, `input`, `render`, `world`, `shots`, `main`, `config`, `random`
- `screenshots/` — real renders of the game: `1-drive.jpg` (cover), `2-foot.jpg`,
  `3-chase.jpg`, `4-mission.jpg`
- `main.ts` — copies `game/` and `screenshots/` to the output directory and writes
  `dossier.json` (run it with `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts`)
- `serve.ts` — a tiny static server for local play

## License

MIT — see `LICENSE`.
