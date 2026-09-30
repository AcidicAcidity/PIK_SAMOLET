import { useState } from 'react'

/**
 * Столбчатая диаграмма с накоплением.
 * data: [{ label, values: [n, n, ...] }], series: [{ name, color }]
 * Легенда всегда показана; при наведении — подсказка со значениями.
 */
export default function StackedBars({ data, series, height = 220, format = (v) => v, dark = false, horizontal = false }) {
  const [hover, setHover] = useState(null)
  if (!data?.length) return null
  const ink = dark ? 'rgba(255,255,255,.55)' : '#64748b'
  const grid = dark ? 'rgba(255,255,255,.08)' : '#ece9e3'
  const max = Math.max(...data.map((d) => d.values.reduce((s, v) => s + Number(v), 0))) || 1

  if (horizontal) {
    return (
      <div className="chart">
        <Legend series={series} />
        <div style={{ display: 'grid', gap: 14 }}>
          {data.map((d, i) => {
            const total = d.values.reduce((s, v) => s + Number(v), 0)
            return (
              <div key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} style={{ position: 'relative' }}>
                <div className="row-between small" style={{ marginBottom: 6 }}>
                  <span style={{ fontWeight: 600 }}>{d.label}</span>
                  <span className="muted">{format(total)}</span>
                </div>
                <div style={{ display: 'flex', gap: 2, height: 14, background: dark ? 'rgba(255,255,255,.06)' : '#f1efea', borderRadius: 4, overflow: 'hidden' }}>
                  {d.values.map((v, j) => Number(v) > 0 && (
                    <div key={j} style={{ width: `${(v / max) * 100}%`, background: series[j].color, borderRadius: j === d.values.length - 1 ? '0 4px 4px 0' : 0 }} />
                  ))}
                </div>
                {hover === i && <Tip d={d} series={series} format={format} style={{ left: '50%', top: -4 }} />}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const W = 640, H = height, padL = 8, padB = 26, padT = 10
  const bw = (W - padL) / data.length
  const barW = Math.max(4, Math.min(28, bw - 4))
  const ticks = [0.25, 0.5, 0.75, 1]
  const labelEvery = Math.ceil(data.length / 10)

  return (
    <div className="chart" onMouseLeave={() => setHover(null)}>
      <Legend series={series} />
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }} role="img" aria-label="Диаграмма">
        {ticks.map((t) => (
          <line key={t} x1={padL} x2={W} y1={padT + (H - padB - padT) * (1 - t)} y2={padT + (H - padB - padT) * (1 - t)} stroke={grid} strokeWidth="1" />
        ))}
        <line x1={padL} x2={W} y1={H - padB} y2={H - padB} stroke={grid} strokeWidth="1.5" />
        {data.map((d, i) => {
          let y = H - padB
          const x = padL + i * bw + (bw - barW) / 2
          const segs = d.values.map((v, j) => {
            const h = (Number(v) / max) * (H - padB - padT)
            y -= h
            const isTop = j === d.values.length - 1
            return <rect key={j} x={x} y={y} width={barW} height={Math.max(0, h - (j > 0 ? 2 : 0))} fill={series[j].color} rx={isTop ? 4 : 0} opacity={hover === null || hover === i ? 1 : 0.45} />
          })
          return (
            <g key={i}>
              {segs}
              <rect x={padL + i * bw} y={padT} width={bw} height={H - padB - padT} fill="transparent" onMouseEnter={() => setHover(i)} />
              {i % labelEvery === 0 && <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize="11" fill={ink}>{d.label}</text>}
            </g>
          )
        })}
      </svg>
      {hover !== null && (
        <Tip d={data[hover]} series={series} format={format}
          style={{ left: `${((padL + hover * bw + bw / 2) / W) * 100}%`, top: 24 }} />
      )}
    </div>
  )
}

function Legend({ series }) {
  return (
    <div className="chart-legend">
      {series.map((s) => <span key={s.name}><i style={{ background: s.color }} />{s.name}</span>)}
    </div>
  )
}

function Tip({ d, series, format, style }) {
  return (
    <div className="chart-tooltip" style={style}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{d.tipLabel || d.label}</div>
      {series.map((s, j) => (
        <div key={s.name} className="t-row">
          <span className="row" style={{ gap: 6 }}><i style={{ background: s.color }} />{s.name}</span>
          <b style={{ marginLeft: 12 }}>{format(d.values[j])}</b>
        </div>
      ))}
    </div>
  )
}
