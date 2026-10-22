import { StrictMode, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { load, save, live, ended, facts, leaderboard, profitSeries, payments, announce, usd, roll, type News, type Mut, type Who } from './data.ts'
import { unlock, setMusic, setVolume, sfx } from './audio.ts'
import { vars, ChipDefs, Header, LiveBoard, Leaders, Facts, Ticker, Toast, Final, Home, Ambient } from './Board.tsx'
import { PlayerSheet, AddSheet, NewNight, LogSheet, SettleSheet, HistorySheet, SettingsSheet, SeatsSheet, EquitySheet } from './Sheets.tsx'
import './index.css'
import seed from '../history.json?raw'

type SheetKind = 'add' | 'new' | 'log' | 'settle' | 'history' | 'settings' | 'seats' | 'odds'
type Open = { kind: 'player'; id: string; back?: SheetKind } | { kind: SheetKind; q?: string } | null

const fullscreen = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {})

const T = ({ icon, label, on, primary, off }: { icon: string; label: string; on: () => void; primary?: boolean; off?: boolean }) => (
  <button className={primary ? 'tb primary' : 'tb'} onClick={on} disabled={off}>
    <i>{icon}</i>
    {label}
  </button>
)

function App() {
  const [data, setData] = useState(() => load(seed))
  const [sheet, setSheet] = useState<Open>(null)
  const [final, setFinal] = useState(false)
  const [awake, setAwake] = useState(true)
  const [panel, setPanel] = useState(0)
  const [now, setNow] = useState(Date.now)
  const [third, setThird] = useState<News>()
  const [due, setDue] = useState<number>() // hidden timer: when it next goes off
  const [alarm, setAlarm] = useState<number>()
  const latest = useRef(data) // for window listeners registered once
  latest.current = data

  const mut: Mut = fn => setData(d => { const n = structuredClone(d); fn(n); return n }) // prettier-ignore
  const byId = new Map(data.players.map(p => [p.id, p]))
  const who: Who = id => byId.get(id) ?? { id, name: '?', color: 'gray' }
  const night = live(data), history = ended(data)
  const undo = () => mut(d => void live(d)?.events.pop())

  useEffect(() => save(data), [data])
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 15e3)
    return () => clearInterval(i)
  }, [])

  // News → toast + sound, and jump to the live board.
  const prev = useRef(night)
  useEffect(() => {
    const n = announce(prev.current, night)
    prev.current = night
    if (!n) return
    setThird(n)
    setPanel(0)
    if (n.e.type === 'cashout') sfx.cashout()
    else sfx.buyin(n.line.buyins > 1)
  }, [night])
  useEffect(() => {
    if (!third) return
    const t = setTimeout(() => setThird(undefined), 5200)
    return () => clearTimeout(t)
  }, [third])

  useEffect(() => {
    if (!due) return
    if (!night) return setDue(undefined) // night over: the next one starts with the timer off
    const t = setTimeout(() => (sfx.crash(), setAlarm(Date.now()), setDue(Date.now() + roll(data.settings.timer))), due - Date.now())
    return () => clearTimeout(t)
  }, [due, !night])
  useEffect(() => {
    if (!alarm) return
    const t = setTimeout(() => setAlarm(undefined), 5200)
    return () => clearTimeout(t)
  }, [alarm])

  // Mouse/keys wake the controls; 3s idle hides them and the cursor, and starts the panel rotation.
  useEffect(() => {
    let t = 0
    const poke = () => {
      setAwake(true)
      setPanel(0)
      clearTimeout(t)
      t = setTimeout(() => setAwake(false), 3000)
    }
    const evs = ['pointermove', 'pointerdown', 'keydown']
    evs.forEach(e => addEventListener(e, poke))
    poke()
    return () => (evs.forEach(e => removeEventListener(e, poke)), clearTimeout(t))
  }, [])

  const tonight = night ? facts(night, now) : []
  const panels = (night ? ['board', history.length && 'leaders', tonight.length > 2 && 'facts'] : ['home', history.length && 'leaders']).filter(Boolean) as string[]
  const cur = panels[panel % panels.length]
  useEffect(() => {
    if (awake || sheet || final) return
    const t = setTimeout(() => setPanel(p => p + 1), 20e3)
    return () => clearTimeout(t)
  }, [awake, sheet, final, panel])

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as Element).closest?.('input, select, textarea')) return
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') e.preventDefault(), undo()
      else if (e.key === 'f' && !e.metaKey && !e.ctrlKey) fullscreen()
      // ponytail: lowercase f stays fullscreen, so a name starting with F needs Shift
      else if (/^[a-z]$/i.test(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey && live(latest.current)) e.preventDefault(), setSheet(s => s ?? { kind: 'add', q: e.key })
    }
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  }, [])

  // Audio needs a user gesture; the host's first click starts it.
  useEffect(() => {
    const go = () => (unlock(), setMusic(latest.current.settings.music))
    addEventListener('pointerdown', go, { once: true })
    return () => removeEventListener('pointerdown', go)
  }, [])
  useEffect(() => setMusic(data.settings.music), [data.settings.music])
  useEffect(() => setVolume(data.settings.volume), [data.settings.volume])

  // Keep the laptop (and so the TV) awake all night.
  useEffect(() => {
    const lock = () => document.visibilityState === 'visible' && navigator.wakeLock?.request('screen').catch(() => {})
    lock()
    document.addEventListener('visibilitychange', lock)
    return () => document.removeEventListener('visibilitychange', lock)
  }, [])

  const lb = leaderboard(history)
  const ticker = [
    ...tonight.map(f => `${f.k}: ${f.id ? who(f.id).name + ' · ' : ''}${f.v}`),
    ...lb.slice(0, 3).map((r, i) => `All-time #${i + 1}: ${who(r.id).name} ${usd(r.net, true)}`),
  ]
  const close = () => setSheet(s => (s?.kind === 'player' && s.back ? { kind: s.back } : null))
  const props = { data, mut, who, onClose: close }

  return (
    <div className={awake || sheet ? 'app' : 'app sleep'}>
      <ChipDefs />
      <Ambient />
      <div className="stage">
        <Header night={night} now={now} />
        <main key={final ? 'final' : cur} className="panel">
          {final && night ? (
            <Final night={night} who={who} pays={payments(night)} />
          ) : cur === 'board' && night ? (
            <LiveBoard night={night} who={who} flash={third?.e.player} onPick={id => setSheet({ kind: 'player', id })} />
          ) : cur === 'leaders' ? (
            <Leaders rows={lb} who={who} nights={history.length} series={profitSeries(history)} />
          ) : cur === 'facts' ? (
            <Facts items={tonight} who={who} />
          ) : (
            <Home onStart={() => setSheet({ kind: 'new' })} />
          )}
        </main>
        {awake || sheet ? (
          <nav className="toolbar">
            {night && final ? (
              <>
                <T icon="◀" label="Back" on={() => (setFinal(false), setSheet({ kind: 'settle' }))} />
                <T icon="✓" label="Finish & save night" primary on={() => (mut(d => void (live(d)!.endedAt = Date.now())), setFinal(false))} />
              </>
            ) : night ? (
              <>
                <T icon="＋" label="Player" on={() => setSheet({ kind: 'add' })} />
                <T icon="↶" label="Undo" on={undo} off={!night.events.length} />
                <T icon="☰" label="Log" on={() => setSheet({ kind: 'log' })} />
                <T icon="■" label="End night" on={() => setSheet({ kind: 'settle' })} />
                <span className="sep" />
                <T icon="⇄" label="Seats" on={() => setSheet({ kind: 'seats' })} />
                <T icon="⏱" label={due ? 'Stop timer' : 'Timer'} on={() => setDue(due ? undefined : Date.now() + roll(data.settings.timer))} />
              </>
            ) : (
              <T icon="♠" label="New night" primary on={() => setSheet({ kind: 'new' })} />
            )}
            <span className="sep" />
            <T icon="★" label="History" on={() => setSheet({ kind: 'history' })} />
            <T icon="⚙" label="Settings" on={() => setSheet({ kind: 'settings' })} />
            <T icon="%" label="Odds" on={() => setSheet({ kind: 'odds' })} />
            <span className="sep" />
            <button className={data.settings.music ? 'tb' : 'tb muted'} onClick={() => mut(d => void (d.settings.music = !d.settings.music))} aria-label="Toggle music">
              <i>♪</i>
              {data.settings.music ? 'Jazz' : 'Off'}
            </button>
            <input type="range" min={0} max={1} step={0.05} value={data.settings.volume} aria-label="Volume" onChange={e => mut(d => void (d.settings.volume = +e.target.value))} />
            <T icon="⛶" label="Full" on={fullscreen} />
          </nav>
        ) : (
          <Ticker tag={night ? 'Tonight' : 'Poker Live'} items={ticker.length ? ticker : ['Move the mouse for controls', 'Click a player to rebuy or cash out', '⌘Z undoes', 'F for fullscreen']} />
        )}
      </div>
      {third && <Toast key={third.e.t} {...third} p={who(third.e.player)} />}
      {sheet?.kind === 'player' && night && <PlayerSheet key={sheet.id} {...props} id={sheet.id} />}
      {alarm && (
        <div key={alarm} className="toast" style={vars({ '--c': 'var(--amber)' })}>
          <div>
            <small>Timer</small>
            <b>Time!</b>
            <span>Next one's a secret</span>
          </div>
        </div>
      )}
      {sheet?.kind === 'add' && night && <AddSheet {...props} q={sheet.q} onPick={id => setSheet({ kind: 'player', id })} />}
      {sheet?.kind === 'seats' && night && <SeatsSheet {...props} />}
      {sheet?.kind === 'odds' && <EquitySheet onClose={close} />}
      {sheet?.kind === 'new' && <NewNight {...props} />}
      {sheet?.kind === 'log' && night && <LogSheet {...props} />}
      {sheet?.kind === 'settle' && night && <SettleSheet {...props} onPick={id => setSheet({ kind: 'player', id, back: 'settle' })} onReveal={() => (setSheet(null), setFinal(true))} />}
      {sheet?.kind === 'history' && <HistorySheet {...props} />}
      {sheet?.kind === 'settings' && <SettingsSheet {...props} />}
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
