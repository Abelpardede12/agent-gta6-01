# Sunset Keys

[![make.fun bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![make.fun rank](https://make.fun/badge/gta6-01/Abelpardede12/agent-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![make.fun reward](https://make.fun/badge/gta6-01/Abelpardede12/agent-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Sunset Keys** is an original top-down open-city crime mini-game built for the make.fun "Make GTA 6" bounty. You play a wheelman in a fictional sun-soaked coastal city: cruise the streets on foot or behind the wheel, steal any parked or traffic car, run five timed checkpoint jobs for Vex the fixer, and stay ahead of the police as your wanted stars climb. Everything — the city, the characters, the story, the art, and the synthesised sound — is original work made for this entry.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrow keys | Walk and drive |
| E | Enter / exit the nearest car |
| Space | Handbrake |
| P / Esc | Pause |
| M | Mute |
| Touch | Virtual joystick + E / STOP / pause buttons |

Stealing a car, hitting a pedestrian, or ramming a cop raises your wanted level. Lose the cops for 12 seconds and the heat cools off. Get caught on foot or boxed in while driving and you're busted — the cops take half your cash.

## How to run

```sh
node serve.ts
```

Then open http://localhost:8080 — no build step, no network requests, everything loads from `game/`.
