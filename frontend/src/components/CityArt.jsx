import { useMemo } from 'react'
import { seeded } from '../utils/format'

/** Смешивание двух hex-цветов */
function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16)
  const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t)
  const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t)
  const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t)
  return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)}`
}

/**
 * Процедурная иллюстрация жилого комплекса. Используется, когда нет фото.
 * variant: 'card' | 'hero' | 'night'
 */
export default function CityArt({ seed = 'x', color = '#f25c2b', variant = 'card', className = '' }) {
  const W = 800, H = variant === 'hero' ? 700 : 500
  const art = useMemo(() => {
    const rnd = seeded(seed)
    const ground = H - 70
    const back = []
    let x = -20
    while (x < W) {
      const w = 40 + rnd() * 70, h = 90 + rnd() * 170
      back.push({ x, w, h })
      x += w + 6
    }
    const front = []
    const count = variant === 'hero' ? 4 : 3 + Math.floor(rnd() * 2)
    const slot = W / count
    for (let i = 0; i < count; i++) {
      const w = slot * (0.52 + rnd() * 0.2)
      const h = (variant === 'hero' ? 330 : 190) + rnd() * (variant === 'hero' ? 230 : 160)
      front.push({ x: i * slot + (slot - w) / 2 + (rnd() - 0.5) * 30, w, h, floors: Math.floor(h / 22), cols: Math.max(3, Math.floor(w / 26)), lit: rnd() })
    }
    const trees = Array.from({ length: 14 }, (_, i) => ({ x: (i / 13) * W + (rnd() - 0.5) * 40, r: 16 + rnd() * 18 }))
    const windowsLit = Array.from({ length: 800 }, () => rnd())
    return { ground, back, front, trees, windowsLit, sunX: 140 + rnd() * 500 }
  }, [seed, variant, H])

  const night = variant === 'hero' || variant === 'night'
  const skyTop = night ? '#0d1b2a' : mix(color, '#ffffff', 0.78)
  const skyBottom = night ? mix('#0d1b2a', color, 0.35) : mix(color, '#ffffff', 0.94)
  const backColor = night ? mix('#0d1b2a', '#ffffff', 0.1) : mix(color, '#ffffff', 0.6)
  const bodyA = night ? '#1b2d44' : mix(color, '#0d1b2a', 0.15)
  const bodyB = night ? '#223754' : mix(color, '#ffffff', 0.12)
  const windowOff = night ? '#2c4262' : 'rgba(255,255,255,.55)'
  const windowOn = night ? '#ffd28a' : '#fff6e0'
  const id = `g${String(seed).replace(/\W/g, '')}${variant}`
  let wi = 0

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={skyTop} />
          <stop offset="1" stopColor={skyBottom} />
        </linearGradient>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={bodyB} />
          <stop offset="1" stopColor={bodyA} />
        </linearGradient>
        <radialGradient id={`${id}sun`}>
          <stop offset="0" stopColor={color} stopOpacity=".9" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${id}sky)`} />
      <circle cx={art.sunX} cy={H * 0.3} r={night ? 160 : 120} fill={`url(#${id}sun)`} opacity={night ? 0.55 : 0.35} />
      <circle cx={art.sunX} cy={H * 0.3} r={night ? 46 : 38} fill={color} opacity={night ? 1 : 0.85} />
      {night && Array.from({ length: 40 }, (_, i) => (
        <circle key={i} cx={(art.windowsLit[i] * W * 7) % W} cy={(art.windowsLit[i + 40] * H * 0.45)} r={art.windowsLit[i + 80] * 1.4 + 0.3} fill="#fff" opacity={0.25 + art.windowsLit[i + 120] * 0.5} />
      ))}
      {art.back.map((b, i) => (
        <rect key={i} x={b.x} y={art.ground - b.h} width={b.w} height={b.h} fill={backColor} opacity={night ? 0.8 : 0.7} />
      ))}
      {art.front.map((b, i) => {
        const top = art.ground - b.h
        const padX = 12, padY = 18
        const cw = (b.w - padX * 2) / b.cols
        const rows = Math.floor((b.h - padY - 20) / 22)
        return (
          <g key={i}>
            <rect x={b.x} y={top} width={b.w} height={b.h} fill={`url(#${id}b)`} />
            <rect x={b.x} y={top} width={b.w} height={8} fill={color} opacity={night ? 0.9 : 0.7} />
            <rect x={b.x + b.w - 10} y={top} width={10} height={b.h} fill="#000" opacity=".08" />
            {Array.from({ length: rows }).map((_, r) =>
              Array.from({ length: b.cols }).map((__, c) => {
                const on = art.windowsLit[wi++ % art.windowsLit.length] < (night ? 0.35 : 0.18)
                return <rect key={`${r}-${c}`} x={b.x + padX + c * cw + 3} y={top + padY + r * 22} width={cw - 6} height={12} rx="1.5" fill={on ? windowOn : windowOff} />
              }),
            )}
          </g>
        )
      })}
      <rect y={art.ground} width={W} height={H - art.ground} fill={night ? '#0b1624' : mix(color, '#0d1b2a', 0.55)} />
      <rect y={art.ground} width={W} height={6} fill={night ? '#1b2d44' : mix(color, '#ffffff', 0.3)} />
      {art.trees.map((t, i) => (
        <g key={i}>
          <rect x={t.x - 2} y={art.ground - 6} width={4} height={14} fill={night ? '#0b1624' : '#4b3b2a'} />
          <circle cx={t.x} cy={art.ground - t.r * 0.8} r={t.r} fill={night ? '#12324a' : '#2f7d4f'} opacity=".95" />
          <circle cx={t.x - t.r * 0.35} cy={art.ground - t.r * 1.05} r={t.r * 0.55} fill={night ? '#17405c' : '#3f9a63'} />
        </g>
      ))}
    </svg>
  )
}
