import { StrictMode, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { load, save, live, ended, lines, facts, leaderboard, profitSeries, payments, usd, type Data, type Event, type Mut, type Who } from './data.ts'
import { unlock, setMusic, setVolume, sfx } from './audio.ts'
import { ChipDefs, Header, LiveBoard, Leaders, Facts, Ticker, Toast, Final, Home, Ambient } from './Board.tsx'
import { PlayerSheet, AddSheet, NewNight, LogSheet, SettleSheet, HistorySheet, SettingsSheet } from './Sheets.tsx'
import './index.css'

type SheetKind = 'add' | 'new' | 'log' | 'settle' | 'history' | 'settings'
type Open = { kind: 'player'; id: string; back?: SheetKind } | { kind: SheetKind } | null

const fullscreen = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {})

const T = ({ icon, label, on, primary, off }: { icon: string; label: string; on: () => void; primary?: boolean; off?: boolean }) => (
  <button className={primary ? 'tb primary' : 'tb'} onClick={on} disabled={off}>
    <i>{icon}</i>
    {label}
  </button>
)

function App() {
  const [data, setData] = useState(load)
  const [sheet, setSheet] = useState<Open>(null)
  const [final, setFinal] = useState(false)
  const [awake, setAwake] = useState(true)
  const [panel, setPanel] = useState(0)
  const [now, setNow] = useState(Date.now)
  const [third, setThird] = useState<Event>()
  const seen = useRef(Date.now())

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

  // A new event (never undo/delete) → toast + sound, and jump to the live board.
  // Several at once (dealing everyone in, chip fixes) get no toast.
  const last = night?.events.at(-1)
  const count = useRef(0)
  useEffect(() => {
    const added = (night?.events.length ?? 0) - count.current
    count.current = night?.events.length ?? 0
    if (!night || !last || last.t <= seen.current) return
    seen.current = last.t
    if (last.type === 'adjust' || added > 1) return
    setThird(last)
    setPanel(0)
    if (last.type === 'cashout') sfx.cashout()
    else sfx.buyin(lines(night).find(l => l.id === last.player)!.buyins > 1)
  }, [last])
  useEffect(() => {
    if (!third) return
    const t = setTimeout(() => setThird(undefined), 5200)
    return () => clearTimeout(t)
  }, [third])

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
    }
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  }, [])

  // Audio needs a user gesture; the host's first click starts it.
  useEffect(() => {
    const go = () => (unlock(), setMusic(load().settings.music))
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
            <LiveBoard night={night} who={who} flash={third?.player} onPick={id => setSheet({ kind: 'player', id })} />
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
              </>
            ) : (
              <T icon="♠" label="New night" primary on={() => setSheet({ kind: 'new' })} />
            )}
            <span className="sep" />
            <T icon="★" label="History" on={() => setSheet({ kind: 'history' })} />
            <T icon="⚙" label="Settings" on={() => setSheet({ kind: 'settings' })} />
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
      {third && night && <Toast key={third.t} e={third} line={lines(night).find(l => l.id === third.player)!} p={who(third.player)} />}
      {sheet?.kind === 'player' && night && <PlayerSheet key={sheet.id} {...props} id={sheet.id} />}
      {sheet?.kind === 'add' && night && <AddSheet {...props} />}
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
