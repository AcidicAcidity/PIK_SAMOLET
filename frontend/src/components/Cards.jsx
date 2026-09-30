import { Link, useNavigate } from 'react-router-dom'
import { Building2, Heart, Layers, MapPin, Maximize2, Scale, Train } from 'lucide-react'
import { useState } from 'react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useCompare, useToast } from '../context/UiContext'
import { area, money, moneyShort, roomsLong } from '../utils/format'
import CityArt from './CityArt'
import FloorPlan from './FloorPlan'

export function FavoriteButton({ apartment, onChange }) {
  const { user } = useAuth()
  const toast = useToast()
  const nav = useNavigate()
  const [fav, setFav] = useState(apartment.is_favorite)
  const toggle = async (e) => {
    e.preventDefault(); e.stopPropagation()
    if (!user) { toast('Войдите, чтобы добавлять квартиры в избранное', 'info'); nav('/login'); return }
    const next = !fav
    setFav(next)
    try {
      if (next) await api.post(`/apartments/${apartment.id}/favorite/`)
      else await api.delete(`/apartments/${apartment.id}/favorite/`)
      toast(next ? 'Добавлено в избранное' : 'Удалено из избранного')
      onChange?.(next)
    } catch { setFav(!next) }
  }
  return (
    <button className={`icon-btn ${fav ? 'active' : ''}`} onClick={toggle} aria-pressed={fav} title="В избранное" aria-label="В избранное">
      <Heart size={18} fill={fav ? 'currentColor' : 'none'} />
    </button>
  )
}

export function CompareButton({ id }) {
  const compare = useCompare()
  const toast = useToast()
  const on = compare.has(id)
  return (
    <button
      className={`icon-btn ${on ? 'active' : ''}`}
      title="Сравнить" aria-label="Сравнить" aria-pressed={on}
      onClick={(e) => {
        e.preventDefault(); e.stopPropagation()
        const r = compare.toggle(id)
        if (r === 'full') toast('В сравнении может быть не более 4 квартир', 'error')
        else toast(r === 'added' ? 'Добавлено в сравнение' : 'Убрано из сравнения', 'info')
      }}
    >
      <Scale size={18} />
    </button>
  )
}

export function PriceBlock({ a, size = 'md' }) {
  const discount = Number(a.discount_percent) > 0 && a.status === 'available'
  return (
    <div>
      {a.old_price && <div className="price-old">{money(a.old_price)}</div>}
      {discount && <div className="price-old">{money(a.price)}</div>}
      <div className={size === 'lg' ? 'price-big' : 'price-main'}>{money(discount ? a.discounted_price : a.price)}</div>
      <div className="price-m2">{money(a.price_per_m2)} за м²</div>
    </div>
  )
}

const STATUS_LABEL = { reserved: 'Забронирована', sold: 'Продана' }

export function ApartmentCard({ a, onFavoriteChange }) {
  const discount = Number(a.discount_percent) > 0 && a.status === 'available'
  return (
    <Link to={`/apartments/${a.id}`} className="apt-card">
      <div className="apt-plan">
        <div className="top-badges">
          {a.status !== 'available' && <span className="badge badge-dark">{STATUS_LABEL[a.status]}</span>}
          {a.old_price && <span className="badge badge-accent">Скидка</span>}
          {discount && <span className="badge badge-accent">−{Number(a.discount_percent)}% для вас</span>}
        </div>
        <div className="apt-actions">
          <CompareButton id={a.id} />
          <FavoriteButton apartment={a} onChange={onFavoriteChange} />
        </div>
        <FloorPlan apartment={a} showLabels={false} />
      </div>
      <div className="apt-info">
        <div className="apt-title">{roomsLong(a.rooms)}, {area(a.area)}</div>
        <div className="apt-sub">ЖК «{a.complex_name}», корп. {a.building_number} · кв. {a.number}</div>
        <div className="apt-specs">
          <span><Layers size={15} /> {a.floor} из {a.floors_total} эт.</span>
          <span><Maximize2 size={15} /> {a.finishing_display}</span>
          {a.completion_quarter && <span><Building2 size={15} /> {a.completion_quarter}</span>}
        </div>
        <div className="apt-price">
          <PriceBlock a={a} />
        </div>
      </div>
    </Link>
  )
}

export function ComplexCard({ c }) {
  return (
    <Link to={`/complexes/${c.slug}`} className="complex-card card-hover">
      <div className="complex-cover">
        {c.image ? <img src={c.image} alt={c.name} /> : <CityArt seed={c.slug} color={c.accent_color} />}
        <div className="badges">
          <span className="badge badge-glass">{c.housing_class_display}</span>
          {c.completion_year && <span className="badge badge-glass">Сдача {c.completion_year}</span>}
        </div>
      </div>
      <div className="complex-body">
        <h3>ЖК «{c.name}»</h3>
        <p className="muted small">{c.tagline}</p>
        <div className="complex-meta">
          <span><MapPin size={15} /> {c.district}</span>
          {c.metro && <span><Train size={15} /> {c.metro}, {c.metro_minutes} мин</span>}
        </div>
        <div className="complex-price">
          <div>
            <div className="tiny muted">Квартиры от</div>
            <b>{c.stats?.min_price ? moneyShort(c.stats.min_price) : '—'}</b>
          </div>
          <span className="badge badge-success">{c.stats?.available || 0} в продаже</span>
        </div>
      </div>
    </Link>
  )
}
