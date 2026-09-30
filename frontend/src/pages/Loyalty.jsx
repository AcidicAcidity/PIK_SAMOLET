import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, Crown, Gift, TrendingUp, UserPlus } from 'lucide-react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import { moneyShort } from '../utils/format'

export default function Loyalty() {
  const { user } = useAuth()
  const [levels, setLevels] = useState([])
  useEffect(() => { api.get('/loyalty/levels/').then((r) => setLevels(r.data)) }, [])
  const current = user?.loyalty_level?.id

  return (
    <div className="container" style={{ paddingTop: 32 }}>
      <div className="promo-banner">
        <div className="stack-lg" style={{ justifyContent: 'center' }}>
          <div className="eyebrow">Программа лояльности</div>
          <h1 style={{ fontSize: 'clamp(32px, 4vw, 52px)' }}>Скидка растёт вместе с вами</h1>
          <p className="muted" style={{ fontSize: 18 }}>Каждый зарегистрированный клиент сразу получает уровень «{levels[0]?.name || 'Старт'}» и персональную скидку. Покупайте — и переходите на следующий уровень.</p>
          <div className="row wrap">
            {user ? <Link to="/account" className="btn btn-accent btn-lg">Мой уровень <ArrowRight size={18} /></Link>
              : <Link to="/register" className="btn btn-accent btn-lg">Стать участником <ArrowRight size={18} /></Link>}
            <Link to="/apartments" className="btn btn-outline btn-lg">Выбрать квартиру</Link>
          </div>
        </div>
        <div className="promo-visual" style={{ padding: 40 }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: 360, height: 260 }}>
            {levels.slice(-3).map((l, i) => (
              <div key={l.id} className="loyalty-card" style={{ background: `linear-gradient(135deg, ${l.color}, #0d1b2a)`, position: 'absolute', inset: 0, transform: `translate(${(i - 1) * 26}px, ${(i - 1) * 26}px) rotate(${(i - 1) * 4}deg)`, zIndex: i }}>
                <div className="row-between"><span className="lvl">{l.name}</span><Crown size={26} /></div>
                <div><div className="pct">−{Number(l.discount_percent)}%</div><div style={{ opacity: .75 }} className="small">на все квартиры</div></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <section className="section-sm">
        <div className="grid-3">
          {[[UserPlus, 'Зарегистрируйтесь', 'Подтвердите email — скидка начнёт действовать сразу.'],
            [Gift, 'Покупайте со скидкой', 'Цена с учётом вашего уровня видна в каталоге и фиксируется при бронировании.'],
            [TrendingUp, 'Повышайте уровень', 'Уровень рассчитывается автоматически по сумме завершённых сделок.']].map(([Icon, t, d]) => (
            <div key={t} className="adv-card"><div className="adv-icon"><Icon size={26} /></div><h3>{t}</h3><p>{d}</p></div>
          ))}
        </div>
      </section>

      <section className="section-sm">
        <div className="section-head"><div><div className="eyebrow">Уровни</div><h2>Условия программы</h2></div></div>
        <div className="grid-4">
          {levels.map((l) => (
            <div key={l.id} className={`level-tile ${current === l.id ? 'current' : ''}`}>
              <div className="stripe" style={{ background: l.color }} />
              <div className="row-between mt-8">
                <h3>{l.name}</h3>
                {current === l.id && <span className="badge badge-dark">Ваш уровень</span>}
              </div>
              <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-0.04em', margin: '12px 0 4px' }}>{Number(l.discount_percent).toLocaleString('ru-RU')}%</div>
              <div className="small muted mb-16">{Number(l.min_purchases_amount) === 0 ? 'сразу после регистрации' : `при покупках от ${moneyShort(l.min_purchases_amount)}`}</div>
              <ul className="feature-list small">
                {l.perks_list.map((p) => <li key={p}><Check size={16} />{p}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
