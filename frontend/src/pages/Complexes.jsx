import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, Building2, CalendarDays, Check, ChevronRight, MapPin, Train } from 'lucide-react'
import api from '../api/client'
import CityArt from '../components/CityArt'
import { ApartmentCard, ComplexCard } from '../components/Cards'
import { Empty, PageLoader, Photo, sized } from '../components/ui'
import { moneyShort, num, roomsLabel } from '../utils/format'

export function ComplexList() {
  const [list, setList] = useState(null)
  useEffect(() => { api.get('/complexes/').then((r) => setList(r.data)) }, [])
  return (
    <div className="container" style={{ paddingTop: 32 }}>
      <div className="page-title">
        <div>
          <div className="eyebrow">Проекты</div>
          <h1>Жилые комплексы</h1>
          <p className="muted mt-8" style={{ maxWidth: 620 }}>Все наши проекты строятся по 214-ФЗ. Выберите комплекс, чтобы узнать об инфраструктуре, ходе строительства и доступных квартирах.</p>
        </div>
      </div>
      {!list ? <PageLoader /> : (
        <div className="grid-2">{list.map((c) => <ComplexCard key={c.id} c={c} />)}</div>
      )}
    </div>
  )
}

export function ComplexDetail() {
  const { slug } = useParams()
  const [c, setC] = useState(null)
  const [apts, setApts] = useState(null)
  const [rooms, setRooms] = useState('')
  const [err, setErr] = useState(false)

  useEffect(() => { api.get(`/complexes/${slug}/`).then((r) => setC(r.data)).catch(() => setErr(true)) }, [slug])
  useEffect(() => {
    api.get('/apartments/', { params: { complex_slug: slug, status: 'available', rooms: rooms || undefined, page_size: 6, ordering: 'price' } })
      .then((r) => setApts(r.data))
  }, [slug, rooms])

  if (err) return <div className="container section"><Empty icon={Building2} title="Проект не найден" action={<Link to="/complexes" className="btn">Все проекты</Link>} /></div>
  if (!c) return <PageLoader />

  return (
    <>
      <div className="container">
        <nav className="breadcrumbs"><Link to="/complexes">Проекты</Link><ChevronRight size={14} /><span>ЖК «{c.name}»</span></nav>
        <div className="hero-card" style={{ minHeight: 480, background: c.accent_color, '--hero-bg': c.accent_color }}>
          <div className="hero-content">
            <div className="hero-badges">
              <span className="badge">{c.housing_class_display}</span>
              <span className="badge"><CalendarDays size={14} /> Сдача {c.completion_year}</span>
            </div>
            <h1 style={{ fontSize: 'clamp(34px, 4.4vw, 54px)' }}>ЖК «{c.name}»</h1>
            <p>{c.tagline}</p>
            <div className="complex-meta" style={{ color: 'rgba(255,255,255,.85)' }}>
              <span><MapPin size={16} /> {c.address}, {c.district}</span>
              {c.metro && <span><Train size={16} /> м. {c.metro} · {c.metro_minutes} мин</span>}
            </div>
            <div className="row wrap">
              <a href="#apartments" className="btn btn-white btn-lg">Смотреть квартиры <ArrowRight size={18} /></a>
            </div>
          </div>
          <div className="hero-art photo-art"><Photo src={c.cover} alt={`ЖК «${c.name}»`} fallback={<CityArt seed={c.slug} color={c.accent_color} />} /></div>
        </div>
        <div className="stats-strip">
          <div className="stat"><b>{c.stats.available}</b><span>квартир в продаже</span></div>
          <div className="stat"><b>{c.stats.min_price ? moneyShort(c.stats.min_price) : '—'}</b><span>минимальная цена</span></div>
          <div className="stat"><b>{c.stats.min_area ? `${Math.floor(c.stats.min_area)}–${Math.ceil(c.stats.max_area)}` : '—'}</b><span>площадь, м²</span></div>
          <div className="stat"><b>{c.buildings.length}</b><span>{c.buildings.length === 1 ? 'корпус' : 'корпуса'}</span></div>
        </div>
      </div>

      <section className="section">
        <div className="container grid-2" style={{ gap: 48 }}>
          <div>
            <div className="eyebrow">О проекте</div>
            <h2>Среда для жизни</h2>
            <p className="muted mt-16" style={{ fontSize: 18 }}>{c.description}</p>
            <ul className="feature-list mt-24">
              {c.features_list.map((f) => <li key={f}><Check size={18} />{f}</li>)}
            </ul>
          </div>
          <div className="card">
            <h3 className="mb-24">Ход строительства</h3>
            <div className="stack-lg">
              {c.buildings.map((b) => (
                <div key={b.id}>
                  <div className="row-between mb-16" style={{ marginBottom: 8 }}>
                    <div><b>Корпус {b.number}</b> <span className="muted small">· {b.floors} этажей · {b.completion_quarter}</span></div>
                    <span className={`badge ${b.stage === 'done' ? 'badge-success' : b.stage === 'construction' ? 'badge-info' : ''}`}>{b.stage_display}</span>
                  </div>
                  <div className="progress"><div style={{ width: `${b.construction_progress}%` }} /></div>
                  <div className="tiny muted mt-8">Готовность {b.construction_progress}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {c.gallery?.length > 1 && (
        <section className="container" style={{ paddingBottom: 72 }}>
          <div className="section-head"><div><div className="eyebrow">Галерея</div><h2>Как выглядит комплекс</h2></div></div>
          <div className="complex-gallery">
            {c.gallery.map((g, i) => (
              <figure key={g.src + i} className={i === 0 ? 'wide' : ''}>
                <Photo src={sized(g.src, i === 0 ? 1400 : 800)} alt={g.caption} fallback={<CityArt seed={`${c.slug}-${i}`} color={c.accent_color} />} />
                {g.caption && <figcaption>{g.caption}</figcaption>}
              </figure>
            ))}
          </div>
        </section>
      )}

      <section className="container" id="apartments">
        <div className="section-head">
          <div><div className="eyebrow">Квартиры</div><h2>Свободные квартиры в ЖК «{c.name}»</h2></div>
          <div className="chips">
            {[['', 'Все'], ['0', 'Студии'], ['1', '1-комн.'], ['2', '2-комн.'], ['3', '3-комн.'], ['4', '4-комн.']].map(([v, l]) => (
              <button key={v} className={`chip ${rooms === v ? 'active' : ''}`} onClick={() => setRooms(v)}>{l}</button>
            ))}
          </div>
        </div>
        {!apts ? <PageLoader /> : apts.results.length ? (
          <>
            <div className="apt-grid">{apts.results.map((a) => <ApartmentCard key={a.id} a={a} />)}</div>
            <div className="center mt-32">
              <Link to={`/apartments?complex=${c.id}${rooms ? `&rooms=${rooms}` : ''}`} className="btn btn-outline btn-lg">
                Все {num(apts.count)} квартир в каталоге <ArrowRight size={18} />
              </Link>
            </div>
          </>
        ) : <Empty icon={Building2} title="Нет свободных квартир" text={`${rooms ? roomsLabel(rooms) + ' ' : ''}сейчас нет в продаже. Оставьте заявку — сообщим о старте продаж.`} />}
      </section>
    </>
  )
}

export function News() {
  const [cat, setCat] = useState('')
  const [data, setData] = useState(null)
  const [open, setOpen] = useState(null)
  useEffect(() => { api.get('/news/', { params: { category: cat || undefined, page_size: 50 } }).then((r) => setData(r.data.results)) }, [cat])
  return (
    <div className="container" style={{ paddingTop: 32 }}>
      <div className="page-title">
        <div><div className="eyebrow">Пресс-центр</div><h1>Новости и акции</h1></div>
        <div className="chips">
          {[['', 'Все'], ['news', 'Новости'], ['promo', 'Акции'], ['progress', 'Ход строительства']].map(([v, l]) => (
            <button key={v} className={`chip ${cat === v ? 'active' : ''}`} onClick={() => setCat(v)}>{l}</button>
          ))}
        </div>
      </div>
      {!data ? <PageLoader /> : (
        <div className="grid-3">
          {data.map((n) => (
            <article key={n.id} className="news-card card-hover" style={{ cursor: 'pointer' }} onClick={() => setOpen(open === n.id ? null : n.id)}>
              <div className="row-between"><span className={`badge ${n.category === 'promo' ? 'badge-accent' : n.category === 'progress' ? 'badge-info' : ''}`}>{n.category_display}</span>
                <span className="tiny muted">{new Date(n.published_at).toLocaleDateString('ru-RU')}</span></div>
              <h3>{n.title}</h3>
              <p className="muted small">{open === n.id ? n.body : n.excerpt}</p>
              {n.complex_name && <span className="tiny muted">ЖК «{n.complex_name}»</span>}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

