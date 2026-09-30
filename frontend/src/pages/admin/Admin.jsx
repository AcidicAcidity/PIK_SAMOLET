import { useEffect, useState } from 'react'
import { Crown, Percent, Save, Search, Settings, ShieldCheck, Users } from 'lucide-react'
import api, { errorText } from '../../api/client'
import { Empty, PageLoader, Pagination } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/UiContext'
import { date, initials, moneyShort } from '../../utils/format'


export default function AdminPanel() {
  const [tab, setTab] = useState('users')
  return (
    <div className="container" style={{ padding: '32px 20px 80px' }}>
      <div className="page-title">
        <div><div className="eyebrow">Администрирование</div><h1>Управление системой</h1></div>
        <a href="/django-admin/" target="_blank" rel="noreferrer" className="btn btn-outline"><Settings size={18} /> Django admin</a>
      </div>
      <div className="tabs" role="tablist">
        <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}><Users size={16} /> Пользователи и роли</button>
        <button className={tab === 'loyalty' ? 'active' : ''} onClick={() => setTab('loyalty')}><Crown size={16} /> Программа лояльности</button>
        <button className={tab === 'programs' ? 'active' : ''} onClick={() => setTab('programs')}><Percent size={16} /> Ипотечные программы</button>
      </div>
      {tab === 'users' && <UsersTab />}
      {tab === 'loyalty' && <LoyaltyTab />}
      {tab === 'programs' && <ProgramsTab />}
    </div>
  )
}

function UsersTab() {
  const { user: me } = useAuth()
  const toast = useToast()
  const [role, setRole] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [levels, setLevels] = useState([])
  useEffect(() => { api.get('/loyalty/levels/').then((r) => setLevels(r.data)) }, [])
  const load = () => api.get('/admin/users/', { params: { role: role || undefined, search: search || undefined, page } }).then((r) => setData(r.data))
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t) }, [role, search, page]) // eslint-disable-line

  const patch = async (u, body, msg) => {
    try { await api.patch(`/admin/users/${u.id}/`, body); toast(msg); load() } catch (e) { toast(errorText(e), 'error') }
  }
  return (
    <div>
      <div className="grid-3 mb-24">
        {[['client', 'Клиент', 'Каталог, бронирование, избранное, заявки на ипотеку, программа лояльности.'],
          ['manager', 'Менеджер', 'Всё, что клиент + обработка броней, ипотечных заявок, обращений и редактирование квартир.'],
          ['admin', 'Администратор', 'Всё, что менеджер + управление пользователями, ролями, уровнями лояльности и ипотечными программами.']].map(([r, t, d]) => (
          <div key={r} className="card" style={{ padding: 20 }}>
            <div className="row" style={{ gap: 8 }}><ShieldCheck size={18} /><b>{t}</b></div>
            <p className="small muted mt-8">{d}</p>
          </div>
        ))}
      </div>
      <div className="toolbar">
        <div className="chips">
          {[['', 'Все'], ['client', 'Клиенты'], ['manager', 'Менеджеры'], ['admin', 'Администраторы']].map(([v, l]) => (
            <button key={v} className={`chip ${role === v ? 'active' : ''}`} onClick={() => { setRole(v); setPage(1) }}>{l}</button>
          ))}
        </div>
        <div style={{ position: 'relative', minWidth: 260 }}>
          <Search size={16} style={{ position: 'absolute', left: 14, top: 14, color: 'var(--muted)' }} />
          <input className="input" style={{ height: 44, paddingLeft: 38 }} placeholder="Email, имя, телефон" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
      </div>
      {!data ? <PageLoader /> : !data.results.length ? <Empty icon={Users} title="Никого не нашли" /> : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Пользователь</th><th>Роль</th><th>Лояльность</th><th>Покупки</th><th>Регистрация</th><th>Доступ</th></tr></thead>
              <tbody>
                {data.results.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="row">
                        <span className="avatar" style={{ opacity: u.is_active ? 1 : 0.4 }}>{initials(u)}</span>
                        <div><b>{u.first_name} {u.last_name}</b> {u.id === me.id && <span className="badge">вы</span>}<div className="tiny muted">{u.email}{!u.email_verified && ' · email не подтверждён'}</div></div>
                      </div>
                    </td>
                    <td>
                      <select className="select" style={{ height: 38, fontSize: 14, minWidth: 160 }} value={u.role} disabled={u.id === me.id}
                        onChange={(e) => patch(u, { role: e.target.value }, 'Роль изменена')}>
                        <option value="client">Клиент</option><option value="manager">Менеджер</option><option value="admin">Администратор</option>
                      </select>
                    </td>
                    <td>
                      <select className="select" style={{ height: 38, fontSize: 14, minWidth: 170 }} value={u.loyalty_level_override ?? ''}
                        onChange={(e) => patch(u, { loyalty_level_override: e.target.value || null }, 'Уровень лояльности обновлён')}>
                        <option value="">Авто ({u.loyalty_level?.name || '—'})</option>
                        {levels.map((l) => <option key={l.id} value={l.id}>{l.name} · {Number(l.discount_percent)}%</option>)}
                      </select>
                    </td>
                    <td className="small nowrap">{moneyShort(u.purchases_total)}</td>
                    <td className="small nowrap">{date(u.date_joined)}</td>
                    <td>
                      <label className="checkbox small">
                        <input type="checkbox" checked={u.is_active} disabled={u.id === me.id}
                          onChange={(e) => patch(u, { is_active: e.target.checked }, e.target.checked ? 'Доступ восстановлен' : 'Пользователь заблокирован')} />
                        {u.is_active ? 'Активен' : 'Заблокирован'}
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} count={data.count} onChange={setPage} />
        </>
      )}
    </div>
  )
}

function LoyaltyTab() {
  const toast = useToast()
  const [levels, setLevels] = useState(null)
  const load = () => api.get('/loyalty/levels/').then((r) => setLevels(r.data))
  useEffect(() => { load() }, [])
  const set = (id, k, v) => setLevels((ls) => ls.map((l) => (l.id === id ? { ...l, [k]: v, _dirty: true } : l)))
  const save = async (l) => {
    try {
      await api.patch(`/loyalty/levels/${l.id}/`, { name: l.name, min_purchases_amount: l.min_purchases_amount, discount_percent: l.discount_percent, color: l.color, perks: l.perks })
      toast(`Уровень «${l.name}» сохранён`); load()
    } catch (e) { toast(errorText(e), 'error') }
  }
  if (!levels) return <PageLoader />
  return (
    <div className="grid-2">
      {levels.map((l) => (
        <div key={l.id} className="level-tile stack">
          <div className="stripe" style={{ background: l.color }} />
          <div className="form-grid mt-8">
            <label className="field"><span className="small muted">Название</span><input className="input" value={l.name} onChange={(e) => set(l.id, 'name', e.target.value)} /></label>
            <label className="field"><span className="small muted">Цвет</span><input className="input" type="color" value={l.color} onChange={(e) => set(l.id, 'color', e.target.value)} style={{ padding: 6 }} /></label>
            <label className="field"><span className="small muted">Покупки от, ₽</span><input className="input" value={l.min_purchases_amount} onChange={(e) => set(l.id, 'min_purchases_amount', e.target.value)} /></label>
            <label className="field"><span className="small muted">Скидка, %</span><input className="input" value={l.discount_percent} onChange={(e) => set(l.id, 'discount_percent', e.target.value)} /></label>
            <label className="field full"><span className="small muted">Привилегии (по одной на строку)</span><textarea className="textarea" value={l.perks} onChange={(e) => set(l.id, 'perks', e.target.value)} /></label>
          </div>
          {l._dirty && <button className="btn btn-accent" onClick={() => save(l)}><Save size={16} /> Сохранить</button>}
        </div>
      ))}
    </div>
  )
}

function ProgramsTab() {
  const toast = useToast()
  const [list, setList] = useState(null)
  const load = () => api.get('/mortgage/programs/').then((r) => setList(r.data))
  useEffect(() => { load() }, [])
  const patch = async (p, body) => {
    try { await api.patch(`/mortgage/programs/${p.id}/`, body); toast('Программа обновлена'); load() } catch (e) { toast(errorText(e), 'error') }
  }
  if (!list) return <PageLoader />
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>Банк / программа</th><th>Ставка, %</th><th>Взнос от, %</th><th>Срок до</th><th>Активна</th></tr></thead>
        <tbody>
          {list.map((p) => (
            <tr key={p.id}>
              <td><b>{p.name}</b><div className="tiny muted">{p.bank_name}</div></td>
              <td><input className="input" style={{ height: 38, width: 100 }} defaultValue={p.rate} onBlur={(e) => e.target.value !== p.rate && patch(p, { rate: e.target.value })} /></td>
              <td><input className="input" style={{ height: 38, width: 100 }} defaultValue={p.min_down_payment_percent} onBlur={(e) => e.target.value !== p.min_down_payment_percent && patch(p, { min_down_payment_percent: e.target.value })} /></td>
              <td className="small">{p.max_term_years} лет</td>
              <td><label className="checkbox small"><input type="checkbox" checked={p.is_active} onChange={(e) => patch(p, { is_active: e.target.checked })} />{p.is_active ? 'Да' : 'Нет'}</label></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
