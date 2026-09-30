import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, FileText, ShieldCheck } from 'lucide-react'
import api, { errorText, fieldErrors } from '../api/client'
import StackedBars from '../components/StackedBars'
import { Field, Modal, Spinner } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/UiContext'
import { money, moneyShort, num } from '../utils/format'

export default function Mortgage() {
  const [params] = useSearchParams()
  const [programs, setPrograms] = useState([])
  const [programId, setProgramId] = useState(null)
  const [price, setPrice] = useState(Number(params.get('price')) || 12_000_000)
  const [down, setDown] = useState(Math.round((Number(params.get('price')) || 12_000_000) * 0.2))
  const [term, setTerm] = useState(25)
  const [result, setResult] = useState(null)
  const [calcError, setCalcError] = useState('')
  const [apply, setApply] = useState(false)
  const [showTable, setShowTable] = useState(false)
  const apartmentId = params.get('apartment')

  useEffect(() => {
    api.get('/mortgage/programs/').then((r) => {
      setPrograms(r.data)
      setProgramId(r.data.find((p) => p.name.includes('Субсид'))?.id || r.data[0]?.id)
    })
  }, [])
  const program = programs.find((p) => p.id === programId)
  const minDown = program ? Math.ceil((price * Number(program.min_down_payment_percent)) / 100) : 0

  useEffect(() => { if (program && down < minDown) setDown(minDown) }, [programId, price]) // eslint-disable-line
  useEffect(() => { if (program && term > program.max_term_years) setTerm(program.max_term_years) }, [programId]) // eslint-disable-line

  useEffect(() => {
    if (!program) return
    const t = setTimeout(() => {
      api.post('/mortgage/calculate/', { property_price: price, down_payment: down, term_years: term, program: program.id })
        .then((r) => { setResult(r.data); setCalcError('') })
        .catch((e) => { setCalcError(errorText(e)); setResult(null) })
    }, 200)
    return () => clearTimeout(t)
  }, [price, down, term, programId]) // eslint-disable-line

  const chartData = useMemo(() => (result?.schedule || []).map((s) => ({
    label: String(s.year), tipLabel: `${s.year}-й год`, values: [Number(s.principal), Number(s.interest)],
  })), [result])

  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 40 }}>
      <div className="page-title">
        <div>
          <div className="eyebrow">Ипотека</div>
          <h1>Ипотечный калькулятор</h1>
          <p className="muted mt-8" style={{ maxWidth: 640 }}>Выберите программу банка-партнёра, рассчитайте платёж и отправьте заявку — ответ банка в течение одного рабочего дня.</p>
        </div>
      </div>

      <div className="grid-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
        {programs.map((p) => (
          <button key={p.id} className={`program-card ${p.id === programId ? 'active' : ''}`} onClick={() => setProgramId(p.id)} aria-pressed={p.id === programId}>
            <div style={{ minHeight: 26 }}>
              {p.badge && <span className="badge" style={{ background: p.color, color: '#fff' }}>{p.badge}</span>}
            </div>
            <span className="small muted">{p.bank_name}</span>
            <div className="rate">{Number(p.rate).toLocaleString('ru-RU')}%</div>
            <b>{p.name}</b>
            <span className="tiny muted">Взнос от {Number(p.min_down_payment_percent)}% · до {p.max_term_years} лет · до {moneyShort(p.max_amount)}</span>
          </button>
        ))}
      </div>

      <div className="calc mt-24">
        <div className="card stack-lg">
          {program && <p className="muted">{program.description}</p>}
          <SliderInput label="Стоимость квартиры" value={price} min={2_000_000} max={150_000_000} step={100_000} onChange={setPrice} />
          <SliderInput label="Первоначальный взнос" value={down} min={minDown} max={Math.round(price * 0.9)} step={50_000} onChange={setDown}
            extra={`${price ? Math.round((down / price) * 100) : 0}% · минимум ${program ? Number(program.min_down_payment_percent) : 0}%`} />
          <SliderInput label="Срок кредита" value={term} min={1} max={program?.max_term_years || 30} step={1} onChange={setTerm} unit="лет" />
          {calcError && <div className="discount-box" style={{ background: 'var(--danger-50)', color: 'var(--danger)' }}>{calcError}</div>}

          {result && (
            <div>
              <div className="row-between wrap mb-16">
                <h3>Структура выплат по годам</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowTable((v) => !v)}>{showTable ? 'Показать график' : 'Показать таблицей'}</button>
              </div>
              {showTable ? (
                <div className="table-wrap" style={{ maxHeight: 320, overflowY: 'auto' }}>
                  <table className="table">
                    <thead><tr><th>Год</th><th>Основной долг</th><th>Проценты</th><th>Остаток</th></tr></thead>
                    <tbody>{result.schedule.map((s) => <tr key={s.year}><td>{s.year}</td><td>{money(s.principal)}</td><td>{money(s.interest)}</td><td>{money(s.balance)}</td></tr>)}</tbody>
                  </table>
                </div>
              ) : (
                <StackedBars data={chartData} format={money}
                  series={[{ name: 'Основной долг', color: '#2a78d6' }, { name: 'Проценты', color: '#eb6834' }]} />
              )}
            </div>
          )}
        </div>

        <aside className="calc-result">
          <div className="small" style={{ color: 'rgba(255,255,255,.6)' }}>Ежемесячный платёж</div>
          <div className="big">{result ? money(result.monthly_payment) : '—'}</div>
          <div className="mt-24">
            <div className="kv"><span>Сумма кредита</span><b>{result ? money(result.loan_amount) : '—'}</b></div>
            <div className="kv"><span>Ставка</span><b>{program ? `${Number(program.rate).toLocaleString('ru-RU')}%` : '—'}</b></div>
            <div className="kv"><span>Переплата</span><b>{result ? money(result.overpayment) : '—'}</b></div>
            <div className="kv"><span>Общая сумма выплат</span><b>{result ? money(result.total_payment) : '—'}</b></div>
            <div className="kv" style={{ borderBottom: 0 }}><span>Рекомендуемый доход</span><b>от {result ? money(result.recommended_income) : '—'}</b></div>
          </div>
          <button className="btn btn-accent btn-lg btn-block mt-24" disabled={!result} onClick={() => setApply(true)}>
            <FileText size={18} /> Подать заявку
          </button>
          <p className="tiny mt-16" style={{ color: 'rgba(255,255,255,.5)' }}>Расчёт предварительный. Окончательные условия определяет банк.</p>
        </aside>
      </div>

      <ApplyModal open={apply} onClose={() => setApply(false)} program={program} price={price} down={down} term={term} apartmentId={apartmentId} result={result} />
    </div>
  )
}

function SliderInput({ label, value, min, max, step, onChange, unit = '₽', extra }) {
  const [text, setText] = useState(String(value))
  useEffect(() => setText(num(value)), [value])
  const commit = () => {
    const n = Number(String(text).replace(/\s/g, '').replace(',', '.'))
    if (!Number.isNaN(n)) onChange(Math.min(Math.max(n, min), max))
    else setText(num(value))
  }
  return (
    <div className="slider-field">
      <div className="row-between">
        <label className="muted small">{label}</label>
        {extra && <span className="tiny muted">{extra}</span>}
      </div>
      <div className="row" style={{ marginBottom: 12 }}>
        <input className="input" style={{ fontSize: 20, fontWeight: 700, height: 54 }} value={text}
          onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && commit()} aria-label={label} />
        <span className="muted" style={{ minWidth: 30 }}>{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label}
        style={{ background: `linear-gradient(90deg, var(--accent) ${((value - min) / (max - min || 1)) * 100}%, var(--line) 0)` }} />
    </div>
  )
}

function ApplyModal({ open, onClose, program, price, down, term, apartmentId, result }) {
  const { user } = useAuth()
  const toast = useToast()
  const nav = useNavigate()
  const [form, setForm] = useState({ full_name: '', phone: '', birth_date: '', monthly_income: '', employment: 'hired', comment: '' })
  const [errors, setErrors] = useState({})
  const [sending, setSending] = useState(false)
  useEffect(() => {
    if (user) setForm((f) => ({ ...f, full_name: [user.last_name, user.first_name, user.middle_name].filter(Boolean).join(' '), phone: user.phone || '' }))
  }, [user])

  if (!user) {
    return (
      <Modal open={open} onClose={onClose} title="Войдите, чтобы подать заявку" subtitle="Заявка на ипотеку оформляется в личном кабинете — там же вы увидите решение банка.">
        <div className="row"><Link to="/login" state={{ from: '/mortgage' }} className="btn btn-accent">Войти</Link><Link to="/register" className="btn btn-outline">Регистрация</Link></div>
      </Modal>
    )
  }
  const submit = async (e) => {
    e.preventDefault(); setSending(true); setErrors({})
    try {
      await api.post('/mortgage/applications/', {
        ...form, birth_date: form.birth_date || null, program: program.id, property_price: price, down_payment: down, term_years: term,
        apartment: apartmentId || null, monthly_income: Number(String(form.monthly_income).replace(/\s/g, '')) || 0,
      })
      toast('Заявка отправлена в банк!')
      onClose()
      nav('/account/mortgage')
    } catch (err) {
      setErrors(fieldErrors(err))
      toast(errorText(err), 'error')
    } finally { setSending(false) }
  }
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  return (
    <Modal open={open} onClose={onClose} size="modal-lg" title="Заявка на ипотеку" subtitle={program && `${program.bank_name} · ${program.name} · ${Number(program.rate)}%`}>
      <div className="card" style={{ padding: 18, background: 'var(--bg)', border: 0, marginBottom: 20 }}>
        <div className="row wrap" style={{ gap: 24 }}>
          <div><div className="tiny muted">Кредит</div><b>{money(price - down)}</b></div>
          <div><div className="tiny muted">Срок</div><b>{term} лет</b></div>
          <div><div className="tiny muted">Платёж</div><b>{result && money(result.monthly_payment)}</b></div>
        </div>
      </div>
      <form className="form-grid" onSubmit={submit}>
        <div className="full"><Field label="ФИО полностью" error={errors.full_name}><input className="input" required value={form.full_name} onChange={set('full_name')} /></Field></div>
        <Field label="Телефон" error={errors.phone}><input className="input" required type="tel" value={form.phone} onChange={set('phone')} /></Field>
        <Field label="Дата рождения" error={errors.birth_date}><input className="input" type="date" value={form.birth_date} onChange={set('birth_date')} /></Field>
        <Field label="Доход в месяц, ₽" error={errors.monthly_income} hint={result && `Рекомендуется от ${money(result.recommended_income)}`}>
          <input className="input" required inputMode="numeric" value={form.monthly_income} onChange={set('monthly_income')} />
        </Field>
        <Field label="Занятость">
          <select className="select" value={form.employment} onChange={set('employment')}>
            <option value="hired">Работа по найму</option><option value="business">Собственный бизнес</option>
            <option value="self">Самозанятый / ИП</option><option value="other">Другое</option>
          </select>
        </Field>
        <div className="full"><Field label="Комментарий"><textarea className="textarea" value={form.comment} onChange={set('comment')} /></Field></div>
        {(errors.down_payment || errors.property_price || errors.term_years) && (
          <div className="full discount-box" style={{ background: 'var(--danger-50)', color: 'var(--danger)' }}>{errors.down_payment || errors.property_price || errors.term_years}</div>
        )}
        <div className="full row wrap" style={{ justifyContent: 'space-between' }}>
          <span className="row small muted" style={{ gap: 6 }}><ShieldCheck size={16} /> Данные передаются в банк по защищённому каналу</span>
          <button className="btn btn-accent btn-lg" disabled={sending}>{sending ? <Spinner /> : <>Отправить <ArrowRight size={18} /></>}</button>
        </div>
      </form>
    </Modal>
  )
}

