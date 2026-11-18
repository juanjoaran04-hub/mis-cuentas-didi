import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { borrarMant, db, guardarMant } from '../db'
import { formatCOP, hoyISO, recordatorios, type Estado, type TipoMant } from '../logica/dinero'
import { X } from 'lucide-react'
import { Monto, confirmar, type Datos } from '../ui'

const COLOR: Record<Estado, string> = { ok: 'var(--pos)', pronto: 'var(--warn)', vencido: 'var(--neg)', sinregistro: 'var(--dim)' }
const Punto = ({ e }: { e: Estado }) => <span aria-hidden style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 99, background: COLOR[e], marginRight: 8 }} />
export const useRecordatorios = (d: Datos) => {
  const mants = useLiveQuery(() => db.mants.toArray(), [], [])
  return { mants, rec: recordatorios(d.config.kmActual, d.config.moto, mants) }
}

export default function Moto({ d }: { d: Datos }) {
  const { mants, rec } = useRecordatorios(d)
  const [km, setKm] = useState(d.config.kmActual)
  const [m, setM] = useState({ tipo: 'aceite' as TipoMant, km: d.config.kmActual, costo: 0, fecha: hoyISO(), descontar: true })

  return (
    <>
      <h1>Moto</h1>
      <div className="card">
        <label>Kilometraje actual</label>
        <div className="row"><Monto valor={km} onChange={setKm} /><button disabled={km === d.config.kmActual} onClick={() => db.config.update(1, { kmActual: km })}>Guardar</button></div>
      </div>

      <div className="card">
        <h2>Recordatorios</h2>
        {rec.map((r) => (
          <div className="item" key={r.nombre}><span><Punto e={r.estado} />{r.nombre}<br /><span className="dim">{r.ultimoKm === null ? 'Sin registro: anota el último cambio abajo' : `Último: ${r.ultimoKm.toLocaleString('es-CO')} km`}</span></span>
            <span style={{ textAlign: 'right' }}>{r.faltan === null ? '' : r.faltan <= 0 ? <b className="neg">Pasado {Math.abs(r.faltan).toLocaleString('es-CO')} km</b> : <>Faltan <b>{r.faltan.toLocaleString('es-CO')}</b> km</>}</span></div>
        ))}
      </div>

      <div className="card">
        <h2>Anotar mantenimiento</h2>
        <select value={m.tipo} onChange={(e) => setM({ ...m, tipo: e.target.value as TipoMant })}>
          <option value="aceite">Cambio de aceite</option><option value="cadena">Lubricar cadena</option><option value="arrastre">Kit de arrastre</option><option value="otro">Otro</option>
        </select>
        <label>Fecha</label><input type="date" value={m.fecha} onChange={(e) => setM({ ...m, fecha: e.target.value })} />
        <label>Km en que se hizo</label><Monto valor={m.km} onChange={(n) => setM({ ...m, km: n })} />
        <label>Costo</label><Monto valor={m.costo} onChange={(n) => setM({ ...m, costo: n })} />
        <label><input type="checkbox" style={{ width: 'auto' }} checked={m.descontar} onChange={(e) => setM({ ...m, descontar: e.target.checked })} /> Descontar del bolsillo Moto (y del Efectivo)</label>
        <button className="full" disabled={m.km <= 0} onClick={async () => { await guardarMant({ tipo: m.tipo, fecha: m.fecha, km: m.km, costo: m.costo }, m.descontar); setM({ ...m, costo: 0 }) }}>Guardar</button>
      </div>

      <div className="card">
        <h2>Historial</h2>
        {mants.length === 0 && <p className="dim">Aún no hay mantenimientos.</p>}
        {[...mants].sort((a, b) => b.fecha.localeCompare(a.fecha)).map((x) => (
          <div className="item" key={x.id}><span>{x.fecha} · {x.tipo}<br /><span className="dim">{x.km.toLocaleString('es-CO')} km</span></span>
            <span><b className="neg">{formatCOP(x.costo)}</b> <button className="sm bad" aria-label="Borrar mantenimiento" onClick={() => confirmar('¿Borrar? Si descontó plata, se devuelve.') && borrarMant(x.id!)}><X size={16} aria-hidden /></button></span></div>
        ))}
      </div>
    </>
  )
}
