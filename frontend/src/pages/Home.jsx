import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight, Award, BadgePercent, Clock, Gift, KeyRound, Mail, MapPin, Phone, Plus, Quote, School,
  ShieldCheck, Sparkles, Star, Trees, Percent, Clock3,
} from 'lucide-react'
import api, { errorText } from '../api/client'
import CityArt from '../components/CityArt'
import { ComplexCard } from '../components/Cards'
import { CountUp, Field, Spinner } from '../components/ui'
import { useToast } from '../context/UiContext'
import { date } from '../utils/format'

const ICONS = { shield: ShieldCheck, clock: Clock, tree: Trees, school: School, key: KeyRound, percent: Percent }

export default function Home() {
  const [company, setCompany] = useState(null)
  const [complexes, setComplexes] = useState([])
  const [news, setNews] = useState([])
  const [levels, setLevels] = useState([])

  useEffect(() => {
    api.get('/company/').then((r) => setCompany(r.data))
    api.get('/complexes/').then((r) => setComplexes(r.data))
    api.get('/news/', { params: { page_size: 3 } }).then((r) => setNews(r.data.results))
    api.get('/loyalty/levels/').then((r) => setLevels(r.data))
  }, [])

  const c = company
  return (
    <>
      <Hero company={c} />

      {/* Цифры */}
      <section className="container">
        <div className="stats-strip">
          <div className="stat"><CountUp value={new Date().getFullYear() - (c?.founded_year || 2006)} suffix=" лет" /><span>на рынке недвижимости</span></div>
          <div className="stat"><CountUp value={c?.built_sqm || 0} suffix=" тыс." /><span>м² жилья построено</span></div>
          <div className="stat"><CountUp value={c?.houses_built || 0} /><span>домов сданы в срок</span></div>
          <div className="stat"><CountUp value={c?.families || 0} /><span>семей получили ключи</span></div>
        </div>
      </section>

      {/* О компании */}
      <section className="section" id="about">
        <div className="container grid-2" style={{ alignItems: 'center', gap: 56 }}>
          <div>
            <div className="eyebrow">О застройщике</div>
            <h2>{c?.slogan || 'Строим кварталы, в которых хочется жить'}</h2>
            <p className="muted mt-24" style={{ fontSize: 18 }}>{c?.about}</p>
            <p className="mt-16" style={{ fontSize: 18, fontWeight: 500 }}>{c?.mission}</p>
            <div className="row wrap mt-32">
              <Link to="/apartments" className="btn btn-accent btn-lg">Выбрать квартиру <ArrowRight size={18} /></Link>
              <Link to="/complexes" className="btn btn-outline btn-lg">Наши проекты</Link>
            </div>
          </div>
          <div className="grid-2" style={{ gap: 16 }}>
            <div className="card-flat" style={{ background: 'var(--navy)', color: '#fff', gridRow: 'span 2', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 360 }}>
              <ShieldCheck size={36} color="var(--accent)" />
              <div>
                <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-0.04em' }}>100%</div>
                <p style={{ color: 'rgba(255,255,255,.7)' }}>проектов реализуются по 214-ФЗ через эскроу-счета. Ваши деньги в безопасности до сдачи дома.</p>
              </div>
            </div>
            <div className="card-flat">
              <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.04em' }}>{c?.live_stats?.complexes ?? '—'}</div>
              <p className="muted">проекта в продаже прямо сейчас</p>
            </div>
            <div className="card-flat" style={{ background: 'var(--accent)', color: '#fff' }}>
              <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.04em' }}>от {c?.live_stats?.min_rate ? Number(c.live_stats.min_rate) : 6}%</div>
              <p style={{ color: 'rgba(255,255,255,.85)' }}>ставка по ипотеке у банков-партнёров</p>
            </div>
          </div>
        </div>
      </section>

      {/* Проекты */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head">
            <div>
              <div className="eyebrow">Проекты</div>
              <h2>Жилые комплексы в продаже</h2>
              <p>От уютного комфорт-класса до клубных домов премиум-сегмента — выберите район и формат жизни.</p>
            </div>
            <Link to="/complexes" className="link">Все проекты <ArrowRight size={16} /></Link>
          </div>
          <div className="grid-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {complexes.length ? complexes.map((x) => <ComplexCard key={x.id} c={x} />)
              : Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 420 }} />)}
          </div>
        </div>
      </section>

      {/* Преимущества */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head">
            <div>
              <div className="eyebrow">Почему мы</div>
              <h2>Надёжность, проверенная временем</h2>
            </div>
          </div>
          <div className="grid-3">
            {(c?.advantages || []).map((a) => {
              const Icon = ICONS[a.icon] || Sparkles
              return (
                <div key={a.title} className="adv-card card-hover">
                  <div className="adv-icon"><Icon size={26} /></div>
                  <h3>{a.title}</h3>
                  <p>{a.text}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Как купить */}
      <section className="container">
        <div className="dark-section">
          <div className="section-head">
            <div>
              <div className="eyebrow">Покупка онлайн</div>
              <h2>Пять шагов до ключей</h2>
              <p>Весь путь — от выбора до регистрации договора — можно пройти не выходя из дома.</p>
            </div>
            <Link to="/apartments" className="btn btn-accent">Начать выбор <ArrowRight size={18} /></Link>
          </div>
          <div className="steps">
            {(c?.purchase_steps || []).map((s) => (
              <div key={s.title} className="step"><h4>{s.title}</h4><p>{s.text}</p></div>
            ))}
          </div>
        </div>
      </section>

      {/* Ипотека + лояльность */}
      <section className="section">
        <div className="container grid-2">
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 40 }}>
            <div className="adv-icon"><BadgePercent size={26} /></div>
            <h2 style={{ fontSize: 32 }}>Ипотека от {c?.live_stats?.min_rate ? Number(c.live_stats.min_rate) : 6}%</h2>
            <p className="muted">{c?.live_stats?.mortgage_programs || 5} программ от банков-партнёров: семейная, IT-ипотека, субсидия от застройщика. Рассчитайте платёж и подайте заявку прямо из личного кабинета.</p>
            <div className="mt-8"><Link to="/mortgage" className="btn">Рассчитать платёж <ArrowRight size={18} /></Link></div>
          </div>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 40 }}>
            <div className="adv-icon"><Gift size={26} /></div>
            <h2 style={{ fontSize: 32 }}>Скидка до {levels.length ? Math.max(...levels.map((l) => Number(l.discount_percent))) : 5}% для своих</h2>
            <p className="muted">Программа лояльности: скидка действует сразу после регистрации и растёт вместе с суммой покупок.</p>
            <div className="row wrap" style={{ gap: 8 }}>
              {levels.map((l) => (
                <span key={l.id} className="badge" style={{ background: l.color, color: '#fff', height: 30, padding: '0 12px' }}>{l.name} · {Number(l.discount_percent)}%</span>
              ))}
            </div>
            <div className="mt-8"><Link to="/loyalty" className="btn btn-outline">Подробнее о программе</Link></div>
          </div>
        </div>
      </section>

      {/* История */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head"><div><div className="eyebrow">История</div><h2>20 лет развития</h2></div></div>
          <div className="timeline">
            {(c?.milestones || []).map((m) => (
              <div key={m.year} className="tl-item"><b>{m.year}</b><h4>{m.title}</h4><p>{m.text}</p></div>
            ))}
          </div>
        </div>
      </section>

      {/* Награды и отзывы */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head"><div><div className="eyebrow">Отзывы</div><h2>Что говорят жители</h2></div></div>
          <div className="grid-3">
            {(c?.reviews || []).map((r) => (
              <div key={r.name} className="review">
                <Quote size={28} color="var(--accent)" />
                <p style={{ fontSize: 17 }}>{r.text}</p>
                <div className="row-between mt-8">
                  <b className="small">{r.name}</b>
                  <div className="stars" aria-label={`Оценка ${r.rating} из 5`}>
                    {Array.from({ length: 5 }).map((_, i) => <Star key={i} size={16} fill={i < r.rating ? 'currentColor' : 'none'} />)}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="grid-3 mt-24">
            {(c?.awards || []).map((a) => (
              <div key={a.title} className="row card" style={{ padding: 20, gap: 16 }}>
                <div className="adv-icon" style={{ width: 48, height: 48 }}><Award size={24} /></div>
                <div><b>{a.title}</b><div className="small muted">{a.org}, {a.year}</div></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Новости */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head">
            <div><div className="eyebrow">Новости и акции</div><h2>Что нового</h2></div>
            <Link to="/news" className="link">Все новости <ArrowRight size={16} /></Link>
          </div>
          <div className="grid-3">
            {news.map((n) => (
              <Link to="/news" key={n.id} className="news-card card-hover">
                <div className="row-between"><span className={`badge ${n.category === 'promo' ? 'badge-accent' : n.category === 'progress' ? 'badge-info' : ''}`}>{n.category_display}</span><span className="tiny muted">{date(n.published_at)}</span></div>
                <h3>{n.title}</h3>
                <p className="muted small">{n.excerpt}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <Faq items={c?.faq || []} />
      <Contacts company={c} />
    </>
  )
}

function Hero({ company }) {
  const nav = useNavigate()
  const [rooms, setRooms] = useState([])
  const [budget, setBudget] = useState('')
  const toggle = (r) => setRooms((xs) => (xs.includes(r) ? xs.filter((x) => x !== r) : [...xs, r]))
  const search = () => {
    const p = new URLSearchParams()
    if (rooms.length) p.set('rooms', rooms.join(','))
    if (budget) p.set('price_max', budget)
    nav(`/apartments?${p}`)
  }
  return (
    <section className="hero container">
      <div className="hero-card">
        <div className="hero-content">
          <div className="hero-badges">
            <span className="badge"><ShieldCheck size={14} /> 214-ФЗ и эскроу</span>
            <span className="badge"><Clock3 size={14} /> Сдаём в срок</span>
            <span className="badge"><BadgePercent size={14} /> Ипотека от {company?.live_stats?.min_rate ? Number(company.live_stats.min_rate) : 6}%</span>
          </div>
          <h1>Квартиры, в которых <span>хочется жить</span></h1>
          <p>{company?.live_stats?.apartments_available || 'Сотни'} квартир в {company?.live_stats?.complexes || 4} жилых комплексах. Онлайн-бронирование, ипотека и персональные скидки в личном кабинете.</p>
          <div className="hero-search">
            <div className="chips" role="group" aria-label="Комнатность">
              {[['0', 'Ст'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4+']].map(([v, l]) => (
                <button key={v} className={`chip ${rooms.includes(v) ? 'active' : ''}`} onClick={() => toggle(v)}>{l}</button>
              ))}
            </div>
            <select className="select" value={budget} onChange={(e) => setBudget(e.target.value)} aria-label="Бюджет">
              <option value="">Бюджет</option>
              <option value="10000000">до 10 млн ₽</option>
              <option value="15000000">до 15 млн ₽</option>
              <option value="25000000">до 25 млн ₽</option>
              <option value="50000000">до 50 млн ₽</option>
            </select>
            <button className="btn btn-accent" onClick={search}>Найти</button>
          </div>
        </div>
        <div className="hero-art"><CityArt seed="hero-main" color="#f25c2b" variant="hero" /></div>
      </div>
    </section>
  )
}

function Faq({ items }) {
  const [open, setOpen] = useState(0)
  if (!items.length) return null
  return (
    <section className="section" style={{ paddingTop: 0 }}>
      <div className="container grid-2" style={{ gridTemplateColumns: '1fr 1.6fr', gap: 48 }}>
        <div><div className="eyebrow">Вопросы</div><h2>Часто спрашивают</h2><p className="muted mt-16">Не нашли ответ? Оставьте заявку — менеджер перезвонит в течение 15 минут.</p></div>
        <div>
          {items.map((f, i) => (
            <div key={f.q} className={`faq-item ${open === i ? 'open' : ''}`}>
              <button className="faq-q" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}>{f.q}<Plus size={22} /></button>
              {open === i && <div className="faq-a">{f.a}</div>}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Contacts({ company }) {
  const toast = useToast()
  const [form, setForm] = useState({ name: '', phone: '', topic: 'consult', message: '' })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    setSending(true)
    try {
      await api.post('/leads/', form)
      setSent(true)
      toast('Заявка отправлена! Мы перезвоним в ближайшее время.')
    } catch (err) {
      toast(errorText(err), 'error')
    } finally { setSending(false) }
  }
  return (
    <section className="section" id="contacts" style={{ paddingTop: 0 }}>
      <div className="container">
        <div className="contact-block">
          <div>
            <div className="eyebrow">Консультация</div>
            <h2>Поможем выбрать квартиру</h2>
            <p className="muted mt-16 mb-24">Расскажем о проектах, подберём планировку и рассчитаем ипотеку. Это бесплатно.</p>
            {sent ? (
              <div className="discount-box" style={{ background: 'var(--success-50)', color: 'var(--success)' }}>
                <ShieldCheck size={22} /> Спасибо! Заявка принята, менеджер свяжется с вами.
              </div>
            ) : (
              <form className="stack" onSubmit={submit}>
                <div className="form-grid">
                  <Field label="Имя"><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Как к вам обращаться" /></Field>
                  <Field label="Телефон"><input className="input" required type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+7 900 000-00-00" /></Field>
                </div>
                <Field label="Тема">
                  <select className="select" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })}>
                    <option value="consult">Консультация по покупке</option>
                    <option value="mortgage">Ипотека</option>
                    <option value="visit">Запись на просмотр</option>
                    <option value="other">Другое</option>
                  </select>
                </Field>
                <Field label="Комментарий"><textarea className="textarea" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Например: ищу 2-комнатную до 15 млн" /></Field>
                <button className="btn btn-accent btn-lg" disabled={sending}>{sending ? <Spinner /> : 'Жду звонка'}</button>
                <p className="tiny muted">Нажимая кнопку, вы соглашаетесь на обработку персональных данных.</p>
              </form>
            )}
          </div>
          <div className="contact-info">
            <h3>Офис продаж</h3>
            <div className="contact-line"><div className="adv-icon"><Phone size={20} /></div><div><b>{company?.phone}</b><div className="small muted">Звонок бесплатный</div></div></div>
            <div className="contact-line"><div className="adv-icon"><Mail size={20} /></div><div><b>{company?.email}</b><div className="small muted">Ответим в течение часа</div></div></div>
            <div className="contact-line"><div className="adv-icon"><MapPin size={20} /></div><div><b>{company?.address}</b><div className="small muted">{company?.work_hours}</div></div></div>
            <div style={{ borderRadius: 20, overflow: 'hidden', flex: 1, minHeight: 180 }}>
              <CityArt seed="office" color="#f25c2b" variant="card" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
