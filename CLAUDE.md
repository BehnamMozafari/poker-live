# Poker Live

Home cash-game tracker shown on a TV mirrored from the laptop (Vite + React + TS, no backend). Design and decisions: `docs/plan.md`.

## Commands
- `npm start` = the real app on port 5199 (strict: localStorage lives on that origin). Test in the browser on another port (e.g. `npx vite --port 5198`) so test data never lands in the real history.
- `npm test` = `node --test src/*.test.ts`; `npm run build` = tsc + vite.

## Conventions
- Money is integer cents; format with `usd()` from `src/data.ts`. Everything is derived from the night's event log (`lines()`, `facts()`, `leaderboard()`, `payments()`); never store totals.
- State changes go through `mut(d => …)` (structuredClone + mutate) in `src/main.tsx`; it runs twice under StrictMode, so keep `uid()`/`Date.now()` outside it when the value must be stable.
- Player colour = chip colour key in `CHIPS` (face, edge, ink). Use `ink()` for coloured text/lines on the dark background.
- TV sizing: 1rem = 2% of a 16:9 frame. Board rows are size containers; cq units on a container's own padding/gap resolve against the viewport, hence `.row-in`.
- Deliberate shortcuts are marked `ponytail:`; keep code minimal.
