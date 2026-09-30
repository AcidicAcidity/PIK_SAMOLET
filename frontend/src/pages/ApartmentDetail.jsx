import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowRight, BadgePercent, Bath, Building2, CalendarDays, Check, ChevronRight, Eye, Home as HomeIcon,
  Layers, Maximize2, Phone, Ruler, Sun, Train, Wallet,
} from 'lucide-react'
import api, { errorText } from '../api/client'
import { ApartmentCard, CompareButton, FavoriteButton } from '../components/Cards'
import FloorPlan from '../components/FloorPlan'
import { Empty, Field, Modal, PageLoader, Spinner, StatusBadge } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/UiContext'
import { area, money, roomsLong } from '../utils/format'

export default function ApartmentDetail() {
  const { id } = useParams()
  const [a, setA] = useState(null)
  const [error, setError] = useState(false)
  const [tab, setTab] = useState('plan')
  const [bookOpen, setBookOpen] = useState(false)
  const [leadOpen, setLeadOpen] = useState(false)
  const { user, refreshUser } = useAuth()
  const nav = useNavigate()

  const load = () => api.get(`/apartments/${id}/`).then((r) => setA(r.data)).catch(() => setError(true))
  useEffect(() => { setA(null); setError(false); load() }, [id]) // eslint-disable-line

  if (error) return <div className="container section"><Empty icon={HomeIcon} title="Квартира не найдена" text="Возможно, она уже продана или ссылка устарела." action={<Link to="/apartments" className="btn">В каталог</Link>} /></div>
  if (!a) return <PageLoader />

  const hasDiscount = Number(a.discount_percent) > 0
  const available = a.status === 'available'
  const specs = [
    ['Общая площадь', area(a.area)], ['Жилая площадь', a.living_area ? area(a.living_area) : '—'],
    ['Кухня', a.kitchen_area ? area(a.kitchen_area) : 'Кухня-гостиная'], ['Этаж', `${a.floor} из ${a.floors_total}`],
    ['Потолки', `${Number(a.ceiling_height).toLocaleString('ru-RU')} м`], ['Санузлов', a.bathrooms],
    ['Балкон / лоджия', a.balcony ? 'Есть' : 'Нет'], ['Отделка', a.finishing_display],
    ['Вид из окон', a.window_view || '—'], ['Срок сдачи', a.completion_quarter || '—'],
    ['Корпус', `${a.building_number} · ${a.building_info?.stage_display}`], ['Номер квартиры', a.number],
  ]

  return (
    <div className="container" style={{ paddingBottom: 40 }}>
      <nav className="breadcrumbs" aria-label="Навигация">
        <Link to="/apartments">Квартиры</Link><ChevronRight size={14} />
        <Link to={`/complexes/${a.complex.slug}`}>ЖК «{a.complex.name}»</Link><ChevronRight size={14} />
        <span>Квартира №{a.number}</span>
      </nav>

      <div className="apt-detail">
        <div className="stack-lg">
          <div className="plan-viewer">
            <div className="row-between wrap mb-16">
              <div>
                <div className="row wrap" style={{ gap: 8, marginBottom: 10 }}>
                  <StatusBadge status={a.status}>{a.status_display}</StatusBadge>
                  <span className="badge">{a.complex.housing_class_display}</span>
                  {a.old_price && <span className="badge badge-accent">Спеццена</span>}
                </div>
                <h1 style={{ fontSize: 'clamp(26px, 3vw, 36px)' }}>{roomsLong(a.rooms)}, {area(a.area)}</h1>
                <p className="muted mt-8">ЖК «{a.complex.name}», корпус {a.building_number}, {a.floor} этаж</p>
              </div>
              <div className="row">
                <CompareButton id={a.id} />
                <FavoriteButton key={a.id} apartment={a} />
              </div>
            </div>
            <div className="plan-tabs segmented" role="tablist">
              <button className={tab === 'plan' ? 'active' : ''} onClick={() => setTab('plan')}><Ruler size={16} /> Планировка</button>
              <button className={tab === 'floor' ? 'active' : ''} onClick={() => setTab('floor')}><Layers size={16} /> На этаже</button>
            </div>
            {tab === 'plan' ? (
              <div className="plan-svg"><FloorPlan apartment={a} /></div>
            ) : (
              <FloorPosition a={a} />
            )}
            <p className="tiny muted center mt-16">Планировка схематична. Точные размеры — в договоре долевого участия.</p>
          </div>

          <div className="card">
            <h3 className="mb-16">Характеристики</h3>
            <dl className="specs-table" style={{ margin: 0 }}>
              {specs.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
            </dl>
            {a.description && <p className="mt-24" style={{ fontSize: 16 }}>{a.description}</p>}
          </div>

          <div className="card">
            <div className="row-between wrap mb-16">
              <h3>О жилом комплексе</h3>
              <Link to={`/complexes/${a.complex.slug}`} className="link">Страница ЖК <ArrowRight size={16} /></Link>
            </div>
            <div className="complex-meta mb-16">
              <span><Building2 size={15} /> {a.complex.address}</span>
              {a.complex.metro && <span><Train size={15} /> м. {a.complex.metro}, {a.complex.metro_minutes} мин пешком</span>}
            </div>
            <ul className="feature-list">
              {a.complex.features_list.map((f) => <li key={f}><Check size={18} />{f}</li>)}
            </ul>
            {a.building_info && (
              <div className="mt-24">
                <div className="row-between small mb-16" style={{ marginBottom: 8 }}>
                  <span>Готовность корпуса {a.building_number}</span><b>{a.building_info.construction_progress}%</b>
                </div>
                <div className="progress"><div style={{ width: `${a.building_info.construction_progress}%` }} /></div>
              </div>
            )}
          </div>
        </div>

        <aside className="sticky-panel">
          <div className="price-panel">
            {a.old_price && <div className="price-old">{money(a.old_price)}</div>}
            {hasDiscount && available && <div className="price-old">{money(a.price)}</div>}
            <div className="price-big">{money(hasDiscount && available ? a.discounted_price : a.price)}</div>
            <div className="muted small mt-8">{money(a.price_per_m2)} за м²</div>

            {user ? (
              hasDiscount && available && (
                <div className="discount-box"><BadgePercent size={22} />
                  <span>Ваша скидка <b>{Number(a.discount_percent)}%</b> по уровню «{user.loyalty_level?.name}» — экономия {money(a.price - a.discounted_price)}</span>
                </div>
              )
            ) : (
              <Link to="/login" className="discount-box"><BadgePercent size={22} /><span><b>Войдите</b>, чтобы увидеть цену с персональной скидкой до 5%</span></Link>
            )}

            <div className="stack mt-24">
              {available ? (
                <button className="btn btn-accent btn-lg btn-block" onClick={() => (user ? setBookOpen(true) : nav('/login', { state: { from: `/apartments/${a.id}` } }))}>
                  Забронировать онлайн
                </button>
              ) : (
                <div className="discount-box" style={{ background: 'var(--bg)', color: 'var(--ink-2)' }}>
                  <CalendarDays size={20} /> Квартира {a.status === 'sold' ? 'продана' : 'забронирована'}. Посмотрите похожие варианты ниже.
                </div>
              )}
              <button className="btn btn-outline btn-lg btn-block" onClick={() => setLeadOpen(true)}><Phone size={18} /> Получить консультацию</button>
            </div>
            <div className="row wrap mt-24 small muted" style={{ gap: 16 }}>
              <span className="row" style={{ gap: 6 }}><Check size={16} color="var(--success)" /> Бронь до 14 дней</span>
              <span className="row" style={{ gap: 6 }}><Check size={16} color="var(--success)" /> Эскроу-счёт</span>
            </div>
          </div>
          <MiniMortgage price={hasDiscount && available ? a.discounted_price : a.price} apartmentId={a.id} />
        </aside>
      </div>

      {a.similar?.length > 0 && (
        <section className="section-sm">
          <div className="section-head"><h2>Похожие квартиры</h2></div>
          <div className="apt-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
            {a.similar.map((s) => <ApartmentCard key={s.id} a={s} />)}
          </div>
        </section>
      )}

      <BookingModal open={bookOpen} onClose={() => setBookOpen(false)} a={a} onDone={() => { load(); refreshUser() }} />
      <LeadModal open={leadOpen} onClose={() => setLeadOpen(false)} apartment={a} />
    </div>
  )
}

function FloorPosition({ a }) {
  return (
    <div className="stack-lg" style={{ padding: '12px 0' }}>
      <div>
        <div className="row-between small mb-16" style={{ marginBottom: 8 }}><span className="muted">1 этаж</span><span className="muted">{a.floors_total} этаж</span></div>
        <div className="floor-bar" aria-label={`Этаж ${a.floor} из ${a.floors_total}`}>
          {Array.from({ length: a.floors_total }).map((_, i) => (
            <span key={i} className={i + 1 === a.floor ? 'cur' : ''} style={{ height: `${30 + (i / a.floors_total) * 70}%` }} />
          ))}
        </div>
      </div>
      <div className="grid-3" style={{ gap: 12 }}>
        <div className="kpi"><div className="label"><Layers size={16} /> Этаж</div><div className="value">{a.floor}</div><div className="hint">из {a.floors_total}</div></div>
        <div className="kpi"><div className="label"><Eye size={16} /> Вид</div><div className="value" style={{ fontSize: 20 }}>{a.window_view || '—'}</div></div>
        <div className="kpi"><div className="label"><Sun size={16} /> Потолки</div><div className="value">{Number(a.ceiling_height).toLocaleString('ru-RU')} м</div></div>
      </div>
      <div className="row wrap small muted" style={{ gap: 16 }}>
        <span className="row" style={{ gap: 6 }}><Bath size={16} /> {a.bathrooms} {a.bathrooms > 1 ? 'санузла' : 'санузел'}</span>
        <span className="row" style={{ gap: 6 }}><Maximize2 size={16} /> {a.finishing_display}</span>
      </div>
    </div>
  )
}

function MiniMortgage({ price, apartmentId }) {
  const [programs, setPrograms] = useState([])
  const [programId, setProgramId] = useState('')
  const [downPct, setDownPct] = useState(20)
  const [term, setTerm] = useState(25)
  const [result, setResult] = useState(null)

  useEffect(() => {
    api.get('/mortgage/programs/').then((r) => { setPrograms(r.data); setProgramId(r.data[0]?.id || '') })
  }, [])
  const program = programs.find((p) => String(p.id) === String(programId))
  const minPct = program ? Number(program.min_down_payment_percent) : 10
  useEffect(() => { if (downPct < minPct) setDownPct(minPct) }, [minPct]) // eslint-disable-line

  useEffect(() => {
    if (!program) return
    const t = setTimeout(() => {
      api.post('/mortgage/calculate/', {
        property_price: price, down_payment: Math.round((price * Math.max(downPct, minPct)) / 100),
        term_years: Math.min(term, program.max_term_years), program: program.id,
      }).then((r) => setResult(r.data)).catch(() => setResult(null))
    }, 250)
    return () => clearTimeout(t)
  }, [price, downPct, term, programId]) // eslint-disable-line

  return (
    <div className="price-panel">
      <div className="row" style={{ gap: 10, marginBottom: 16 }}><Wallet size={20} /><h3 style={{ fontSize: 18 }}>Ипотека на эту квартиру</h3></div>
      <div className="stack">
        <select className="select" value={programId} onChange={(e) => setProgramId(e.target.value)} aria-label="Программа">
          {programs.map((p) => <option key={p.id} value={p.id}>{p.name} — {Number(p.rate)}%</option>)}
        </select>
        <div className="slider-field">
          <div className="row-between small"><span className="muted">Взнос {downPct}%</span><b>{money(Math.round((price * downPct) / 100))}</b></div>
          <input type="range" min={minPct} max={90} value={downPct} onChange={(e) => setDownPct(Number(e.target.value))} aria-label="Первоначальный взнос" />
        </div>
        <div className="slider-field">
          <div className="row-between small"><span className="muted">Срок</span><b>{term} лет</b></div>
          <input type="range" min={5} max={program?.max_term_years || 30} value={term} onChange={(e) => setTerm(Number(e.target.value))} aria-label="Срок" />
        </div>
      </div>
      <div className="row-between mt-24" style={{ alignItems: 'end' }}>
        <div><div className="small muted">Платёж в месяц</div><div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>{result ? money(result.monthly_payment) : '—'}</div></div>
        <Link to={`/mortgage?apartment=${apartmentId}&price=${price}`} className="link small">Подробнее <ArrowRight size={14} /></Link>
      </div>
    </div>
  )
}

function BookingModal({ open, onClose, a, onDone }) {
  const toast = useToast()
  const nav = useNavigate()
  const [method, setMethod] = useState('mortgage')
  const [comment, setComment] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const submit = async () => {
    setSending(true); setError('')
    try {
      await api.post('/bookings/', { apartment: a.id, payment_method: method, comment })
      toast('Квартира забронирована! Менеджер свяжется с вами.')
      onClose(); onDone?.()
      nav('/account/bookings')
    } catch (e) { setError(errorText(e)) } finally { setSending(false) }
  }
  const final = Number(a.discount_percent) > 0 ? a.discounted_price : a.price
  return (
    <Modal open={open} onClose={onClose} title="Бронирование квартиры" subtitle={`${roomsLong(a.rooms)}, ${area(a.area)} · ЖК «${a.complex.name}», кв. ${a.number}`}>
      <div className="stack-lg">
        <div className="card" style={{ padding: 20, background: 'var(--bg)', border: 0 }}>
          <div className="row-between small"><span className="muted">Стоимость</span><span>{money(a.price)}</span></div>
          {Number(a.discount_percent) > 0 && <div className="row-between small mt-8"><span className="muted">Скидка по программе лояльности</span><span style={{ color: 'var(--accent)' }}>−{Number(a.discount_percent)}%</span></div>}
          <div className="row-between mt-16"><b>Итого</b><b style={{ fontSize: 22 }}>{money(final)}</b></div>
        </div>
        <Field label="Способ покупки">
          <div className="chips">
            {[['mortgage', 'Ипотека'], ['cash', 'Собственные средства'], ['installment', 'Рассрочка']].map(([v, l]) => (
              <button key={v} type="button" className={`chip ${method === v ? 'active' : ''}`} onClick={() => setMethod(v)}>{l}</button>
            ))}
          </div>
        </Field>
        <Field label="Комментарий для менеджера" hint="Удобное время звонка, вопросы по квартире">
          <textarea className="textarea" value={comment} onChange={(e) => setComment(e.target.value)} />
        </Field>
        {error && <div className="discount-box" style={{ background: 'var(--danger-50)', color: 'var(--danger)' }}>{error}</div>}
        <button className="btn btn-accent btn-lg btn-block" onClick={submit} disabled={sending}>{sending ? <Spinner /> : 'Подтвердить бронирование'}</button>
        <p className="tiny muted center">Бронь бесплатная. После подтверждения менеджером цена фиксируется на 14 дней.</p>
      </div>
    </Modal>
  )
}

export function LeadModal({ open, onClose, apartment, topic = 'consult' }) {
  const toast = useToast()
  const { user } = useAuth()
  const [form, setForm] = useState({ name: '', phone: '' })
  const [sending, setSending] = useState(false)
  useEffect(() => { if (user) setForm({ name: user.first_name, phone: user.phone }) }, [user])
  const submit = async (e) => {
    e.preventDefault(); setSending(true)
    try {
      await api.post('/leads/', { ...form, topic, apartment: apartment?.id, email: user?.email || '', message: apartment ? `Интересует квартира №${apartment.number} в ЖК «${apartment.complex.name}»` : '' })
      toast('Спасибо! Менеджер перезвонит в течение 15 минут.')
      onClose()
    } catch (err) { toast(errorText(err), 'error') } finally { setSending(false) }
  }
  return (
    <Modal open={open} onClose={onClose} title="Консультация" subtitle="Оставьте телефон — менеджер ответит на вопросы и запишет на просмотр.">
      <form className="stack" onSubmit={submit}>
        <Field label="Имя"><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Телефон"><input className="input" required type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+7 900 000-00-00" /></Field>
        <button className="btn btn-accent btn-lg mt-8" disabled={sending}>{sending ? <Spinner /> : 'Жду звонка'}</button>
      </form>
    </Modal>
  )
}
