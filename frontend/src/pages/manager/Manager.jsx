import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import {
  CalendarDays, Check, Home as HomeIcon, LayoutDashboard, Phone, Save, Search, TrendingUp, Wallet, X,
} from 'lucide-react'
import api, { errorText } from '../../api/client'
import StackedBars from '../../components/StackedBars'
import { Empty, Field, Modal, PageLoader, Pagination, Spinner, StatusBadge } from '../../components/ui'
import { useToast } from '../../context/UiContext'
import { area, dateTime, money, moneyShort, num, roomsLabel } from '../../utils/format'

export default function ManagerLayout() {
  const [stats, setStats] = useState(null)
  useEffect(() => { api.get('/manager/stats/').then((r) => setStats(r.data)) }, [])
  return (
    <div className="container cabinet">
      <aside>
        <div className="card mb-16" style={{ padding: 20, background: 'var(--navy)', color: '#fff', border: 0 }}>
          <div className="small" style={{ opacity: .6 }}>Рабочее место</div>
          <b style={{ fontSize: 18 }}>Отдел продаж</b>
        </div>
        <nav className="side-nav">
          <NavLink to="/manager" end><LayoutDashboard size={18} /> Сводка</NavLink>
          <NavLink to="/manager/bookings"><CalendarDays size={18} /> Брони {stats?.bookings.pending > 0 && <span className="count">{stats.bookings.pending}</span>}</NavLink>
          <NavLink to="/manager/mortgage"><Wallet size={18} /> Ипотека {stats?.mortgage.new > 0 && <span className="count">{stats.mortgage.new}</span>}</NavLink>
          <NavLink to="/manager/leads"><Phone size={18} /> Обращения {stats?.leads_new > 0 && <span className="count">{stats.leads_new}</span>}</NavLink>
          <NavLink to="/manager/apartments"><HomeIcon size={18} /> Квартиры</NavLink>
        </nav>
      </aside>
      <section><Outlet /></section>
    </div>
  )
}

export function Dashboard() {
  const [s, setS] = useState(null)
  useEffect(() => { api.get('/manager/stats/').then((r) => setS(r.data)) }, [])
  if (!s) return <PageLoader />
  const kpis = [
    [CalendarDays, 'Новые брони', s.bookings.pending, 'ждут подтверждения', '/manager/bookings?status=pending'],
    [Wallet, 'Ипотека: новые', s.mortgage.new, `в банке: ${s.mortgage.in_review}`, '/manager/mortgage?status=new'],
    [Phone, 'Обращения', s.leads_new, 'необработанных', '/manager/leads'],
    [TrendingUp, 'Выручка', moneyShort(s.bookings.revenue || 0), `сделок: ${s.bookings.completed}`, '/manager/bookings?status=completed'],
  ]
  return (
    <div className="stack-lg">
      <div className="page-title"><div><h1>Сводка продаж</h1><p className="muted mt-8">Клиентов в базе: {num(s.clients)}</p></div></div>
      <div className="grid-4">
        {kpis.map(([Icon, l, v, h, to]) => (
          <Link key={l} to={to} className="kpi card-hover"><div className="label"><Icon size={16} /> {l}</div><div className="value">{v}</div><div className="hint">{h}</div></Link>
        ))}
      </div>
      <div className="grid-2" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
        <div className="card">
          <h3 className="mb-16">Квартиры по проектам</h3>
          <StackedBars horizontal format={(v) => `${v} кв.`}
            series={[{ name: 'Продано', color: '#2a78d6' }, { name: 'Забронировано', color: '#eb6834' }, { name: 'В продаже', color: '#1baf7a' }]}
            data={s.by_complex.map((c) => ({ label: `ЖК «${c.name}»`, values: [c.sold, c.reserved, c.total - c.sold - c.reserved] }))} />
        </div>
        <div className="card stack">
          <h3>Склад квартир</h3>
          {[['В продаже', s.apartments.available, 'badge-success'], ['Забронировано', s.apartments.reserved, 'badge-warning'], ['Продано', s.apartments.sold, 'badge-dark']].map(([l, v, b]) => (
            <div key={l} className="row-between" style={{ padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
              <span className={`badge ${b}`}><span className="dot" />{l}</span><b style={{ fontSize: 22 }}>{v}</b>
            </div>
          ))}
          <div className="row-between"><span className="muted">Всего</span><b>{s.apartments.total}</b></div>
        </div>
      </div>
    </div>
  )
}

function useList(url, initialStatus = '') {
  const [status, setStatus] = useState(new URLSearchParams(window.location.search).get('status') || initialStatus)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const load = () => api.get(url, { params: { status: status || undefined, search: search || undefined, page } }).then((r) => setData(r.data))
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t) }, [status, search, page]) // eslint-disable-line
  return { status, setStatus: (v) => { setStatus(v); setPage(1) }, search, setSearch: (v) => { setSearch(v); setPage(1) }, page, setPage, data, reload: load }
}

function ListToolbar({ list, statuses, placeholder }) {
  return (
    <div className="toolbar">
      <div className="chips">
        {statuses.map(([v, l]) => <button key={v} className={`chip ${list.status === v ? 'active' : ''}`} onClick={() => list.setStatus(v)}>{l}</button>)}
      </div>
      <div style={{ position: 'relative', minWidth: 260 }}>
        <Search size={16} style={{ position: 'absolute', left: 14, top: 14, color: 'var(--muted)' }} />
        <input className="input" style={{ height: 44, paddingLeft: 38 }} placeholder={placeholder} value={list.search} onChange={(e) => list.setSearch(e.target.value)} />
      </div>
    </div>
  )
}

export function ManagerBookings() {
  const list = useList('/manager/bookings/')
  const toast = useToast()
  const [action, setAction] = useState(null) // { booking, type }
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const run = async () => {
    setBusy(true)
    try {
      await api.post(`/manager/bookings/${action.booking.id}/${action.type}/`, { comment })
      toast('Статус брони обновлён, клиент получил уведомление')
      setAction(null); setComment(''); list.reload()
    } catch (e) { toast(errorText(e), 'error') } finally { setBusy(false) }
  }
  const TITLES = { confirm: 'Подтвердить бронь', reject: 'Отклонить бронь', complete: 'Завершить сделку' }
  return (
    <div>
      <div className="page-title"><div><h1>Брони</h1><p className="muted mt-8">Подтверждение фиксирует цену на 14 дней. Завершение сделки учитывается в программе лояльности клиента.</p></div></div>
      <ListToolbar list={list} placeholder="Поиск: клиент, ЖК, № квартиры"
        statuses={[['', 'Все'], ['pending', 'Новые'], ['confirmed', 'Подтверждены'], ['completed', 'Сделки'], ['rejected', 'Отклонены'], ['cancelled', 'Отменены']]} />
      {!list.data ? <PageLoader /> : !list.data.results.length ? <Empty icon={CalendarDays} title="Нет броней" text="По выбранному фильтру ничего не найдено." /> : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>№</th><th>Клиент</th><th>Квартира</th><th>Цена</th><th>Оплата</th><th>Статус</th><th>Создана</th><th /></tr></thead>
              <tbody>
                {list.data.results.map((b) => (
                  <tr key={b.id}>
                    <td>{b.id}</td>
                    <td><b>{b.client.first_name} {b.client.last_name}</b><div className="tiny muted">{b.client.email}</div><div className="tiny muted">{b.client.phone}</div></td>
                    <td><Link to={`/apartments/${b.apartment}`} className="link">{roomsLabel(b.apartment_info.rooms)}, {area(b.apartment_info.area)}</Link><div className="tiny muted">ЖК «{b.apartment_info.complex_name}», кв. {b.apartment_info.number}</div></td>
                    <td className="nowrap"><b>{money(b.final_price)}</b>{Number(b.discount_percent) > 0 && <div className="tiny muted">скидка {Number(b.discount_percent)}%</div>}</td>
                    <td className="small">{b.payment_method_display}</td>
                    <td><StatusBadge status={b.status}>{b.status_display}</StatusBadge>{b.comment && <div className="tiny muted mt-8" style={{ maxWidth: 200 }} title={b.comment}>«{b.comment.slice(0, 60)}»</div>}</td>
                    <td className="small nowrap">{dateTime(b.created_at)}</td>
                    <td>
                      <div className="actions">
                        {b.status === 'pending' && <button className="btn btn-sm btn-success" onClick={() => setAction({ booking: b, type: 'confirm' })}><Check size={14} /> Подтвердить</button>}
                        {b.status === 'confirmed' && <button className="btn btn-sm" onClick={() => setAction({ booking: b, type: 'complete' })}>Сделка</button>}
                        {['pending', 'confirmed'].includes(b.status) && <button className="btn btn-sm btn-danger" onClick={() => setAction({ booking: b, type: 'reject' })} aria-label="Отклонить"><X size={14} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={list.page} count={list.data.count} onChange={list.setPage} />
        </>
      )}
      <Modal open={!!action} onClose={() => setAction(null)} title={action && TITLES[action.type]}
        subtitle={action && `Бронь №${action.booking.id} · ${action.booking.client.email} · ${money(action.booking.final_price)}`}>
        <div className="stack-lg">
          <Field label="Комментарий для клиента" hint="Будет показан в личном кабинете и отправлен на email">
            <textarea className="textarea" value={comment} onChange={(e) => setComment(e.target.value)} />
          </Field>
          <button className={`btn btn-lg ${action?.type === 'reject' ? 'btn-danger' : 'btn-accent'}`} onClick={run} disabled={busy}>{busy ? <Spinner /> : action && TITLES[action.type]}</button>
        </div>
      </Modal>
    </div>
  )
}

const M_STATUSES = [['new', 'Новая'], ['in_review', 'В банке'], ['approved', 'Одобрена'], ['rejected', 'Отказ']]

export function ManagerMortgage() {
  const list = useList('/manager/mortgage/')
  const toast = useToast()
  const [edit, setEdit] = useState(null)
  const save = async () => {
    try {
      await api.patch(`/manager/mortgage/${edit.id}/`, { status: edit.status, manager_comment: edit.manager_comment })
      toast('Заявка обновлена'); setEdit(null); list.reload()
    } catch (e) { toast(errorText(e), 'error') }
  }
  return (
    <div>
      <div className="page-title"><div><h1>Заявки на ипотеку</h1></div></div>
      <ListToolbar list={list} placeholder="Поиск: ФИО, телефон, email" statuses={[['', 'Все'], ...M_STATUSES, ['cancelled', 'Отозваны']]} />
      {!list.data ? <PageLoader /> : !list.data.results.length ? <Empty icon={Wallet} title="Нет заявок" /> : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>№</th><th>Заёмщик</th><th>Программа</th><th>Кредит</th><th>Платёж / доход</th><th>Статус</th><th /></tr></thead>
              <tbody>
                {list.data.results.map((a) => {
                  const ratio = Number(a.monthly_payment) / Number(a.monthly_income || 1)
                  return (
                    <tr key={a.id}>
                      <td>{a.id}</td>
                      <td><b>{a.full_name}</b><div className="tiny muted">{a.phone} · {a.client_email}</div><div className="tiny muted">{a.employment_display}</div></td>
                      <td className="small">{a.program_info.bank_name}<div className="tiny muted">{a.program_info.name}, {Number(a.rate)}%</div></td>
                      <td className="nowrap"><b>{money(a.loan_amount)}</b><div className="tiny muted">{a.term_years} лет, взнос {money(a.down_payment)}</div></td>
                      <td className="nowrap">{money(a.monthly_payment)}<div className="tiny" style={{ color: ratio > 0.5 ? 'var(--danger)' : 'var(--success)' }}>{Math.round(ratio * 100)}% от дохода</div></td>
                      <td><StatusBadge status={a.status}>{a.status_display}</StatusBadge></td>
                      <td><div className="actions"><button className="btn btn-sm btn-outline" onClick={() => setEdit({ ...a })}>Изменить</button></div></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={list.page} count={list.data.count} onChange={list.setPage} />
        </>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit && `Заявка №${edit.id}`} subtitle={edit && `${edit.full_name} · ${edit.program_info.bank_name}`}>
        {edit && (
          <div className="stack-lg">
            <Field label="Статус">
              <div className="chips">{M_STATUSES.map(([v, l]) => <button key={v} className={`chip ${edit.status === v ? 'active' : ''}`} onClick={() => setEdit({ ...edit, status: v })}>{l}</button>)}</div>
            </Field>
            <Field label="Комментарий для клиента"><textarea className="textarea" value={edit.manager_comment} onChange={(e) => setEdit({ ...edit, manager_comment: e.target.value })} /></Field>
            <button className="btn btn-accent btn-lg" onClick={save}><Save size={18} /> Сохранить</button>
          </div>
        )}
      </Modal>
    </div>
  )
}

export function ManagerLeads() {
  const list = useList('/manager/leads/')
  const toast = useToast()
  const update = async (l, status) => {
    try { await api.patch(`/manager/leads/${l.id}/`, { status }); toast('Статус обновлён'); list.reload() } catch (e) { toast(errorText(e), 'error') }
  }
  return (
    <div>
      <div className="page-title"><div><h1>Обращения</h1><p className="muted mt-8">Заявки на звонок и консультацию с сайта.</p></div></div>
      <ListToolbar list={list} placeholder="Поиск: имя, телефон" statuses={[['', 'Все'], ['new', 'Новые'], ['in_progress', 'В работе'], ['done', 'Обработаны']]} />
      {!list.data ? <PageLoader /> : !list.data.results.length ? <Empty icon={Phone} title="Обращений нет" /> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Клиент</th><th>Тема</th><th>Сообщение</th><th>Получено</th><th>Статус</th></tr></thead>
            <tbody>
              {list.data.results.map((l) => (
                <tr key={l.id}>
                  <td><b>{l.name}</b><div className="small"><a href={`tel:${l.phone}`} className="link">{l.phone}</a></div>{l.email && <div className="tiny muted">{l.email}</div>}</td>
                  <td className="small">{l.topic_display}{l.apartment && <div><Link to={`/apartments/${l.apartment}`} className="link tiny">квартира #{l.apartment}</Link></div>}</td>
                  <td className="small" style={{ maxWidth: 320 }}>{l.message || '—'}</td>
                  <td className="small nowrap">{dateTime(l.created_at)}</td>
                  <td>
                    <select className="select" style={{ height: 38, fontSize: 14, minWidth: 150 }} value={l.status} onChange={(e) => update(l, e.target.value)}>
                      <option value="new">Новая</option><option value="in_progress">В работе</option><option value="done">Обработана</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function ManagerApartments() {
  const [complexes, setComplexes] = useState([])
  const [complex, setComplex] = useState('')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [edits, setEdits] = useState({})
  const toast = useToast()
  useEffect(() => { api.get('/complexes/').then((r) => setComplexes(r.data)) }, [])
  const load = () => api.get('/apartments/', {
    params: { complex: complex || undefined, status: status || 'available,reserved,sold', search: search || undefined, page },
  }).then((r) => setData(r.data))
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t) }, [complex, status, search, page]) // eslint-disable-line

  const save = async (a) => {
    const patch = edits[a.id]
    try {
      await api.patch(`/apartments/${a.id}/`, patch)
      toast(`Квартира №${a.number} обновлена`)
      setEdits((e) => { const n = { ...e }; delete n[a.id]; return n })
      load()
    } catch (e) { toast(errorText(e), 'error') }
  }
  const setEdit = (id, k, v) => setEdits((e) => ({ ...e, [id]: { ...e[id], [k]: v } }))

  return (
    <div>
      <div className="page-title"><div><h1>Квартиры</h1><p className="muted mt-8">Быстрое редактирование цен и статусов. Полное редактирование — в Django admin.</p></div></div>
      <div className="toolbar">
        <div className="row wrap">
          <select className="select" style={{ height: 44, width: 'auto' }} value={complex} onChange={(e) => { setComplex(e.target.value); setPage(1) }}>
            <option value="">Все ЖК</option>{complexes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="select" style={{ height: 44, width: 'auto' }} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
            <option value="">Все статусы</option><option value="available">В продаже</option><option value="reserved">Забронирована</option><option value="sold">Продана</option>
          </select>
        </div>
        <input className="input" style={{ height: 44, maxWidth: 240 }} placeholder="№ квартиры" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
      </div>
      {!data ? <PageLoader /> : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Кв.</th><th>ЖК / корпус</th><th>Тип</th><th>Этаж</th><th>Цена, ₽</th><th>Статус</th><th /></tr></thead>
              <tbody>
                {data.results.map((a) => {
                  const e = edits[a.id] || {}
                  return (
                    <tr key={a.id}>
                      <td><Link to={`/apartments/${a.id}`} className="link">№{a.number}</Link></td>
                      <td className="small">{a.complex_name}<div className="tiny muted">корп. {a.building_number}</div></td>
                      <td className="small nowrap">{roomsLabel(a.rooms)}, {area(a.area)}</td>
                      <td className="small">{a.floor}</td>
                      <td><input className="input" style={{ height: 38, width: 150, fontSize: 14 }} value={e.price ?? Number(a.price)} onChange={(ev) => setEdit(a.id, 'price', ev.target.value)} /></td>
                      <td>
                        <select className="select" style={{ height: 38, fontSize: 14, minWidth: 150 }} value={e.status ?? a.status} onChange={(ev) => setEdit(a.id, 'status', ev.target.value)}>
                          <option value="available">В продаже</option><option value="reserved">Забронирована</option><option value="sold">Продана</option>
                        </select>
                      </td>
                      <td><div className="actions">{edits[a.id] && <button className="btn btn-sm btn-accent" onClick={() => save(a)}><Save size={14} /> Сохранить</button>}</div></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} count={data.count} onChange={setPage} />
        </>
      )}
    </div>
  )
}

