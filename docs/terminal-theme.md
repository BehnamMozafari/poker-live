# Themes: Quote (default) + Terminal

Decided 2026-10-22 after grilling. Quote = today's look, unchanged and still the default. Terminal = a late-night AMOLED terminal for the SWE/quant crowd: same app, same data, same TV sizing, rearranged into tmux panes.

## Mock (TV, live board)

```
dealer@felt:~/nights$ ./live --night thursday █                    uptime 2h14m   21:04
┌─ quote ─────────────────────────────────────────────────────────────────────────────┐
│ in_play                                                  ▁▁▂▂▂▃▃▅▅▅▅▆▆▇▇▇█ ┐       │
│ $450                                                                       │ [t=21:04 px=$450]
│ open 19:02 │ high $450 │ volume $900 │ seated 6/7                                   │
└─────────────────────────────────────────────────────────────────────────────────────┘
┌─ positions ─────────────────────────────────────────────────────────────────────────┐
│ ▚▞▚  alex           █████ ██          rebuys ×6               money_in   $350      │
│ [AL] in_since 19:04                                                                 │
│ ▞▚▞  sam            ██                                         net_pnl   +$120     │
│ [SA] exit 0 · cashed_out $220                                                       │
└─────────────────────────────────────────────────────────────────────────────────────┘
[poker] 0:board* 1:leaders 2:facts │ most rebuys: alex · 6 │ all-time #1 … │ ⏱ armed  21:04
```

## Look
- **Palette:** `--bg: #000` (true black, AMOLED). Phosphor green `#39ff88` = system colour (prompt, cursor, LIVE, focus, primary). Bloomberg amber `#ffb000` = pane titles, labels, kickers. P&L stays green/red. Player chip colours stay (`ink()`), because the room finds people by colour.
- **Type:** SF Mono everywhere. In `[data-theme=terminal]`, `--sans` is set to the mono stack, so every existing rule follows. No font files, and it works offline.
- **Screen:** scanlines (a repeating-linear-gradient on `.ambient::after`), a soft phosphor `text-shadow` on fg text, and a vignette. Blinking `█` after the prompt and the logo. RGB-split glitch (red/cyan text-shadow offsets, ~300ms) only on events: buy-in, cash-out, timer alarm. No flicker or curvature (tiring over 4 hours, and curvature crops the edges).
- **Cursor:** the ring becomes a square bracket box `[ ]` (radius 0) that swells over clickables.
- **Text:** lowercase names (CSS `text-transform`), lowercase snake_case labels (`money_in`, `net_pnl`, `in_since`), money `+$120` with an explicit sign and no cents. Done with a one-line `lbl()` helper, only where a label shows on the TV.
- **Burn-in:** the stage drift stays. Pane borders sit at low opacity because they are static for hours.

## Layout (tmux)
- **Header → shell prompt:** `dealer@felt:~/nights$ ./live --night thursday █`, with `uptime 2h14m  21:04` on the right. With no night, it reads `~$ █`.
- **Quote → htop-style top pane:** the big price stays (mono, green glow). Stats become one line: `open 19:02 │ high $450 │ volume $900 │ seated 6/7`.
- **Panels → panes:** `main.panel` gets `data-title` (`positions`, `leaderboard`, `story`, `results`, `settle`), drawn as a fieldset-style title notched into a 1px border.
- **Ticker → tmux status line:** `[poker] 0:board* 1:leaders 2:facts` on the left (the idle rotation shown as windows, `*` = current), the same scrolling facts in the middle, `⏱ armed` (when the secret timer is set; never the time left) and the clock on the right.
- **Dock → vim command line:** `:` prompt, then `[+player] [undo] [log] [end]…` as bracketed text buttons. The primary button is reverse video. Icons are hidden.
- **Sheets → windows:** title bar `┌─ settings ───[x]┐`, inputs prefixed `>`, buttons `[ enter ] confirm`, primary reverse video, `h3` → `# section` comment style.

## Components
| Quote | Terminal |
|---|---|
| Ring avatar | 5×5 GitHub-style identicon in the player's colour, generated from the name so it never changes (board, toast, final, seats); `[AL]` in dense lists (log, history, settings roster, pills) |
| SVG chip stack | `█` per buy-in, in groups of five (`█████ ██`); a new block types in with a key tick |
| Toast card | `stdout` box at top right: `> alex.rebuy($50)  // 7th rebuy  [ OK ]` types out (CSS `steps()` on `ch` width, exact in mono), then holds and fades. Cash-out: `[ EXIT 0 ] +$120` green / `[ EXIT 1 ] −$60` red |
| Row light sweep | Reverse video: the row fills with the player's colour and black text, then fades, plus the glitch |
| Step chart | Same SVG: green line with a glow filter, dotted grid, readout `[t=21:04 px=$450]` |
| Leader trend line | Text sparkline `▁▂▃▅▇▆█` |
| Odds bar | Segmented block bar (repeating gradient, 1ch cells) that fills live, `67.3%` |
| Seats oval | Dashed green oval; seats as identicon + `alex`; dealer = `[D]` |
| Confetti | Matrix rain (canvas) in the winner's colour, 5s |
| Timer alarm toast | `!! SIGALRM` box, whole-stage glitch, klaxon |

## Ambience
- **Base:** pure black. A full-screen grid of faint `·` on a canvas. Near the cursor, characters step up by distance `· : + * #` (the ASCII take on the lit dot grid). It redraws only when the mouse moves and fades out on sleep.
- **Random bits (one every 2.5–7.5s, as now):**
  - `tail -f`: 3–5 faint log lines typing out at the edges, built from real names and events (`[21:03:44] POST /alex/rebuy 200 OK 12ms`).
  - Monte Carlo fan: 20 random walks from one point (reuses `walk()`), drawn together, coloured win/loss by end value, then fading.
  - Order book: a small bid/ask depth ladder (amber/green numbers) flickering for ~6s, then fading.
  - Streak: kept, retinted green.
- **Events:** a cash-out of at least 2× the player's money in triggers 5s of matrix rain in their colour.

## Big moments
- **Boot:** the home screen types a boot log (~2s): `poker-live v1.0 (tty1)`, `mounting history.json … 3 nights OK`, `loading 7 players … OK`, `starting jazz.service … OK`. Then a figlet `POKER LIVE` (5×5 pixel font rendered in `█`, with a `░` drop shadow) and `[ enter ] start tonight's game █`. Enter on home opens New night. Switching to Terminal in Settings plays the boot as a full-screen overlay. Any key or click skips it.
- **End of night:**
  1. `compiling results… [███████░░░] 72%` fills over the drumroll.
  2. Rows reveal bottom-up with a decrypt scramble: random glyphs settle into the name and number (~600ms per row).
  3. The winner's name as a figlet banner above the table, plus matrix rain in their colour.
  4. Payments as a diff: `- alex   $40  →  + sam`, with red `-` and green `+`.

## Sound
The jazz stays the same in both themes. In Terminal, `sfx` routes to terminal versions:
- buy-in: two rising square bleeps; rebuy: three.
- cash-out: modem chirp (FM sweep + noise burst).
- drumroll: fast square ticks rising in pitch.
- crash/alarm: klaxon (saw, two tones alternating 3×).
- tick + new `type(n)`: mechanical key clicks (short highpass noise), used by typed toasts, boot and decrypt.

## Implementation
**Files:** two new: `src/Term.tsx` (terminal-only pieces) and `src/terminal.css` (everything scoped under `[data-theme='terminal']`, imported after `index.css`). Quote's CSS is untouched.

1. **Plumbing.** `Settings.theme: 'quote' | 'terminal'`, default `'quote'` in `DEFAULTS` (`restore()` fills it in for old saves and backups). `App` sets `document.documentElement.dataset.theme` and provides `Skin` context (`createContext(false)`, true = terminal). Settings gets a `Seg` `Quote | Terminal` as its first section, `# theme`. `audio.ts` gets `setSkin()`, so `sfx` picks the terminal sound when one exists. *Check: switching flips tokens and fonts live, and an old backup imports as Quote.*
2. **Tokens + screen.** `terminal.css`: palette, `--sans` → mono, radius 0, glow, scanlines, vignette, square cursor, glitch keyframes, reverse-video flash. *Most of the look lands here with zero JS.*
3. **Layout.** Prompt header, htop quote line, pane titles (`data-title` on `main`), tmux status (`Ticker` gets `tabs`/`cur`), vim dock, window sheets, `lbl()` labels.
4. **Components.** `Identicon` (5×5 mirrored from a name hash) and `[AL]` inside `Avatar` (an `Avatar` prop picks the dense form), `Blocks` inside `Stack`, typed `Toast`, text `Trend`, chart/odds/seats styling.
5. **Ambience.** `CharGrid` canvas, plus the new bits in `Ambient` keyed on `Skin` (tail, fan, book).
6. **Big moments.** `Figlet` (pixel font as hex rows), `Boot` (home + overlay on switch), `Scramble` hook, `MatrixRain` canvas, compile bar, diff payments, big-cash-out rain, alarm glitch.
7. **Sound.** Terminal `sounds` + `type(n)`.
8. **Check + docs.** `src/term.test.ts`: every figlet glyph has 5 rows of the same width, identicons are deterministic and mirror-symmetric, sparkline maps min/max to `▁`/`█`. Browser pass on port 5198 at TV size in both themes. `docs/plan.md` updated.

**Reduced motion:** the existing CSS rule covers animations. The canvases (rain, char grid) and the typing/scramble effects check `prefers-reduced-motion` and render the final state.

**Skipped:** a second music engine for Terminal (the jazz plays in both); more themes (the `Skin` context becomes a string when a third one lands).
