import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Info } from 'lucide-react'

/* ---------- Уведомления ---------- */
const ToastContext = createContext(() => {})

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const push = useCallback((text, type = 'success') => {
    const id = Math.random().toString(36).slice(2)
    setItems((xs) => [...xs, { id, text, type }])
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 4200)
  }, [])
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.type === 'success' ? <CheckCircle2 size={20} /> : t.type === 'error' ? <AlertCircle size={20} /> : <Info size={20} />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
export const useToast = () => useContext(ToastContext)

/* ---------- Сравнение квартир (хранится в браузере) ---------- */
const CompareContext = createContext(null)
const KEY = 'ng_compare'
export const COMPARE_MAX = 4

function readCompare() {
  try { return JSON.parse(localStorage.getItem(KEY)) || [] } catch { return [] }
}

export function CompareProvider({ children }) {
  const [ids, setIds] = useState(readCompare)
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(ids)) } catch { /* */ } }, [ids])
  /** Возвращает 'added' | 'removed' | 'full' */
  const toggle = (id) => {
    if (ids.includes(id)) { setIds(ids.filter((x) => x !== id)); return 'removed' }
    if (ids.length >= COMPARE_MAX) return 'full'
    setIds([...ids, id])
    return 'added'
  }
  const value = { ids, has: (id) => ids.includes(id), toggle, remove: (id) => setIds((xs) => xs.filter((x) => x !== id)), clear: () => setIds([]), full: ids.length >= COMPARE_MAX }
  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>
}
export const useCompare = () => useContext(CompareContext)
