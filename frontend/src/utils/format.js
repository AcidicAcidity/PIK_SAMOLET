const nf = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })
const nf1 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 })

export const money = (v) => (v === null || v === undefined || v === '' ? '—' : `${nf.format(Number(v))} ₽`)
export const num = (v) => nf.format(Number(v || 0))
export const area = (v) => `${nf1.format(Number(v))} м²`

/** 12 500 000 → «12,5 млн ₽» */
export function moneyShort(v) {
  const n = Number(v || 0)
  if (n >= 1e6) return `${nf1.format(n / 1e6)} млн ₽`
  if (n >= 1e3) return `${nf.format(n / 1e3)} тыс ₽`
  return money(n)
}

export const roomsLabel = (r) => (Number(r) === 0 ? 'Студия' : `${r}-комн.`)
export const roomsLong = (r) => (Number(r) === 0 ? 'Студия' : `${r}-комнатная квартира`)

export function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}

export const date = (v) => (v ? new Date(v).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : '—')
export const dateTime = (v) => (v ? new Date(v).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—')

export function initials(u) {
  if (!u) return '?'
  return ((u.first_name?.[0] || '') + (u.last_name?.[0] || '') || u.email?.[0] || '?').toUpperCase()
}

/** Детерминированный псевдослучайный генератор по строке */
export function seeded(seed) {
  let h = 2166136261
  for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return () => {
    h += 0x6d2b79f5
    let t = h
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const STATUS_BADGE = {
  available: 'badge-success', reserved: 'badge-warning', sold: 'badge-dark',
  pending: 'badge-warning', confirmed: 'badge-info', completed: 'badge-success', rejected: 'badge-danger',
  cancelled: '', expired: '',
  new: 'badge-accent', in_review: 'badge-info', approved: 'badge-success', in_progress: 'badge-info', done: 'badge-success',
}
