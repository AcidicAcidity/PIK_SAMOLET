import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react'
import api, { errorText, fieldErrors } from '../api/client'
import CityArt from '../components/CityArt'
import { Field, Spinner } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/UiContext'

const DEMO = [
  ['Клиент', 'client@novyi-gorizont.local', 'Client12345!'],
  ['Менеджер', 'manager@novyi-gorizont.local', 'Manager12345!'],
  ['Администратор', 'admin@novyi-gorizont.local', 'Admin12345!'],
]

function Shell({ children, title = 'Личный кабинет покупателя', text = 'Бронирование онлайн, персональные скидки, заявки на ипотеку и история сделок — в одном месте.' }) {
  return (
    <div className="auth-page">
      <div className="auth-side">
        <div style={{ position: 'relative', zIndex: 2 }}>
          <div className="eyebrow">Новый Горизонт</div>
          <h2>{title}</h2>
          <p style={{ color: 'rgba(255,255,255,.7)', marginTop: 16, maxWidth: 420 }}>{text}</p>
          <div className="stack mt-32" style={{ gap: 14 }}>
            {['Двухфакторная защита входа через email', 'Скидка до 5% по программе лояльности', 'Статусы брони и ипотеки в реальном времени'].map((t) => (
              <div key={t} className="row" style={{ gap: 10 }}><ShieldCheck size={18} color="var(--accent)" /> {t}</div>
            ))}
          </div>
        </div>
        <div className="art" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%' }}>
          <CityArt seed="auth" color="#f25c2b" variant="night" />
        </div>
      </div>
      <div className="auth-form-wrap">{children}</div>
    </div>
  )
}

function PasswordInput({ value, onChange, autoComplete = 'current-password', error }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <input className={`input ${error ? 'error' : ''}`} type={show ? 'text' : 'password'} required value={value} onChange={onChange} autoComplete={autoComplete} style={{ paddingRight: 48 }} />
      <button type="button" className="btn-ghost" onClick={() => setShow((v) => !v)} aria-label={show ? 'Скрыть пароль' : 'Показать пароль'}
        style={{ position: 'absolute', right: 6, top: 6, height: 38, width: 38, border: 0, borderRadius: 10, cursor: 'pointer', display: 'grid', placeItems: 'center', background: 'none' }}>
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  )
}

/** Шаг ввода 6-значного кода из письма */
export function CodeStep({ challenge, onVerified, onBack, endpoint = '/auth/verify/', extra, submitLabel = 'Подтвердить' }) {
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [ch, setCh] = useState(challenge)
  const [wait, setWait] = useState(challenge.resend_in || 60)
  const refs = useRef([])
  const toast = useToast()

  useEffect(() => { refs.current[0]?.focus() }, [])
  useEffect(() => {
    if (wait <= 0) return
    const t = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])

  const submit = async (code) => {
    setLoading(true); setError('')
    try {
      const { needsMore, children, ...payload } = extra || {} // eslint-disable-line no-unused-vars
      const { data } = await api.post(endpoint, { challenge_id: ch.challenge_id, code, ...payload })
      onVerified(data)
    } catch (e) {
      setError(errorText(e))
      setDigits(['', '', '', '', '', ''])
      refs.current[0]?.focus()
    } finally { setLoading(false) }
  }

  const setAt = (i, v) => {
    const clean = v.replace(/\D/g, '')
    if (clean.length > 1) { // вставка из буфера
      const arr = clean.slice(0, 6).split('')
      const next = [...digits]
      arr.forEach((d, k) => { if (i + k < 6) next[i + k] = d })
      setDigits(next)
      refs.current[Math.min(i + arr.length, 5)]?.focus()
      if (next.every(Boolean) && !extra?.needsMore) submit(next.join(''))
      return
    }
    const next = [...digits]; next[i] = clean; setDigits(next)
    if (clean && i < 5) refs.current[i + 1]?.focus()
    if (next.every(Boolean) && !extra?.needsMore) submit(next.join(''))
  }

  const resend = async () => {
    try {
      const { data } = await api.post('/auth/resend/', { challenge_id: ch.challenge_id })
      setCh(data); setWait(data.resend_in); setError('')
      toast('Новый код отправлен на почту')
    } catch (e) {
      const d = e.response?.data
      if (d?.resend_in) setWait(d.resend_in)
      setError(errorText(e))
    }
  }

  return (
    <div className="stack-lg">
      <div>
        <div className="adv-icon" style={{ marginBottom: 20 }}><Mail size={26} /></div>
        <h1 style={{ fontSize: 30 }}>Введите код из письма</h1>
        <p className="muted mt-8">Мы отправили 6-значный код на <b style={{ color: 'var(--ink)' }}>{ch.email}</b>. Код действует {Math.round((ch.expires_in || 600) / 60)} минут.</p>
      </div>
      <div className={`code-inputs ${error ? 'error' : ''}`} onPaste={(e) => { e.preventDefault(); setAt(0, e.clipboardData.getData('text')) }}>
        {digits.map((d, i) => (
          <input key={i} ref={(el) => (refs.current[i] = el)} value={d} inputMode="numeric" autoComplete="one-time-code" maxLength={6}
            aria-label={`Цифра ${i + 1}`} disabled={loading}
            onChange={(e) => setAt(i, e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Backspace' && !d && i > 0) refs.current[i - 1]?.focus() }} />
        ))}
      </div>
      {error && <div className="field-error">{error}</div>}
      {extra?.needsMore && extra.children}
      {extra?.needsMore && (
        <button className="btn btn-accent btn-lg" disabled={loading || !digits.every(Boolean)} onClick={() => submit(digits.join(''))}>
          {loading ? <Spinner /> : submitLabel}
        </button>
      )}
      {loading && !extra?.needsMore && <div className="row muted"><Spinner /> Проверяем код…</div>}
      <div className="row-between small">
        <button className="btn btn-ghost btn-sm" onClick={onBack}><ArrowLeft size={16} /> Назад</button>
        {wait > 0 ? <span className="muted">Отправить повторно через {wait} с</span>
          : <button className="link" style={{ background: 'none', border: 0, cursor: 'pointer' }} onClick={resend}>Отправить код повторно</button>}
      </div>
      <div className="demo-accounts">
        Демо-режим: письма приходят в Mailpit — <a className="link" href="http://localhost:8025" target="_blank" rel="noreferrer">localhost:8025</a>
      </div>
    </div>
  )
}

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [challenge, setChallenge] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { completeLogin, user } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const toast = useToast()
  const from = loc.state?.from || '/account'

  useEffect(() => { if (user) nav(from, { replace: true }) }, [user]) // eslint-disable-line

  const submit = async (e) => {
    e.preventDefault(); setLoading(true); setError('')
    try {
      const { data } = await api.post('/auth/login/', { email, password })
      setChallenge(data)
    } catch (err) { setError(errorText(err)) } finally { setLoading(false) }
  }

  return (
    <Shell>
      <div className="auth-form">
        <div className="steps-mini"><span className="on" /><span className={challenge ? 'on' : ''} /></div>
        {challenge ? (
          <CodeStep challenge={challenge} onBack={() => setChallenge(null)}
            onVerified={(data) => { completeLogin(data); toast(`Добро пожаловать, ${data.user.first_name || ''}!`); nav(from, { replace: true }) }} />
        ) : (
          <form className="stack-lg" onSubmit={submit}>
            <div>
              <h1>Вход</h1>
              <p className="muted mt-8">Нет аккаунта? <Link to="/register" className="link">Зарегистрируйтесь</Link></p>
            </div>
            <Field label="Email"><input className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></Field>
            <Field label={<span className="row-between" style={{ width: '100%' }}>Пароль <Link to="/forgot" className="link small">Забыли пароль?</Link></span>}>
              <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            {error && <div className="discount-box" style={{ background: 'var(--danger-50)', color: 'var(--danger)', marginTop: 0 }}>{error}</div>}
            <button className="btn btn-accent btn-lg" disabled={loading}>{loading ? <Spinner /> : <><Lock size={18} /> Продолжить</>}</button>
            <p className="tiny muted center">После ввода пароля мы отправим одноразовый код на вашу почту</p>
            <div className="demo-accounts">
              <div style={{ marginBottom: 6 }}>Демо-аккаунты (нажмите, чтобы подставить):</div>
              {DEMO.map(([r, e, p]) => (
                <div key={e}><button type="button" onClick={() => { setEmail(e); setPassword(p) }}>{r}: {e}</button></div>
              ))}
            </div>
          </form>
        )}
      </div>
    </Shell>
  )
}

export function Register() {
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', password: '' })
  const [agree, setAgree] = useState(false)
  const [errors, setErrors] = useState({})
  const [challenge, setChallenge] = useState(null)
  const [loading, setLoading] = useState(false)
  const { completeLogin } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault(); setLoading(true); setErrors({})
    try {
      const { data } = await api.post('/auth/register/', form)
      setChallenge(data)
    } catch (err) {
      const fe = fieldErrors(err)
      setErrors(Object.keys(fe).length ? fe : { detail: errorText(err) })
    } finally { setLoading(false) }
  }

  return (
    <Shell title="Станьте участником программы лояльности" text="Скидка 1% начинает действовать сразу после подтверждения email и растёт до 5%.">
      <div className="auth-form">
        <div className="steps-mini"><span className="on" /><span className={challenge ? 'on' : ''} /></div>
        {challenge ? (
          <CodeStep challenge={challenge} onBack={() => setChallenge(null)}
            onVerified={(data) => { completeLogin(data); toast('Регистрация завершена! Ваша скидка уже активна.'); nav('/account', { replace: true }) }} />
        ) : (
          <form className="stack" onSubmit={submit} style={{ gap: 16 }}>
            <div className="mb-16">
              <h1>Регистрация</h1>
              <p className="muted mt-8">Уже есть аккаунт? <Link to="/login" className="link">Войти</Link></p>
            </div>
            <div className="form-grid">
              <Field label="Имя" error={errors.first_name}><input className="input" required value={form.first_name} onChange={set('first_name')} autoComplete="given-name" /></Field>
              <Field label="Фамилия" error={errors.last_name}><input className="input" value={form.last_name} onChange={set('last_name')} autoComplete="family-name" /></Field>
            </div>
            <Field label="Email" error={errors.email}><input className="input" type="email" required value={form.email} onChange={set('email')} autoComplete="email" /></Field>
            <Field label="Телефон" error={errors.phone}><input className="input" type="tel" value={form.phone} onChange={set('phone')} placeholder="+7 900 000-00-00" autoComplete="tel" /></Field>
            <Field label="Пароль" error={errors.password || errors.non_field_errors} hint="Минимум 8 символов, не только цифры">
              <PasswordInput value={form.password} onChange={set('password')} autoComplete="new-password" error={errors.password} />
            </Field>
            <label className="checkbox small"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> Согласен на обработку персональных данных</label>
            {errors.detail && <div className="field-error">{errors.detail}</div>}
            <button className="btn btn-accent btn-lg mt-8" disabled={loading || !agree}>{loading ? <Spinner /> : 'Создать аккаунт'}</button>
          </form>
        )}
      </div>
    </Shell>
  )
}

export function Forgot() {
  const [email, setEmail] = useState('')
  const [challenge, setChallenge] = useState(null)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const nav = useNavigate()
  const toast = useToast()
  const request = async (e) => {
    e.preventDefault(); setLoading(true); setError('')
    try { const { data } = await api.post('/auth/password-reset/', { email }); setChallenge(data) }
    catch (err) { setError(errorText(err)) } finally { setLoading(false) }
  }
  return (
    <Shell title="Восстановление доступа" text="Подтвердите владение почтой одноразовым кодом и задайте новый пароль.">
      <div className="auth-form">
        {challenge ? (
          <CodeStep challenge={challenge} onBack={() => setChallenge(null)} endpoint="/auth/password-reset/confirm/" submitLabel="Сменить пароль"
            extra={{ new_password: password, needsMore: true, children: <Field label="Новый пароль" hint="Минимум 8 символов"><PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></Field> }}
            onVerified={() => { toast('Пароль изменён. Войдите с новым паролем.'); nav('/login') }} />
        ) : (
          <form className="stack-lg" onSubmit={request}>
            <div><h1>Забыли пароль?</h1><p className="muted mt-8">Укажите email — мы пришлём код для сброса пароля.</p></div>
            <Field label="Email"><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            {error && <div className="field-error">{error}</div>}
            <button className="btn btn-accent btn-lg" disabled={loading}>{loading ? <Spinner /> : 'Получить код'}</button>
            <Link to="/login" className="link small"><ArrowLeft size={14} /> Вернуться ко входу</Link>
          </form>
        )}
      </div>
    </Shell>
  )
}
