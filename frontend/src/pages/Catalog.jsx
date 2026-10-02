import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Grid3x3, List, RotateCcw, Search, SlidersHorizontal } from 'lucide-react'
import api from '../api/client'
import { ApartmentCard } from '../components/Cards'
import { Empty, Pagination } from '../components/ui'
import { num, plural } from '../utils/format'

const ROOMS = [['0', 'Студия'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4+']]
const SORTS = [
  ['price', 'Сначала дешевле'], ['-price', 'Сначала дороже'],
  ['area', 'По площади ↑'], ['-area', 'По площади ↓'], ['-floor', 'Выше этаж'], ['-created_at', 'Новые'],
]

export default function Catalog() {
  const [params, setParams] = useSearchParams()
  const [facets, setFacets] = useState(null)
  const [data, setData] = useState({ results: [], count: 0 })
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('grid')
  const [showFilters, setShowFilters] = useState(false)

  const get = (k) => params.get(k) || ''
  const rooms = get('rooms') ? get('rooms').split(',') : []
  const finishing = get('finishing') ? get('finishing').split(',') : []
  const page = Number(get('page') || 1)

  const set = (patch) => {
    const next = new URLSearchParams(params)
    Object.entries(patch).forEach(([k, v]) => (v === '' || v == null || (Array.isArray(v) && !v.length) ? next.delete(k) : next.set(k, Array.isArray(v) ? v.join(',') : v)))
    if (!('page' in patch)) next.delete('page')
    setParams(next, { replace: true })
  }

  useEffect(() => { api.get('/apartments/facets/').then((r) => setFacets(r.data)) }, [])

  const query = params.toString()
  useEffect(() => {
    setLoading(true)
    const p = Object.fromEntries(new URLSearchParams(query))
    // «4+» — все квартиры от 4 комнат
    if (p.rooms?.includes('4')) p.rooms = [...p.rooms.split(','), '5', '6'].join(',')
    if (!p.ordering) p.ordering = 'price'
    if (p.only_available) { p.status = 'available'; delete p.only_available }
    api.get('/apartments/', { params: p })
      .then((r) => setData(r.data))
      .finally(() => setLoading(false))
  }, [query])

  const activeCount = useMemo(() => [...params.keys()].filter((k) => !['page', 'ordering'].includes(k)).length, [params])

  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 40 }}>
      <div className="page-title">
        <div>
          <div className="eyebrow">Каталог</div>
          <h1>Квартиры от застройщика</h1>
          <p className="muted mt-8">{loading ? 'Ищем…' : `Найдено ${num(data.count)} ${plural(data.count, 'квартира', 'квартиры', 'квартир')}`}</p>
        </div>
        <button className="btn btn-outline filters-toggle" onClick={() => setShowFilters((v) => !v)}>
          <SlidersHorizontal size={18} /> Фильтры {activeCount > 0 && `(${activeCount})`}
        </button>
      </div>

      <div className="catalog">
        <aside className={`filters ${showFilters ? 'open' : ''}`} aria-label="Фильтры">
          <div>
            <h4>Жилой комплекс</h4>
            <select className="select" value={get('complex')} onChange={(e) => set({ complex: e.target.value })}>
              <option value="">Все проекты</option>
              {facets?.complexes.map((c) => <option key={c.id} value={c.id}>ЖК «{c.name}» ({c.count})</option>)}
            </select>
          </div>
          <div>
            <h4>Комнат</h4>
            <div className="chips">
              {ROOMS.map(([v, l]) => (
                <button key={v} className={`chip ${rooms.includes(v) ? 'active' : ''}`}
                  onClick={() => set({ rooms: rooms.includes(v) ? rooms.filter((x) => x !== v) : [...rooms, v] })}>{l}</button>
              ))}
            </div>
          </div>
          <RangeFilter title="Цена, млн ₽" k="price" get={get} set={set} scale={1e6}
            placeholder={[facets ? (facets.price_min / 1e6).toFixed(1) : 'от', facets ? (facets.price_max / 1e6).toFixed(0) : 'до']} />
          <RangeFilter title="Площадь, м²" k="area" get={get} set={set}
            placeholder={[facets ? Math.floor(facets.area_min) : 'от', facets ? Math.ceil(facets.area_max) : 'до']} />
          <RangeFilter title="Этаж" k="floor" get={get} set={set} placeholder={[1, facets?.floor_max || '']} />
          <div>
            <h4>Отделка</h4>
            <div className="stack" style={{ gap: 10 }}>
              {facets?.finishing.map((f) => (
                <label key={f.value} className="checkbox">
                  <input type="checkbox" checked={finishing.includes(f.value)}
                    onChange={() => set({ finishing: finishing.includes(f.value) ? finishing.filter((x) => x !== f.value) : [...finishing, f.value] })} />
                  {f.label}
                </label>
              ))}
            </div>
          </div>
          <div className="stack" style={{ gap: 10 }}>
            <label className="checkbox"><input type="checkbox" checked={get('balcony') === 'true'} onChange={(e) => set({ balcony: e.target.checked ? 'true' : '' })} />С балконом / лоджией</label>
            <label className="checkbox"><input type="checkbox" checked={get('not_first_floor') === 'true'} onChange={(e) => set({ not_first_floor: e.target.checked ? 'true' : '' })} />Не первый этаж</label>
            <label className="checkbox"><input type="checkbox" checked={get('only_available') === '1'} onChange={(e) => set({ only_available: e.target.checked ? '1' : '' })} />Только свободные</label>
          </div>
          {activeCount > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={() => setParams({}, { replace: true })}><RotateCcw size={16} /> Сбросить фильтры</button>
          )}
        </aside>

        <div>
          <div className="toolbar">
            <select className="select" value={get('ordering') || 'price'} onChange={(e) => set({ ordering: e.target.value })} aria-label="Сортировка">
              {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <div className="segmented" role="group" aria-label="Вид">
              <button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')}><Grid3x3 size={16} /> Плитка</button>
              <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}><List size={16} /> Список</button>
            </div>
          </div>

          {loading && !data.results.length ? (
            <div className="apt-grid">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 400 }} />)}</div>
          ) : data.results.length === 0 ? (
            <Empty icon={Search} title="Ничего не нашлось" text="Попробуйте изменить параметры поиска или сбросить фильтры."
              action={<button className="btn" onClick={() => setParams({})}>Сбросить фильтры</button>} />
          ) : (
            <div className={view === 'grid' ? 'apt-grid' : 'apt-list'} style={{ opacity: loading ? 0.5 : 1, transition: 'opacity .2s' }}>
              {data.results.map((a) => <ApartmentCard key={a.id} a={a} />)}
            </div>
          )}
          <Pagination page={page} count={data.count} onChange={(p) => { set({ page: String(p) }); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />
        </div>
      </div>
    </div>
  )
}

function RangeFilter({ title, k, get, set, scale = 1, placeholder }) {
  const toView = (v) => (v ? String(Number(v) / scale) : '')
  const [min, setMin] = useState(toView(get(`${k}_min`)))
  const [max, setMax] = useState(toView(get(`${k}_max`)))
  const urlMin = get(`${k}_min`), urlMax = get(`${k}_max`)
  useEffect(() => { setMin(toView(urlMin)); setMax(toView(urlMax)) }, [urlMin, urlMax]) // eslint-disable-line
  useEffect(() => {
    const t = setTimeout(() => {
      const a = min ? String(Math.round(Number(String(min).replace(',', '.')) * scale)) : ''
      const b = max ? String(Math.round(Number(String(max).replace(',', '.')) * scale)) : ''
      if (a !== urlMin || b !== urlMax) set({ [`${k}_min`]: a, [`${k}_max`]: b })
    }, 500)
    return () => clearTimeout(t)
  }, [min, max]) // eslint-disable-line
  return (
    <div>
      <h4>{title}</h4>
      <div className="range-pair">
        <input className="input" inputMode="decimal" placeholder={`от ${placeholder[0]}`} value={min} onChange={(e) => setMin(e.target.value)} aria-label={`${title} от`} />
        <input className="input" inputMode="decimal" placeholder={`до ${placeholder[1]}`} value={max} onChange={(e) => setMax(e.target.value)} aria-label={`${title} до`} />
      </div>
    </div>
  )
}
