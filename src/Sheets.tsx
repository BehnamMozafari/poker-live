import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CHIPS, DEFAULTS, ink, usd, cents, clock, uid, nightName, lines, live, ended, leaderboard, profitSeries, payments, parse, type Data, type Mut, type Who, type Session, type Settings } from './data.ts'
import { split } from './settle.ts'
import { Avatar, vars } from './Board.tsx'

type P = { data: Data; mut: Mut; who: Who; onClose: () => void }

function Sheet({ title, onClose, wide, children }: { title: ReactNode; onClose: () => void; wide?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (!ref.current?.open) ref.current?.showModal()
  }, [])
  return (
    <dialog ref={ref} className={wide ? 'sheet wide' : 'sheet'} onClose={onClose} onClick={e => e.target === ref.current && onClose()}>
      <div className="sheet-in">
        <header>
          <h2>{title}</h2>
          <button className="x" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        {children}
      </div>
    </dialog>
  )
}

const chipStyle = (c: string) => vars({ '--face': CHIPS[c][0], '--edge': CHIPS[c][1] })
const ChipDot = ({ color }: { color: string }) => <i className="dot" style={chipStyle(color)} />
const BTN_CHIPS = ['green', 'red', 'black', 'blue', 'purple']

function Swatches({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="swatches">
      {Object.keys(CHIPS).map(k => (
        <button type="button" key={k} title={k} aria-label={k} className={`dot${k === value ? ' on' : ''}`} style={chipStyle(k)} onClick={() => onChange(k)} />
      ))}
    </div>
  )
}

function Money({ value, onChange }: { value: number; onChange: (c: number) => void }) {
  const [v, setV] = useState(value ? String(value / 100) : '')
  return (
    <span className="money-in">
      $<input inputMode="decimal" value={v} onChange={e => (setV(e.target.value), onChange(cents(e.target.value)))} />
    </span>
  )
}

function NewPlayer({ data, mut, label, onAdd }: { data: Data; mut: Mut; label: string; onAdd: (id: string) => void }) {
  const used = new Set(data.players.map(p => p.color))
  const [name, setName] = useState('')
  const [color, setColor] = useState<string>()
  const c = color ?? Object.keys(CHIPS).find(k => !used.has(k)) ?? 'gray'
  return (
    <form
      className="newp"
      onSubmit={e => {
        e.preventDefault()
        if (!name.trim()) return
        const id = uid()
        mut(d => void d.players.push({ id, name: name.trim(), color: c }))
        setName('')
        setColor(undefined)
        onAdd(id)
      }}
    >
      <input placeholder="New player" value={name} maxLength={16} onChange={e => setName(e.target.value)} />
      <Swatches value={c} onChange={setColor} />
      <button className="btn">{label}</button>
    </form>
  )
}

const amounts = (s: Settings, extra: number) => [...new Set([...s.buyIns, extra])].filter(Boolean).sort((a, b) => a - b)

export function PlayerSheet({ data, mut, who, onClose, id }: P & { id: string }) {
  const night = live(data)!, l = lines(night).find(l => l.id === id), p = who(id)
  const { denoms } = data.settings
  const [custom, setCustom] = useState('')
  const [counts, setCounts] = useState<Record<string, string>>({})
  const [typed, setTyped] = useState<string | null>(null)
  const chipTotal = Object.entries(counts).reduce((s, [c, n]) => s + (parseInt(n) || 0) * (denoms[c] ?? 0), 0)
  const out = typed !== null ? cents(typed) : chipTotal
  const act = (type: 'buyin' | 'cashout', c: number) => {
    if (c <= 0 && type === 'buyin') return
    mut(d => void live(d)!.events.push({ t: Date.now(), type, player: id, cents: c }))
    onClose()
  }
  return (
    <Sheet
      title={
        <>
          <Avatar p={p} />
          {p.name}
        </>
      }
      onClose={onClose}
    >
      {l && (
        <p className="stats">
          In <b>{usd(l.in)}</b> · {l.rebuys} rebuy{l.rebuys === 1 ? '' : 's'}
          {l.out > 0 && <> · out {usd(l.out)}</>}
        </p>
      )}
      <h3>{!l ? 'Buy in' : l.seated ? 'Rebuy' : 'Back in'}</h3>
      <div className="chips-row">
        {amounts(data.settings, night.defaultBuyIn).map((c, i) => (
          <button key={c} className={`chipbtn${c === night.defaultBuyIn ? ' def' : ''}`} style={chipStyle(BTN_CHIPS[i % 5])} onClick={() => act('buyin', c)}>
            {usd(c)}
          </button>
        ))}
        <form className="custom" onSubmit={e => (e.preventDefault(), act('buyin', cents(custom)))}>
          <span className="money-in">
            $<input inputMode="decimal" placeholder="Other" value={custom} onChange={e => setCustom(e.target.value)} />
          </span>
          <button className="btn">Add</button>
        </form>
      </div>
      {l?.seated && (
        <>
          <h3>Cash out</h3>
          <div className="counter">
            {Object.entries(denoms)
              .filter(([c, v]) => v > 0 && c in CHIPS)
              .map(([c, v]) => (
                <label key={c} className="count">
                  <ChipDot color={c} />
                  <span>{usd(v)} ×</span>
                  <input inputMode="numeric" placeholder="0" value={counts[c] ?? ''} onChange={e => (setCounts({ ...counts, [c]: e.target.value }), setTyped(null))} />
                </label>
              ))}
          </div>
          <form className="cashout" onSubmit={e => (e.preventDefault(), act('cashout', out))}>
            <span className="money-in big">
              $<input inputMode="decimal" placeholder="0" aria-label="Cash-out total" value={typed ?? (chipTotal ? String(chipTotal / 100) : '')} onChange={e => setTyped(e.target.value)} />
            </span>
            <span className={`net num ${l.net + out >= 0 ? 'win' : 'loss'}`}>{usd(l.net + out, true)}</span>
            <button className="btn primary">Cash out {usd(out)}</button>
          </form>
        </>
      )}
    </Sheet>
  )
}

export function AddSheet({ data, mut, onClose }: P) {
  const night = live(data)!, seated = new Set(lines(night).map(l => l.id))
  const [amt, setAmt] = useState(night.defaultBuyIn)
  const seat = (id: string) => (mut(d => void live(d)!.events.push({ t: Date.now(), type: 'buyin', player: id, cents: amt })), onClose())
  const free = data.players.filter(p => !seated.has(p.id))
  return (
    <Sheet title="Add to the table" onClose={onClose}>
      <h3>Buy-in</h3>
      <Seg options={amounts(data.settings, night.defaultBuyIn).map(c => [c, usd(c)])} value={amt} onChange={setAmt} />
      {free.length > 0 && (
        <>
          <h3>Regulars</h3>
          <div className="pills">
            {free.map(p => (
              <button key={p.id} className="pill" onClick={() => seat(p.id)}>
                <Avatar p={p} />
                {p.name}
              </button>
            ))}
          </div>
        </>
      )}
      <h3>Someone new</h3>
      <NewPlayer data={data} mut={mut} label={`Add · ${usd(amt)}`} onAdd={seat} />
    </Sheet>
  )
}

function Seg<T>({ options, value, onChange }: { options: [T, ReactNode][]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map(([v, label], i) => (
        <button key={i} className={v === value ? 'on' : ''} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  )
}

export function NewNight({ data, mut, onClose }: P) {
  const last = ended(data).at(-1)
  const [name, setName] = useState(nightName())
  const [amt, setAmt] = useState(data.settings.defaultBuyIn)
  const [pick, setPick] = useState(() => new Set(last ? lines(last).map(l => l.id) : []))
  const toggle = (id: string) =>
    setPick(s => {
      const n = new Set(s)
      if (!n.delete(id)) n.add(id)
      return n
    })
  const start = () => {
    const t = Date.now()
    mut(d => void d.sessions.push({ id: uid(), name: name.trim() || nightName(), startedAt: t, defaultBuyIn: amt, events: [...pick].map((player, i) => ({ t: t + i, type: 'buyin', player, cents: amt })) }))
    onClose()
  }
  return (
    <Sheet title="New night" onClose={onClose}>
      <label className="field">
        Name
        <input value={name} onChange={e => setName(e.target.value)} />
      </label>
      <h3>Buy-in</h3>
      <Seg options={amounts(data.settings, data.settings.defaultBuyIn).map(c => [c, usd(c)])} value={amt} onChange={setAmt} />
      <h3>Who's playing?</h3>
      {data.players.length > 0 && (
        <div className="pills">
          {data.players.map(p => (
            <button key={p.id} className={`pill ${pick.has(p.id) ? 'on' : 'off'}`} onClick={() => toggle(p.id)}>
              <Avatar p={p} />
              {p.name}
            </button>
          ))}
        </div>
      )}
      <NewPlayer data={data} mut={mut} label="Add" onAdd={toggle} />
      <button className="btn primary big wide" onClick={start}>
        {pick.size ? `Deal them in · ${pick.size} × ${usd(amt)}` : 'Start night'}
      </button>
    </Sheet>
  )
}

const LABEL = { buyin: 'Buy-in', cashout: 'Cash out', adjust: 'Chip fix' }
export function LogSheet({ data, mut, who, onClose }: P) {
  const night = live(data)!
  return (
    <Sheet title="Tonight's log" onClose={onClose}>
      {night.events.length ? (
        <ul className="log">
          {night.events
            .map((e, i) => (
              <li key={`${e.t}-${i}`}>
                <time className="num">{clock(e.t)}</time>
                <Avatar p={who(e.player)} />
                <b>{who(e.player).name}</b>
                <span className="dim">{LABEL[e.type]}</span>
                <b className="num">{usd(e.cents, e.type === 'adjust')}</b>
                <button className="x" aria-label="Delete" onClick={() => mut(d => void live(d)!.events.splice(i, 1))}>
                  ✕
                </button>
              </li>
            ))
            .reverse()}
        </ul>
      ) : (
        <p className="dim">Nothing yet.</p>
      )}
    </Sheet>
  )
}

function Results({ s, who }: { s: Session; who: Who }) {
  return (
    <table className="tbl">
      <thead>
        <tr>
          <th>Player</th>
          <th className="n">In</th>
          <th className="n">Out</th>
          <th className="n">Net</th>
        </tr>
      </thead>
      <tbody>
        {lines(s)
          .sort((a, b) => b.net - a.net)
          .map(l => (
            <tr key={l.id}>
              <td>
                <span className="p">
                  <Avatar p={who(l.id)} />
                  {who(l.id).name}
                  {l.seated && <em className="tagx">at table</em>}
                </span>
              </td>
              <td className="n">{usd(l.in)}</td>
              <td className="n">{usd(l.out + l.adj)}</td>
              <td className={`n ${l.net >= 0 ? 'win' : 'loss'}`}>{l.seated ? '–' : usd(l.net, true)}</td>
            </tr>
          ))}
      </tbody>
    </table>
  )
}

function PayList({ s, who }: { s: Session; who: Who }) {
  const pays = payments(s)
  if (!pays.length) return <p className="dim">All square.</p>
  return (
    <ul className="paylist">
      {pays.map((p, i) => (
        <li key={i}>
          <span className="p">
            <Avatar p={who(p.from)} />
            {who(p.from).name}
          </span>
          <span className="dim">→</span>
          <span className="p">
            <Avatar p={who(p.to)} />
            {who(p.to).name}
          </span>
          <b className="num">{usd(p.cents)}</b>
        </li>
      ))}
    </ul>
  )
}

export function SettleSheet({ data, mut, who, onClose, onPick, onReveal }: P & { onPick: (id: string) => void; onReveal: () => void }) {
  const night = live(data)!, ls = lines(night), seated = ls.filter(l => l.seated)
  const diff = ls.reduce((a, l) => a + l.out + l.adj - l.in, 0) // + = more chips cashed out than bought
  const fix = () => {
    const unit = diff % 100 ? 1 : 100 // whole-dollar gaps split in whole dollars
    const adj = split(-diff / unit, Object.fromEntries(ls.map(l => [l.id, l.out])))
    const t = Date.now()
    mut(d => void live(d)!.events.push(...Object.entries(adj).filter(([, c]) => c).map(([player, c]) => ({ t, type: 'adjust' as const, player, cents: c * unit }))))
  }
  if (!ls.length)
    return (
      <Sheet title="End night" onClose={onClose}>
        <p className="dim">Nobody played tonight.</p>
        <button className="btn danger" onClick={() => (mut(d => void (d.sessions = d.sessions.filter(s => s.endedAt))), onClose())}>
          Discard this night
        </button>
      </Sheet>
    )
  return (
    <Sheet title="End night" wide onClose={onClose}>
      {seated.length > 0 && (
        <>
          <h3>Still at the table: cash them out</h3>
          <div className="pills">
            {seated.map(l => (
              <button key={l.id} className="pill" onClick={() => onPick(l.id)}>
                <Avatar p={who(l.id)} />
                {who(l.id).name}
                <span className="hi">Cash out →</span>
              </button>
            ))}
          </div>
        </>
      )}
      <h3>Tonight</h3>
      <Results s={night} who={who} />
      {!seated.length && diff !== 0 && (
        <div className="warn">
          <span>
            Chips don't add up: cash-outs are <b>{usd(Math.abs(diff))}</b> {diff > 0 ? 'more' : 'less'} than buy-ins.
          </span>
          <button className="btn" onClick={fix}>
            Split {usd(Math.abs(diff))} by cash-out
          </button>
        </div>
      )}
      {!seated.length && diff === 0 && (
        <>
          <h3>Settle up</h3>
          <div className="settle-mode">
            <Seg
              options={[
                [false, 'Fewest payments'],
                [true, 'Banker'],
              ]}
              value={!!night.banker}
              onChange={b =>
                mut(d => {
                  const s = live(d)!
                  s.banker = b
                  s.host ??= ls[0].id
                })
              }
            />
            {night.banker && (
              <select value={night.host} onChange={e => mut(d => void (live(d)!.host = e.target.value))} aria-label="Banker">
                {ls.map(l => (
                  <option key={l.id} value={l.id}>
                    {who(l.id).name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <PayList s={night} who={who} />
          <button className="btn primary big wide" onClick={onReveal}>
            Reveal results on the TV →
          </button>
        </>
      )}
    </Sheet>
  )
}

function Chart({ series, who, n }: { series: Record<string, number[]>; who: Who; n: number }) {
  const W = 720, H = 260, L = 56, Rt = 110, ids = Object.keys(series)
  const all = ids.flatMap(id => series[id]), lo = Math.min(0, ...all), hi = Math.max(0, ...all)
  const x = (i: number) => L + (n > 1 ? (i * (W - L - Rt)) / (n - 1) : (W - L - Rt) / 2)
  const y = (v: number) => 14 + (1 - (v - lo) / (hi - lo || 1)) * (H - 34)
  // end labels: push down so close finishers don't overprint
  const ends = ids.map(id => ({ id, y: y(series[id][n - 1]) })).sort((a, b) => a.y - b.y)
  ends.forEach((e, i) => i && (e.y = Math.max(e.y, ends[i - 1].y + 16)))
  const labelY = Object.fromEntries(ends.map(e => [e.id, e.y]))
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Running profit per player">
      <line x1={L} x2={W - Rt} y1={y(0)} y2={y(0)} className="zero" />
      {[hi, lo].map(v => (
        <text key={v} x={L - 8} y={y(v)} dy=".35em" className="axis" textAnchor="end">
          {usd(v, true)}
        </text>
      ))}
      {ids.map(id => {
        const c = ink(who(id).color), pts = series[id]
        return (
          <g key={id}>
            <polyline points={pts.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke={c} strokeWidth="2.5" strokeLinejoin="round" />
            <circle cx={x(n - 1)} cy={y(pts[n - 1])} r="4" fill={c} />
            <text x={x(n - 1) + 9} y={labelY[id]} dy=".35em" fill={c} className="lbl">
              {who(id).name}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export function HistorySheet({ data, mut, who, onClose }: P) {
  const nights = ended(data), lb = leaderboard(nights)
  const [open, setOpen] = useState<string>()
  return (
    <Sheet title="History" wide onClose={onClose}>
      {!nights.length ? (
        <p className="dim">No finished nights yet. Finish a night and it lands here.</p>
      ) : (
        <>
          <h3>All-time</h3>
          <table className="tbl">
            <thead>
              <tr>
                <th>Player</th>
                <th className="n">Nights</th>
                <th className="n">Best night</th>
                <th className="n">Streak</th>
                <th className="n">Net</th>
              </tr>
            </thead>
            <tbody>
              {lb.map(r => (
                <tr key={r.id}>
                  <td>
                    <span className="p">
                      <Avatar p={who(r.id)} />
                      {who(r.id).name}
                    </span>
                  </td>
                  <td className="n">{r.nights}</td>
                  <td className="n">{usd(r.best, true)}</td>
                  <td className="n">{r.streak > 1 ? `🔥 ${r.streak}` : '–'}</td>
                  <td className={`n ${r.net >= 0 ? 'win' : 'loss'}`}>{usd(r.net, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3>Running profit</h3>
          <Chart series={profitSeries(nights)} who={who} n={nights.length} />
          <h3>Nights</h3>
          <ul className="nights">
            {[...nights].reverse().map(s => {
              const ls = lines(s).sort((a, b) => b.net - a.net)
              return (
                <li key={s.id}>
                  <button className="night-head" onClick={() => setOpen(open === s.id ? undefined : s.id)} aria-expanded={open === s.id}>
                    <b>{s.name}</b>
                    <span className="dim">
                      {new Date(s.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {ls.length} players · {usd(ls.reduce((a, l) => a + l.in, 0))} in
                    </span>
                    {ls[0] && (
                      <span>
                        🏆 {who(ls[0].id).name} <span className="win">{usd(ls[0].net, true)}</span>
                      </span>
                    )}
                  </button>
                  {open === s.id && (
                    <div className="night-body">
                      <Results s={s} who={who} />
                      <PayList s={s} who={who} />
                      <button className="btn danger" onClick={() => confirm(`Delete ${s.name}? This can't be undone.`) && mut(d => void (d.sessions = d.sessions.filter(x => x.id !== s.id)))}>
                        Delete night
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </Sheet>
  )
}

function exportJson(d: Data) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' }))
  a.download = `poker-live-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export function SettingsSheet({ data, mut, onClose }: P) {
  const s = data.settings, used = new Set(data.sessions.flatMap(x => x.events.map(e => e.player)))
  const set = (fn: (s: Settings) => void) => mut(d => fn(d.settings))
  return (
    <Sheet title="Settings" wide onClose={onClose}>
      <h3>Money</h3>
      <div className="grid2">
        <label className="field">
          Default buy-in
          <Money value={s.defaultBuyIn} onChange={c => set(s => void (s.defaultBuyIn = c))} />
        </label>
        <div className="field">
          Rebuy buttons
          <span className="inline">
            {s.buyIns.map((c, i) => (
              <Money key={i} value={c} onChange={v => set(s => void (s.buyIns[i] = v))} />
            ))}
          </span>
        </div>
      </div>
      <h3>Chip values (for the cash-out counter, blank = not in your set)</h3>
      <div className="chipvals">
        {Object.keys(CHIPS).map(k => (
          <label key={k}>
            <ChipDot color={k} />
            <Money value={s.denoms[k] ?? 0} onChange={c => set(s => void (s.denoms[k] = c))} />
          </label>
        ))}
      </div>
      <h3>Players</h3>
      <ul className="roster">
        {data.players.map((p, i) => (
          <li key={p.id}>
            <Avatar p={p} />
            <input value={p.name} maxLength={16} aria-label="Name" onChange={e => mut(d => void (d.players[i].name = e.target.value))} />
            <Swatches value={p.color} onChange={c => mut(d => void (d.players[i].color = c))} />
            <button className="x" disabled={used.has(p.id)} title={used.has(p.id) ? 'Has played, kept for history' : 'Delete'} aria-label="Delete" onClick={() => mut(d => void d.players.splice(i, 1))}>
              ✕
            </button>
          </li>
        ))}
      </ul>
      <NewPlayer data={data} mut={mut} label="Add player" onAdd={() => {}} />
      <h3>Sound</h3>
      <div className="inline">
        <label className="check">
          <input type="checkbox" checked={s.music} onChange={e => set(s => void (s.music = e.target.checked))} /> Lo-fi jazz
        </label>
        <label className="check">
          Volume <input type="range" min={0} max={1} step={0.05} value={s.volume} onChange={e => set(s => void (s.volume = +e.target.value))} />
        </label>
      </div>
      <h3>Backup</h3>
      <div className="inline">
        <button className="btn" onClick={() => exportJson(data)}>
          Export JSON
        </button>
        <label className="btn">
          Import JSON
          <input
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async e => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f) return
              try {
                const d = parse(await f.text())
                if (confirm(`Replace everything here with ${d.players.length} players and ${d.sessions.length} nights from ${f.name}?`)) mut(x => void Object.assign(x, d, { settings: { ...DEFAULTS, ...d.settings } }))
              } catch (err) {
                alert(String(err))
              }
            }}
          />
        </label>
      </div>
    </Sheet>
  )
}
