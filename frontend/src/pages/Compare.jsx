import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Scale, Trash2 } from 'lucide-react'
import api from '../api/client'
import FloorPlan from '../components/FloorPlan'
import { Empty, PageLoader } from '../components/ui'
import { useCompare } from '../context/UiContext'
import { area, money, roomsLong } from '../utils/format'

const ROWS = [
  ['Цена', (a) => money(Number(a.discount_percent) > 0 ? a.discounted_price : a.price), (a) => Number(a.discounted_price), 'min'],
  ['Цена за м²', (a) => money(a.price_per_m2), (a) => Number(a.price_per_m2), 'min'],
  ['Общая площадь', (a) => area(a.area), (a) => Number(a.area), 'max'],
  ['Кухня', (a) => (a.kitchen_area ? area(a.kitchen_area) : '—'), (a) => Number(a.kitchen_area || 0), 'max'],
  ['Этаж', (a) => `${a.floor} из ${a.floors_total}`],
  ['Потолки', (a) => `${Number(a.ceiling_height)} м`, (a) => Number(a.ceiling_height), 'max'],
  ['Отделка', (a) => a.finishing_display],
  ['Санузлов', (a) => a.bathrooms],
  ['Балкон', (a) => (a.balcony ? 'Да' : 'Нет')],
  ['Вид из окон', (a) => a.window_view || '—'],
  ['Срок сдачи', (a) => a.completion_quarter || '—'],
  ['Статус', (a) => a.status_display],
]

export default function Compare() {
  const { ids, remove, clear } = useCompare()
  const [items, setItems] = useState(null)
  useEffect(() => {
    if (!ids.length) { setItems([]); return }
    api.get('/compare/', { params: { ids: ids.join(',') } }).then((r) => setItems(ids.map((id) => r.data.find((a) => a.id === id)).filter(Boolean)))
  }, [ids])

  return (
    <div className="container" style={{ paddingTop: 32 }}>
      <div className="page-title">
        <div><div className="eyebrow">Сравнение</div><h1>Сравнение квартир</h1><p className="muted mt-8">Лучшие значения подсвечены зелёным.</p></div>
        {ids.length > 0 && <button className="btn btn-outline" onClick={clear}><Trash2 size={16} /> Очистить</button>}
      </div>
      {!items ? <PageLoader /> : !items.length ? (
        <Empty icon={Scale} title="Список сравнения пуст" text="Нажмите на значок весов на карточке квартиры, чтобы добавить её сюда (до 4 шт.)."
          action={<Link to="/apartments" className="btn btn-accent">Перейти в каталог</Link>} />
      ) : (
        <div className="table-wrap">
          <table className="table compare-table">
            <thead>
              <tr>
                <th />
                {items.map((a) => (
                  <th key={a.id} style={{ textTransform: 'none', letterSpacing: 0, background: '#fff' }}>
                    <div className="stack" style={{ gap: 8 }}>
                      <div style={{ background: 'var(--bg)', borderRadius: 12, padding: 8, aspectRatio: '4/3' }}><FloorPlan apartment={a} showLabels={false} /></div>
                      <Link to={`/apartments/${a.id}`} style={{ color: 'var(--ink)', fontSize: 15 }}>{roomsLong(a.rooms)}</Link>
                      <span className="muted" style={{ fontWeight: 400 }}>ЖК «{a.complex_name}», кв. {a.number}</span>
                      <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start', padding: 0 }} onClick={() => remove(a.id)}><Trash2 size={14} /> Убрать</button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([label, show, val, best]) => {
                let bestVal = null
                if (val && items.length > 1) {
                  const vs = items.map(val)
                  bestVal = best === 'min' ? Math.min(...vs) : Math.max(...vs)
                  if (vs.every((v) => v === bestVal)) bestVal = null
                }
                return (
                  <tr key={label}>
                    <td className="muted">{label}</td>
                    {items.map((a) => <td key={a.id} className={bestVal !== null && val(a) === bestVal ? 'best' : ''}>{show(a)}</td>)}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
