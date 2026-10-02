import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Heart, LayoutDashboard, LogOut, Mail, MapPin, Menu, Phone, Scale, Settings, User, Users, X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useCompare } from '../context/UiContext'
import { initials } from '../utils/format'
import { Logo, PageLoader } from './ui'

const NAV = [
  { to: '/', label: 'О компании', end: true },
  { to: '/apartments', label: 'Квартиры' },
  { to: '/complexes', label: 'Проекты' },
  { to: '/mortgage', label: 'Ипотека' },
  { to: '/loyalty', label: 'Скидки' },
  { to: '/news', label: 'Новости' },
]

export function Header() {
  const { user, isManager, isAdmin, logout } = useAuth()
  const compare = useCompare()
  const [scrolled, setScrolled] = useState(false)
  const [menu, setMenu] = useState(false)
  const [mobile, setMobile] = useState(false)
  const loc = useLocation()
  const nav = useNavigate()
  const ref = useRef(null)
  const inManager = loc.pathname.startsWith('/manager')
  const toPanel = isAdmin && inManager ? '/admin' : '/manager'
  const panelLabel = isAdmin && inManager ? 'Админ-панель' : 'Панель'

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  useEffect(() => { setMenu(false); setMobile(false) }, [loc.pathname])
  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setMenu(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  return (
    <>
      <header className={`header ${scrolled ? 'scrolled' : ''}`}>
        <div className="container">
          <Logo />
          <nav className="nav" aria-label="Основное меню">
            {NAV.map((n) => <NavLink key={n.to} to={n.to} end={n.end}>{n.label}</NavLink>)}
          </nav>
          <div className="header-actions">
            {isManager && (
              <Link to={toPanel} className="btn btn-sm btn-outline panel-link hide-sm" title={panelLabel}>
                <LayoutDashboard size={16} /><span className="label">{panelLabel}</span>
              </Link>
            )}
            <Link to="/compare" className={`icon-btn hide-sm ${compare.ids.length ? 'active' : ''}`} title="Сравнение" aria-label="Сравнение">
              <Scale size={18} />
              {compare.ids.length > 0 && <span className="count">{compare.ids.length}</span>}
            </Link>
            {user && (
              <Link to="/account/favorites" className="icon-btn hide-sm" title="Избранное" aria-label="Избранное"><Heart size={18} /></Link>
            )}
            {user ? (
              <div className="user-menu" ref={ref}>
                <button className="user-trigger" onClick={() => setMenu((v) => !v)} aria-expanded={menu}>
                  <span className="avatar">{initials(user)}</span>
                  <span className="hide-sm small" style={{ fontWeight: 600 }}>{user.first_name || 'Кабинет'}</span>
                </button>
                {menu && (
                  <div className="dropdown">
                    <div className="dropdown-head">
                      <div style={{ fontWeight: 700 }}>{user.first_name} {user.last_name}</div>
                      <div className="tiny muted">{user.email}</div>
                      <div className="row mt-8" style={{ gap: 6 }}>
                        <span className="badge badge-dark">{user.role_display}</span>
                        {user.loyalty_level && <span className="badge badge-accent">{user.loyalty_level.name} · −{Number(user.discount_percent)}%</span>}
                      </div>
                    </div>
                    <div className="sep" />
                    <Link to="/account"><User size={18} /> Личный кабинет</Link>
                    <Link to="/account/favorites"><Heart size={18} /> Избранное</Link>
                    {isManager && <Link to="/manager"><LayoutDashboard size={18} /> Панель менеджера</Link>}
                    {isAdmin && <Link to="/admin"><Users size={18} /> Администрирование</Link>}
                    {isAdmin && <a href="/django-admin/" target="_blank" rel="noreferrer"><Settings size={18} /> Django admin</a>}
                    <div className="sep" />
                    <button onClick={async () => { await logout(); nav('/') }}><LogOut size={18} /> Выйти</button>
                  </div>
                )}
              </div>
            ) : (
              <Link to="/login" className="btn btn-sm">Войти</Link>
            )}
            <button className="icon-btn burger" onClick={() => setMobile((v) => !v)} aria-label="Меню">
              {mobile ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>
      <nav className={`mobile-nav ${mobile ? 'open' : ''}`}>
        {NAV.map((n) => <NavLink key={n.to} to={n.to} end={n.end}>{n.label}</NavLink>)}
        <NavLink to="/compare">Сравнение {compare.ids.length ? `(${compare.ids.length})` : ''}</NavLink>
        {user ? <NavLink to="/account">Личный кабинет</NavLink> : <NavLink to="/login">Войти</NavLink>}
      </nav>
    </>
  )
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="stack">
            <Logo light />
            <p className="small" style={{ maxWidth: 320 }}>
              Строим кварталы, в которых хочется жить. Все проекты — по 214-ФЗ с эскроу-счетами.
            </p>
          </div>
          <div>
            <h4>Покупателям</h4>
            <ul>
              <li><Link to="/apartments">Выбрать квартиру</Link></li>
              <li><Link to="/mortgage">Ипотека</Link></li>
              <li><Link to="/loyalty">Программа лояльности</Link></li>
              <li><Link to="/compare">Сравнение</Link></li>
            </ul>
          </div>
          <div>
            <h4>Компания</h4>
            <ul>
              <li><Link to="/">О застройщике</Link></li>
              <li><Link to="/complexes">Проекты</Link></li>
              <li><Link to="/news">Новости</Link></li>
              <li><Link to="/#contacts">Контакты</Link></li>
            </ul>
          </div>
          <div>
            <h4>Офис продаж</h4>
            <ul>
              <li className="row" style={{ gap: 8 }}><Phone size={16} /> +7 (800) 555-35-35</li>
              <li className="row" style={{ gap: 8 }}><Mail size={16} /> sales@novyi-gorizont.local</li>
              <li className="row" style={{ gap: 8, alignItems: 'flex-start' }}><MapPin size={16} style={{ marginTop: 3 }} /> Москва, Пресненский пр-т, 8</li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} «Новый Горизонт». Демонстрационный проект.</span>
          <span>Информация на сайте не является публичной офертой.</span>
        </div>
      </div>
    </footer>
  )
}

export function CompareBar() {
  const { ids, clear } = useCompare()
  const loc = useLocation()
  if (!ids.length || loc.pathname === '/compare') return null
  return (
    <div className="compare-bar">
      <Scale size={18} />
      <span className="small"><b>{ids.length}</b> из 4 в сравнении</span>
      <button className="btn btn-sm btn-ghost" style={{ color: '#fff' }} onClick={clear}>Очистить</button>
      <Link to="/compare" className="btn btn-sm btn-accent">Сравнить</Link>
    </div>
  )
}

export default function Layout() {
  const loc = useLocation()
  useEffect(() => {
    if (loc.hash) {
      const el = document.getElementById(loc.hash.slice(1))
      if (el) { setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 50); return }
    }
    window.scrollTo(0, 0)
  }, [loc.pathname, loc.hash])
  const bare = ['/login', '/register', '/forgot'].includes(loc.pathname)
  return (
    <>
      <Header />
      <main><Outlet /></main>
      {!bare && <Footer />}
      <CompareBar />
    </>
  )
}

/** Защита маршрутов по ролям */
export function RequireAuth({ role, children }) {
  const { user, loading } = useAuth()
  const loc = useLocation()
  if (loading) return <PageLoader />
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />
  if (role === 'manager' && !['manager', 'admin'].includes(user.role)) return <Navigate to="/account" replace />
  if (role === 'admin' && user.role !== 'admin') return <Navigate to="/account" replace />
  return children
}
