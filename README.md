# Poker Live ♠

Home cash-game tracker shown on the TV: buy-ins, rebuys, cash-outs, settle-up and history, with generated jazz in the background.

**Live:** https://prakritd.github.io/poker-live/

```sh
npm install
npm start   # http://localhost:5199
npm test
```

`history.json` holds our game history; every browser gets the nights and players in it that it doesn't already have. Update it with Settings → Export JSON. Design notes: [docs/plan.md](docs/plan.md).
