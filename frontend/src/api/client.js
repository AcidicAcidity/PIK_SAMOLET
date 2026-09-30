import axios from 'axios'

const ACCESS = 'ng_access'
const REFRESH = 'ng_refresh'

export const tokens = {
  get access() { try { return localStorage.getItem(ACCESS) } catch { return null } },
  get refresh() { try { return localStorage.getItem(REFRESH) } catch { return null } },
  set({ access, refresh }) {
    try {
      if (access) localStorage.setItem(ACCESS, access)
      if (refresh) localStorage.setItem(REFRESH, refresh)
    } catch { /* приватный режим */ }
  },
  clear() { try { localStorage.removeItem(ACCESS); localStorage.removeItem(REFRESH) } catch { /* */ } },
}

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' })

api.interceptors.request.use((config) => {
  const t = tokens.access
  if (t) config.headers.Authorization = `Bearer ${t}`
  return config
})

// Автоматическое обновление access-токена по refresh при 401
let refreshing = null
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && tokens.refresh && !original._retry && !original.url.includes('/auth/')) {
      original._retry = true
      try {
        refreshing = refreshing || axios.post(`${api.defaults.baseURL}/auth/refresh/`, { refresh: tokens.refresh })
        const { data } = await refreshing
        tokens.set(data)
        original.headers.Authorization = `Bearer ${data.access}`
        return api(original)
      } catch (e) {
        tokens.clear()
        window.dispatchEvent(new Event('auth:logout'))
        return Promise.reject(error)
      } finally {
        refreshing = null
      }
    }
    return Promise.reject(error)
  },
)

/** Превращает ответ DRF с ошибками в читаемую строку */
export function errorText(err, fallback = 'Что-то пошло не так. Попробуйте ещё раз.') {
  const d = err?.response?.data
  if (!d) return err?.message === 'Network Error' ? 'Нет связи с сервером.' : fallback
  if (typeof d === 'string') return fallback
  if (d.detail) return d.detail
  const parts = []
  for (const [k, v] of Object.entries(d)) {
    const msg = Array.isArray(v) ? v.join(' ') : typeof v === 'string' ? v : JSON.stringify(v)
    parts.push(k === 'non_field_errors' ? msg : msg)
  }
  return parts.join(' ') || fallback
}

/** Ошибки по полям: { field: 'текст' } */
export function fieldErrors(err) {
  const d = err?.response?.data
  if (!d || typeof d !== 'object') return {}
  const out = {}
  for (const [k, v] of Object.entries(d)) out[k] = Array.isArray(v) ? v.join(' ') : String(v)
  return out
}

export default api
