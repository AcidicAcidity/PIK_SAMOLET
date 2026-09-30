import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import {
  ArrowRight, CalendarDays, Crown, FileText, Heart, Home as HomeIcon, KeyRound, LayoutDashboard, User, Wallet,
} from 'lucide-react'
import api, { errorText, fieldErrors } from '../../api/client'
import { ApartmentCard } from '../../components/Cards'
import FloorPlan from '../../components/FloorPlan'
import { Empty, Field, PageLoader, Spinner, StatusBadge } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/UiContext'
import { area, date, dateTime, initials, money, moneyShort, roomsLong } from '../../utils/format'

export default function AccountLayout() {
  const { user } = useAuth()
  return (
    <div className="container cabinet">
      <aside>
        <div className="card mb-16" style={{ padding: 20 }}>
          <div className="row">
            <span className="avatar" style={{ width: 48, height: 48, fontSize: 18 }}>{initials(user)}</span>
            <div style={{ minWidth: 0 }}>
              <b>{user.first_name} {user.last_name}</b>
              <div className="tiny muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</div>
            </div>
          </div>
        </div>
        <nav className="side-nav" aria-label="Личный кабинет">
          <NavLink to="/account" end><LayoutDashboard size={18} /> Обзор</NavLink>
          <NavLink to="/account/bookings"><CalendarDays size={18} /> Мои брони</NavLink>
          <NavLink to="/account/mortgage"><Wallet size={18} /> Ипотека</NavLink>
          <NavLink to="/account/favorites"><Heart size={18} /> Избранное</NavLink>
          <NavLink to="/account/profile"><User size={18} /> Профиль</NavLink>
        </nav>
      </aside>
      <section><Outlet /></section>
    </div>
  )
}

export function LoyaltyCard({ status }) {
  if (!status?.level) return null
  const l = status.level
  return (
    <div className="loyalty-card" style={{ background: `linear-gradient(135deg, ${l.color} 0%, #0d1b2a 110%)` }}>
      <div className="row-between" style={{ position: 'relative', zIndex: 1 }}>
        <div><div className="small" style={{ opacity: .75 }}>Уровень лояльности</div><div className="lvl">{l.name}</div></div>
        <Crown size={30} />
      </div>
      <div className="row-between" style={{ alignItems: 'end', position: 'relative', zIndex: 1 }}>
        <div><div className="pct">−{Number(l.discount_percent).toLocaleString('ru-RU')}%</div><div className="small" style={{ opacity: .75 }}>на все квартиры</div></div>
        {status.is_manual && <span className="badge badge-glass">Назначен менеджером</span>}
      </div>
    </div>
  )
}

export function Overview() {
  const { user } = useAuth()
  const [loyalty, setLoyalty] = useState(null)
  const [bookings, setBookings] = useState(null)
  const [apps, setApps] = useState(null)
  const [favs, setFavs] = useState(null)
  useEffect(() => {
    api.get('/loyalty/me/').then((r) => setLoyalty(r.data))
    api.get('/bookings/').then((r) => setBookings(r.data))
    api.get('/mortgage/applications/').then((r) => setApps(r.data))
    api.get('/favorites/').then((r) => setFavs(r.data))
  }, [])
  if (!loyalty) return <PageLoader />
  const active = bookings?.filter((b) => ['pending', 'confirmed'].includes(b.status)) || []
  return (
    <div className="stack-lg">
      <div className="page-title"><div><h1>Здравствуйте, {user.first_name}!</h1><p className="muted mt-8">Вот что происходит с вашими покупками.</p></div></div>
      <div className="grid-2">
        <LoyaltyCard status={loyalty} />
        <div className="card stack" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="small muted">Сумма покупок</div>
            <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em' }}>{money(loyalty.purchases_total)}</div>
          </div>
          {loyalty.next_level ? (
            <div>
              <div className="row-between small mb-16" style={{ marginBottom: 8 }}>
                <span>До уровня «{loyalty.next_level.name}» (−{Number(loyalty.next_level.discount_percent)}%)</span>
                <b>{moneyShort(loyalty.to_next_level)}</b>
              </div>
              <div className="progress"><div style={{ width: `${loyalty.progress_percent}%` }} /></div>
            </div>
          ) : <div className="badge badge-success">Максимальный уровень</div>}
          <Link to="/loyalty" className="link small">Как работает программа <ArrowRight size={14} /></Link>
        </div>
      </div>
      <div className="grid-3">
        <Link to="/account/bookings" className="kpi card-hover"><div className="label"><CalendarDays size={16} /> Активные брони</div><div className="value">{active.length}</div><div className="hint">всего заявок: {bookings?.length ?? '—'}</div></Link>
        <Link to="/account/mortgage" className="kpi card-hover"><div className="label"><Wallet size={16} /> Заявки на ипотеку</div><div className="value">{apps?.length ?? '—'}</div><div className="hint">одобрено: {apps?.filter((a) => a.status === 'approved').length ?? 0}</div></Link>
        <Link to="/account/favorites" className="kpi card-hover"><div className="label"><Heart size={16} /> В избранном</div><div className="value">{favs?.length ?? '—'}</div><div className="hint">квартир</div></Link>
      </div>
      {active.length > 0 && (
        <div>
          <h3 className="mb-16">Текущие брони</h3>
          <div className="stack">{active.map((b) => <BookingItem key={b.id} b={b} />)}</div>
        </div>
      )}
      {!bookings?.length && (
        <Empty icon={HomeIcon} title="Выберите свою квартиру" text={`С вашей скидкой ${Number(user.discount_percent)}% цены в каталоге уже ниже.`}
          action={<Link to="/apartments" className="btn btn-accent">Перейти в каталог</Link>} />
      )}
    </div>
  )
}

const BOOKING_STEPS = [['pending', 'Заявка'], ['confirmed', 'Подтверждена'], ['completed', 'Сделка']]

function BookingItem({ b, onCancel }) {
  const a = b.apartment_info
  const idx = BOOKING_STEPS.findIndex(([s]) => s === b.status)
  const closed = ['rejected', 'cancelled', 'expired'].includes(b.status)
  return (
    <div className="list-item">
      <Link to={`/apartments/${a.id}`} className="thumb"><FloorPlan apartment={a} showLabels={false} /></Link>
      <div style={{ minWidth: 0 }}>
        <div className="row wrap" style={{ gap: 8, marginBottom: 6 }}>
          <StatusBadge status={b.status}>{b.status_display}</StatusBadge>
          <span className="tiny muted">Бронь №{b.id} от {dateTime(b.created_at)}</span>
        </div>
        <Link to={`/apartments/${a.id}`} style={{ fontWeight: 700 }}>{roomsLong(a.rooms)}, {area(a.area)}</Link>
        <div className="small muted">ЖК «{a.complex_name}», корп. {a.building_number}, кв. {a.number} · {b.payment_method_display}</div>
        {!closed && (
          <div className="status-timeline">
            {BOOKING_STEPS.map(([s, l], i) => <div key={s} className={`st ${i < idx ? 'done' : i === idx ? (b.status === 'completed' ? 'done' : 'cur') : ''}`}><div className="bar" />{l}</div>)}
          </div>
        )}
        {b.expires_at && b.status === 'confirmed' && <div className="tiny mt-8">Цена зафиксирована до <b>{date(b.expires_at)}</b></div>}
        {b.manager_comment && <div className="small mt-8" style={{ background: 'var(--bg)', padding: '8px 12px', borderRadius: 10 }}><b>Менеджер{b.manager_name ? ` (${b.manager_name})` : ''}:</b> {b.manager_comment}</div>}
      </div>
      <div className="stack" style={{ alignItems: 'flex-end', gap: 6 }}>
        {Number(b.discount_percent) > 0 && <span className="price-old">{money(b.base_price)}</span>}
        <b style={{ fontSize: 20 }}>{money(b.final_price)}</b>
        {Number(b.discount_percent) > 0 && <span className="badge badge-accent">−{Number(b.discount_percent)}%</span>}
        {onCancel && ['pending', 'confirmed'].includes(b.status) && <button className="btn btn-danger btn-sm mt-8" onClick={() => onCancel(b)}>Отменить</button>}
      </div>
    </div>
  )
}

export function MyBookings() {
  const [list, setList] = useState(null)
  const toast = useToast()
  const { refreshUser } = useAuth()
  const load = () => api.get('/bookings/').then((r) => setList(r.data))
  useEffect(() => { load() }, [])
  const cancel = async (b) => {
    if (!window.confirm(`Отменить бронь №${b.id}? Квартира вернётся в продажу.`)) return
    try { await api.post(`/bookings/${b.id}/cancel/`); toast('Бронь отменена'); load(); refreshUser() } catch (e) { toast(errorText(e), 'error') }
  }
  if (!list) return <PageLoader />
  return (
    <div>
      <div className="page-title"><div><h1>Мои брони</h1><p className="muted mt-8">Одновременно можно держать до 3 активных броней.</p></div></div>
      {list.length ? <div className="stack">{list.map((b) => <BookingItem key={b.id} b={b} onCancel={cancel} />)}</div>
        : <Empty icon={CalendarDays} title="Броней пока нет" text="Выберите квартиру в каталоге и нажмите «Забронировать онлайн»." action={<Link to="/apartments" className="btn btn-accent">В каталог</Link>} />}
    </div>
  )
}

const MORTGAGE_STEPS = [['new', 'Заявка'], ['in_review', 'В банке'], ['approved', 'Решение']]

export function MyMortgage() {
  const [list, setList] = useState(null)
  const toast = useToast()
  const load = () => api.get('/mortgage/applications/').then((r) => setList(r.data))
  useEffect(() => { load() }, [])
  const cancel = async (a) => {
    if (!window.confirm('Отозвать заявку?')) return
    try { await api.post(`/mortgage/applications/${a.id}/cancel/`); toast('Заявка отозвана'); load() } catch (e) { toast(errorText(e), 'error') }
  }
  if (!list) return <PageLoader />
  return (
    <div>
      <div className="page-title">
        <div><h1>Заявки на ипотеку</h1><p className="muted mt-8">Статусы обновляются по мере рассмотрения банком.</p></div>
        <Link to="/mortgage" className="btn btn-accent"><FileText size={18} /> Новая заявка</Link>
      </div>
      {!list.length ? <Empty icon={Wallet} title="Заявок нет" text="Рассчитайте платёж в калькуляторе и отправьте заявку в банк-партнёр." action={<Link to="/mortgage" className="btn">К калькулятору</Link>} /> : (
        <div className="stack">
          {list.map((a) => {
            const idx = MORTGAGE_STEPS.findIndex(([s]) => s === a.status)
            const closed = ['rejected', 'cancelled'].includes(a.status)
            return (
              <div key={a.id} className="card" style={{ padding: 24 }}>
                <div className="row-between wrap">
                  <div>
                    <div className="row wrap" style={{ gap: 8 }}><StatusBadge status={a.status}>{a.status_display}</StatusBadge><span className="tiny muted">№{a.id} от {dateTime(a.created_at)}</span></div>
                    <h3 className="mt-8">{a.program_info.bank_name} · {a.program_info.name}</h3>
                    {a.apartment_info && <Link to={`/apartments/${a.apartment}`} className="small link">ЖК «{a.apartment_info.complex_name}», кв. {a.apartment_info.number}</Link>}
                  </div>
                  <div className="text-right"><div className="small muted">Платёж</div><div style={{ fontSize: 26, fontWeight: 800 }}>{money(a.monthly_payment)}</div></div>
                </div>
                <div className="grid-4 mt-16" style={{ gap: 12 }}>
                  <div><div className="tiny muted">Стоимость</div><b>{money(a.property_price)}</b></div>
                  <div><div className="tiny muted">Взнос</div><b>{money(a.down_payment)}</b></div>
                  <div><div className="tiny muted">Кредит</div><b>{money(a.loan_amount)}</b></div>
                  <div><div className="tiny muted">Ставка / срок</div><b>{Number(a.rate)}% · {a.term_years} лет</b></div>
                </div>
                {!closed && (
                  <div className="status-timeline mt-16">
                    {MORTGAGE_STEPS.map(([s, l], i) => <div key={s} className={`st ${i < idx ? 'done' : i === idx ? (a.status === 'approved' ? 'done' : 'cur') : ''}`}><div className="bar" />{l}</div>)}
                  </div>
                )}
                {a.manager_comment && <div className="small mt-16" style={{ background: 'var(--bg)', padding: '10px 14px', borderRadius: 10 }}><b>Комментарий:</b> {a.manager_comment}</div>}
                {['new', 'in_review'].includes(a.status) && <button className="btn btn-ghost btn-sm mt-16" onClick={() => cancel(a)}>Отозвать заявку</button>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function Favorites() {
  const [list, setList] = useState(null)
  const load = () => api.get('/favorites/').then((r) => setList(r.data))
  useEffect(() => { load() }, [])
  if (!list) return <PageLoader />
  return (
    <div>
      <div className="page-title"><div><h1>Избранное</h1><p className="muted mt-8">Квартиры, которые вы отметили сердечком.</p></div></div>
      {list.length ? (
        <div className="apt-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {list.map((f) => <ApartmentCard key={f.id} a={f.apartment} onFavoriteChange={(v) => !v && setList((xs) => xs.filter((x) => x.id !== f.id))} />)}
        </div>
      ) : <Empty icon={Heart} title="Пока пусто" text="Добавляйте понравившиеся квартиры, чтобы вернуться к ним позже." action={<Link to="/apartments" className="btn btn-accent">В каталог</Link>} />}
    </div>
  )
}

export function Profile() {
  const { user, setUser } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState({ first_name: user.first_name, last_name: user.last_name, middle_name: user.middle_name, phone: user.phone })
  const [pwd, setPwd] = useState({ old_password: '', new_password: '' })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const save = async (e) => {
    e.preventDefault(); setSaving(true)
    try { const { data } = await api.patch('/auth/me/', form); setUser(data); toast('Профиль сохранён') }
    catch (err) { toast(errorText(err), 'error') } finally { setSaving(false) }
  }
  const changePwd = async (e) => {
    e.preventDefault(); setErrors({})
    try { await api.post('/auth/change-password/', pwd); toast('Пароль изменён'); setPwd({ old_password: '', new_password: '' }) }
    catch (err) { setErrors(fieldErrors(err)) }
  }
  return (
    <div className="stack-lg">
      <div className="page-title"><div><h1>Профиль</h1></div></div>
      <form className="card stack-lg" onSubmit={save}>
        <h3>Личные данные</h3>
        <div className="form-grid">
          <Field label="Фамилия"><input className="input" value={form.last_name} onChange={set('last_name')} /></Field>
          <Field label="Имя"><input className="input" value={form.first_name} onChange={set('first_name')} /></Field>
          <Field label="Отчество"><input className="input" value={form.middle_name} onChange={set('middle_name')} /></Field>
          <Field label="Телефон"><input className="input" type="tel" value={form.phone} onChange={set('phone')} /></Field>
          <Field label="Email" hint="Email используется для входа и подтверждения кодом"><input className="input" value={user.email} disabled /></Field>
          <Field label="Роль"><input className="input" value={user.role_display} disabled /></Field>
        </div>
        <div><button className="btn" disabled={saving}>{saving ? <Spinner /> : 'Сохранить'}</button></div>
      </form>
      <form className="card stack-lg" onSubmit={changePwd}>
        <div className="row"><KeyRound size={20} /><h3>Смена пароля</h3></div>
        <div className="form-grid">
          <Field label="Текущий пароль" error={errors.old_password}><input className="input" type="password" required value={pwd.old_password} onChange={(e) => setPwd({ ...pwd, old_password: e.target.value })} autoComplete="current-password" /></Field>
          <Field label="Новый пароль" error={errors.new_password}><input className="input" type="password" required value={pwd.new_password} onChange={(e) => setPwd({ ...pwd, new_password: e.target.value })} autoComplete="new-password" /></Field>
        </div>
        <div className="discount-box" style={{ background: 'var(--info-50)', color: 'var(--info)', marginTop: 0 }}>
          Двухфакторная аутентификация включена: при каждом входе мы отправляем код на {user.email}.
        </div>
        <div><button className="btn btn-outline">Изменить пароль</button></div>
      </form>
    </div>
  )
}
