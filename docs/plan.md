# Poker Live: plan

A tracker for home cash games that runs on the TV in the background while we play.

## Decisions (made 2026-10-21, revised after grilling the same day)
- **Setup: laptop mirrored to the TV.** One window that everyone sees. No backend, and it works offline. Run with `npm start` (Vite on fixed port 5199; localStorage belongs to that origin, so the port must not change).
- **Format: cash games only.** Buy-ins, rebuys, cash-outs, settle-up and history. No tournament clock in v1.
- **Look: quiet dark, a little finance** (revised 2026-10-21, felt dropped): near-black with drifting aurora and grain, hairline tables, SF Pro + SF Mono labels (macOS system fonts), white primary buttons, colour only for players and green/red P&L. The night reads like a stock quote.
- **Themes** (added 2026-10-22): Settings picks Quote (the look above, default) or Terminal (AMOLED tmux/CRT skin for the SWE/quant crowd). Full design: `docs/terminal-theme.md`.
- **Chips:** each player owns a chip colour; their stack, avatar, row accent and chart line all use it.
- **Money:** $50 default buy-in; rebuy buttons $25/$50/$100 + custom (editable). Cash-out by chip counter per colour or by typing $.
- **Sound:** generated lo-fi jazz (Web Audio, no files) + chip/cash-out/drumroll SFX, music ducks under SFX. Every 8 bars a section rolls its own feel: key, tempo drift, swing, density, two-feel bass, lead voice (vibes/bell/Rhodes), plus tritone subs and stop-time breaks.
- **Payments:** shown, not tracked (no paid ticks).
- **Stack:** Vite + React + TS, the same as `~/projects/poker` (GTO Lab). Tests run with `node --test src/*.test.ts`.

## Architecture
- **One window, the board is the control.** Click a player row → action sheet (rebuy amounts, cash out). Moving the mouse shows a floating dock (+Player · Undo · Log · End night · History · Settings · music · fullscreen); 3s idle hides it and the cursor, and the ticker takes its slot. `⌘Z` undoes, `F` toggles fullscreen.
- **Idle rotation** (20s per panel, only while idle): live board → all-time leaderboard → tonight's facts. Any event or mouse move snaps back to the board.
- **State = an event log per night.** Totals, settle-up, history and stats are all calculated from it. Undo = remove the last event; the Log sheet deletes any event.
- **Storage:** localStorage plus a JSON export/import backup. Wake Lock keeps the laptop awake.
- **Money in integer cents everywhere.**

```ts
type Player  = { id: string; name: string; color: string }   // color = chip colour key
type Event   = { t: number; type: 'buyin' | 'cashout' | 'adjust'; player: string; cents: number }
type Session = { id: string; name: string; startedAt: number; endedAt?: number; defaultBuyIn: number; banker?: boolean; host?: string; events: Event[] }
```
A player is "at the table" from their first buy-in; their last buy-in/cash-out decides whether they're seated (cash out, come back, cash out again all work).

## Calculated values
- Per player: `in` = sum of buy-ins, `out` = sum of cash-outs, `net = out + adjust - in`. Rebuys = number of buy-ins minus 1.
- Money on the table = all buy-ins minus all cash-outs.
- **Chip mismatch** (cash-outs ≠ buy-ins at the end): show the difference and offer to split it in proportion to cash-outs, recorded as `adjust` events (largest remainder, whole dollars when the gap is whole dollars).

## Settle-up
- Fewest payments is NP-hard, and the usual biggest-loser-pays-biggest-winner shortcut can miss (losers $10/$3/$3, winners $6/$5/$5: the shortcut gives 5 payments, the best is 4).
- **Exact method:** a bitmask DP over the non-zero balances, finding the most groups that sum to zero; payments = n − groups. Within each group, the biggest-loser-pays-biggest-winner rule gives k−1 payments. Instant for 15 or fewer players.
- **Banker mode toggle:** everyone settles with the host.
- The test must include the $10/$3/$3 vs $6/$5/$5 case.

## TV (viewed from across the room)
- **Header:** a thin bar (brand / night name · LIVE + duration · clock), then the night as a quote: $ in play as the price, Open · High · Volume · Seated, and a step chart of money in play (hover for any moment).
- **Live board:** a positions table, one row per player (two columns past 8): ring avatar · name · chip stacks (one chip per buy-in, 5 to a stack) · rebuy count · $ in, or net once cashed out. The leaderboard adds a trend sparkline per player.
- **Toast** (top right) on each buy-in/rebuy/cash-out ("Alex · 7th rebuy · $50"), the row sweeps with light, and the new chip drops onto the stack.
- **Ambience:** dot grid lit around the cursor, a trailing ring cursor that swells over clickables, light following the cursor on rows/cards, a ping on click, and every few seconds a random background bit (a random-walk price line, a drifting suit, a ping, a streak).
- **End of night:** results revealed bottom-up, drumroll + confetti for the winner, then payments in big type, alternating.
- **Readability:** everything sized in rem off a 16:9 frame (`html { font-size: min(2vh, 1.125vw) }`), rows sized with container query units, `tabular-nums`.
- **OLED burn-in:** the whole stage drifts a few pixels over 15 minutes.

## Table tools (added 2026-10-22)
- **Type-to-find:** typing a letter on the board opens Add with that letter; Enter seats the top regular, opens tonight's player's sheet, or adds an unknown name as new. Lowercase `f` stays fullscreen.
- **Seats:** shuffles who's seated round an oval; the top seat has the button.
- **Timer:** secret countdown, normal(mean, stdev) minutes but never under min (Settings); alarm toast + crash, then re-rolls.
- **Odds:** heads-up all-in equity, exact (every runout), worked through in 30ms slices so the bar fills live.

## v1.1+ (not in v1)
- QR code per payment (Venmo pay link with the amount prefilled; check the link format first)
- Phone remote via QR + PeerJS
- Tournament clock
- Achievements
- Head-to-head stats

## Skipped
Accounts, backend, cloud sync. Add them when a second device needs to write data.
