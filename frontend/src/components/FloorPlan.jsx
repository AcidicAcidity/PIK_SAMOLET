import { useMemo } from 'react'
import { seeded } from '../utils/format'

/**
 * Генератор схематичной планировки квартиры (SVG).
 * Если у квартиры загружено изображение планировки — показывается оно.
 */
const FILL = { living: '#fbece3', bed: '#f6efe6', kitchen: '#e7f1ec', bath: '#e5eef9', hall: '#f1efea' }
const WALL = '#1d2a3a'

export default function FloorPlan({ apartment, showLabels = true, className = '' }) {
  const a = apartment
  const plan = useMemo(() => build(a), [a?.id, a?.rooms, a?.area, a?.kitchen_area, a?.bathrooms, a?.balcony])
  if (a?.plan_image) return <img src={a.plan_image} alt={`Планировка квартиры ${a.number}`} className={className} />
  const { W, H, box, rooms, doors, windows, balcony } = plan
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-label={`Планировка: ${a?.rooms_label || ''}, ${a?.area} м²`}>
      {balcony && (
        <g>
          <rect x={balcony.x} y={balcony.y} width={balcony.w} height={balcony.h} fill="#fff" stroke={WALL} strokeWidth="2" strokeDasharray="0" rx="2" />
          <line x1={balcony.x + 4} y1={balcony.y + 4} x2={balcony.x + balcony.w - 4} y2={balcony.y + 4} stroke="#8fb8e6" strokeWidth="2" />
          {showLabels && <text x={balcony.x + balcony.w / 2} y={balcony.y + balcony.h / 2 + 4} textAnchor="middle" fontSize="9" fill="#64748b">Лоджия</text>}
        </g>
      )}
      {rooms.map((r, i) => (
        <g key={i}>
          <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={FILL[r.type]} />
          <Furniture r={r} />
        </g>
      ))}
      {/* внутренние стены */}
      {rooms.map((r, i) => (
        <rect key={`w${i}`} x={r.x} y={r.y} width={r.w} height={r.h} fill="none" stroke={WALL} strokeWidth="2.5" />
      ))}
      {/* внешний контур */}
      <rect x={box.x} y={box.y} width={box.w} height={box.h} fill="none" stroke={WALL} strokeWidth="7" strokeLinejoin="round" />
      {/* окна */}
      {windows.map((w, i) => (
        <g key={`o${i}`}>
          <rect x={w.x} y={w.y - 4} width={w.w} height={8} fill="#fff" />
          <line x1={w.x} y1={w.y - 2} x2={w.x + w.w} y2={w.y - 2} stroke="#6aa5e0" strokeWidth="1.5" />
          <line x1={w.x} y1={w.y + 2} x2={w.x + w.w} y2={w.y + 2} stroke="#6aa5e0" strokeWidth="1.5" />
        </g>
      ))}
      {/* дверные проёмы */}
      {doors.map((d, i) => {
        const dir = d.up ? -1 : 1
        return (
          <g key={`d${i}`}>
            <rect x={d.x} y={d.y - 4.5} width={d.w} height={9} fill={FILL[d.fill] || '#fff'} />
            <line x1={d.x} y1={d.y} x2={d.x} y2={d.y + dir * d.w} stroke="#475569" strokeWidth="1.5" />
            <path d={`M ${d.x + d.w} ${d.y} A ${d.w} ${d.w} 0 0 ${d.up ? 0 : 1} ${d.x} ${d.y + dir * d.w}`} fill="none" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 2" />
          </g>
        )
      })}
      {showLabels && rooms.map((r, i) => (
        <g key={`l${i}`} pointerEvents="none">
          <text x={r.x + r.w / 2} y={r.y + r.h / 2 - (r.h > 60 ? 2 : 0)} textAnchor="middle" fontSize={r.w < 70 ? 9 : 11} fontWeight="600" fill="#1d2a3a">{r.label}</text>
          {r.area && r.h > 44 && <text x={r.x + r.w / 2} y={r.y + r.h / 2 + 13} textAnchor="middle" fontSize="10" fill="#64748b">{r.area} м²</text>}
        </g>
      ))}
    </svg>
  )
}

function Furniture({ r }) {
  const s = { fill: 'none', stroke: '#c9c3b8', strokeWidth: 1.2 }
  if (r.type === 'bed' && r.w > 60 && r.h > 70) {
    const bw = Math.min(56, r.w * 0.5), bh = Math.min(66, r.h * 0.55)
    const x = r.x + r.w - bw - 10, y = r.y + 10
    return <g {...s}><rect x={x} y={y} width={bw} height={bh} rx="4" /><rect x={x + 5} y={y + 4} width={bw / 2 - 7} height={12} rx="3" /><rect x={x + bw / 2 + 2} y={y + 4} width={bw / 2 - 7} height={12} rx="3" /></g>
  }
  if (r.type === 'living' && r.w > 70 && r.h > 70) {
    const sw = Math.min(70, r.w * 0.55)
    const x = r.x + 10, y = r.y + r.h - 28
    return <g {...s}><rect x={x} y={y} width={sw} height={20} rx="5" /><rect x={x + 4} y={y - 16} width={sw * 0.5} height={12} rx="3" /></g>
  }
  if (r.type === 'kitchen' && r.w > 50) {
    const x = r.x + 6, y = r.y + r.h - 18
    return <g {...s}><rect x={x} y={y} width={r.w - 12} height={12} rx="2" /><circle cx={x + 14} cy={y + 6} r="3" /><circle cx={x + 24} cy={y + 6} r="3" /><circle cx={r.x + r.w / 2 + 10} cy={r.y + r.h / 2 - 10} r="11" /></g>
  }
  if (r.type === 'bath' && r.w > 34 && r.h > 40) {
    return <g {...s}><rect x={r.x + 5} y={r.y + 5} width={Math.min(22, r.w - 10)} height={Math.min(46, r.h - 10)} rx="8" /><circle cx={r.x + r.w - 12} cy={r.y + r.h - 12} r="6" /></g>
  }
  return null
}

function build(a) {
  const W = 400, H = 300
  const rnd = seeded(`${a?.id}-${a?.rooms}-${a?.area}`)
  const n = Number(a?.rooms ?? 1)
  const baths = Number(a?.bathrooms || 1)
  const total = Number(a?.area || 40)
  const kitchen = Number(a?.kitchen_area || (n ? 11 : 0))
  const living = Number(a?.living_area || total * 0.55)
  const hasBalcony = Boolean(a?.balcony)

  const box = { x: 24, y: hasBalcony ? 46 : 28, w: 352, h: hasBalcony ? 230 : 246 }
  const rooms = [], doors = [], windows = []
  const jitter = (v) => v * (0.92 + rnd() * 0.16)
  const fmt = (v) => (Math.round(v * 10) / 10).toLocaleString('ru-RU')

  const topH = Math.round(box.h * (n === 0 ? 1 : 0.58))
  const botY = box.y + topH, botH = box.h - topH

  if (n === 0) {
    const mainW = Math.round(box.w * jitter(0.64))
    rooms.push({ type: 'living', label: 'Кухня-гостиная', area: fmt(living + 4), x: box.x, y: box.y, w: mainW, h: box.h })
    const hallH = Math.round(box.h * 0.56)
    rooms.push({ type: 'hall', label: 'Прихожая', area: fmt(Math.max(total - living - 4 - 4, 3)), x: box.x + mainW, y: box.y, w: box.w - mainW, h: hallH })
    rooms.push({ type: 'bath', label: 'С/у', area: fmt(4), x: box.x + mainW, y: box.y + hallH, w: box.w - mainW, h: box.h - hallH })
    windows.push({ x: box.x + 30, y: box.y, w: mainW - 70 })
    doors.push({ x: box.x + mainW + 16, y: box.y + hallH, w: 24, up: false, fill: 'bath' })
  } else {
    // верхний ряд — жилые комнаты
    const topCount = Math.min(n, 3)
    const weights = Array.from({ length: topCount }, (_, i) => jitter(i === 0 ? 1.25 : 1))
    const sum = weights.reduce((s, w) => s + w, 0)
    let x = box.x
    weights.forEach((w, i) => {
      const rw = i === topCount - 1 ? box.x + box.w - x : Math.round((box.w * w) / sum)
      const isLiving = i === 0 && n >= 2
      const label = n === 1 ? 'Комната' : isLiving ? 'Гостиная' : 'Спальня'
      const share = (living / n) * (w / (sum / topCount))
      rooms.push({ type: isLiving ? 'living' : 'bed', label, area: fmt(share), x, y: box.y, w: rw, h: topH })
      windows.push({ x: x + rw * 0.22, y: box.y, w: rw * 0.56 })
      doors.push({ x: x + rw - 40, y: botY, w: 26, up: true, fill: isLiving ? 'living' : 'bed' })
      x += rw
    })
    // нижний ряд
    const parts = []
    if (n >= 4) parts.push({ type: 'bed', label: 'Спальня', k: 0.3, area: fmt(living / n) })
    parts.push({ type: 'kitchen', label: 'Кухня', k: n >= 4 ? 0.3 : 0.4, area: fmt(kitchen) })
    parts.push({ type: 'hall', label: 'Прихожая', k: n >= 4 ? 0.22 : 0.34, area: fmt(Math.max(total - living - kitchen - baths * 4.2, 3)) })
    parts.push({ type: 'bath', label: baths > 1 ? 'С/у' : 'Санузел', k: n >= 4 ? 0.18 : 0.26, area: fmt(4.2) })
    let bx = box.x
    parts.forEach((p, i) => {
      const rw = i === parts.length - 1 ? box.x + box.w - bx : Math.round(box.w * p.k)
      if (p.type === 'bath' && baths > 1) {
        rooms.push({ ...p, label: 'С/у', x: bx, y: botY, w: rw, h: botH / 2 })
        rooms.push({ ...p, label: 'С/у', x: bx, y: botY + botH / 2, w: rw, h: botH / 2 })
      } else {
        rooms.push({ ...p, x: bx, y: botY, w: rw, h: botH })
      }
      if (p.type === 'kitchen' || (p.type === 'bed' && n >= 4)) windows.push({ x: bx + rw * 0.25, y: box.y + box.h, w: rw * 0.5 })
      bx += rw
    })
    // вход в квартиру
    const hall = rooms.find((r) => r.type === 'hall')
    if (hall) doors.push({ x: hall.x + hall.w / 2 - 14, y: box.y + box.h, w: 28, up: true, fill: 'hall' })
  }

  const balcony = hasBalcony ? { x: box.x + box.w * 0.08, y: 14, w: box.w * (n === 0 ? 0.5 : 0.45), h: box.y - 14 - 3 } : null
  return { W, H, box, rooms, doors: doors.filter((d) => d.w > 0), windows, balcony }
}
