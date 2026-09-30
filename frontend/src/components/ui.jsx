import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, X } from 'lucide-react'
import { STATUS_BADGE } from '../utils/format'

export function Logo({ light = false }) {
  return (
    <Link to="/" className="logo" style={light ? { color: '#fff' } : undefined} aria-label="Новый Горизонт — на главную">
      <svg className="logo-mark" viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="16" fill={light ? '#fff' : '#0d1b2a'} />
        <circle cx="32" cy="38" r="12" fill="#f25c2b" />
        <rect x="10" y="38" width="44" height="4" rx="2" fill={light ? '#0d1b2a' : '#fff'} />
        <rect x="14" y="44" width="36" height="3" rx="1.5" fill={light ? '#0d1b2a' : '#fff'} opacity=".55" />
      </svg>
      <span>Новый Горизонт<small>девелопер с 2006 года</small></span>
    </Link>
  )
}

export function Spinner({ size = 20 }) {
  return <Loader2 size={size} className="spin" />
}

export function PageLoader() {
  return <div className="page-loader"><Spinner size={32} /></div>
}

export function StatusBadge({ status, children }) {
  return <span className={`badge ${STATUS_BADGE[status] || ''}`}><span className="dot" />{children}</span>
}

export function Modal({ open, onClose, title, subtitle, children, size = '' }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${size}`} role="dialog" aria-modal="true" aria-label={title}>
        <button className="icon-btn modal-close" onClick={onClose} aria-label="Закрыть"><X size={18} /></button>
        {title && <h2>{title}</h2>}
        {subtitle && <p className="muted mb-24">{subtitle}</p>}
        {children}
      </div>
    </div>
  )
}

export function Empty({ icon: Icon, title, text, action }) {
  return (
    <div className="empty">
      {Icon && <div className="empty-icon"><Icon size={28} /></div>}
      <h3>{title}</h3>
      {text && <p className="muted">{text}</p>}
      {action && <div className="mt-24">{action}</div>}
    </div>
  )
}

export function Field({ label, error, hint, children }) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      {children}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  )
}

/** Анимированный счётчик для статистики */
export function CountUp({ value, duration = 1200, suffix = '' }) {
  const [v, setV] = useState(0)
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let raf, started = false
    const target = Number(value) || 0
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || started) return
      started = true
      const t0 = performance.now()
      const tick = (t) => {
        const p = Math.min(1, (t - t0) / duration)
        setV(Math.round(target * (1 - Math.pow(1 - p, 3))))
        if (p < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }, { threshold: 0.3 })
    io.observe(el)
    return () => { io.disconnect(); cancelAnimationFrame(raf) }
  }, [value, duration])
  return <b ref={ref}>{v.toLocaleString('ru-RU')}{suffix}</b>
}

export function Pagination({ page, count, pageSize = 12, onChange }) {
  const pages = Math.ceil(count / pageSize)
  if (pages <= 1) return null
  const list = []
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 1) list.push(i)
    else if (list[list.length - 1] !== '…') list.push('…')
  }
  return (
    <nav className="pagination" aria-label="Страницы">
      <button disabled={page === 1} onClick={() => onChange(page - 1)} aria-label="Назад">‹</button>
      {list.map((p, i) => p === '…'
        ? <button key={`e${i}`} disabled>…</button>
        : <button key={p} className={p === page ? 'active' : ''} onClick={() => onChange(p)}>{p}</button>)}
      <button disabled={page === pages} onClick={() => onChange(page + 1)} aria-label="Вперёд">›</button>
    </nav>
  )
}
