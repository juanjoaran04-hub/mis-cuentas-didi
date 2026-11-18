import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { borrarDia, db, guardarDia, type Dia } from '../db'
import { BOLSILLOS, NOMBRE_BOLSILLO, formatCOP, hoyISO, resumenDia, type Gasto, type Origen } from '../logica/dinero'
import { Monto, confirmar, type Datos } from '../ui'

const nuevoDia = (fecha: string): Dia => ({ fecha, efectivo: 0, app: 0, viajes: 0, horas: 0, km: 0, gastos: [] })
const num = (s: string) => Number(s.replace(',', '.').replace(/[^\d.]/g, '')) || 0

export default function Registrar({ d }: { d: Datos }) {
  const [dia, setDia] = useState<Dia>(nuevoDia(hoyISO()))
  const cats = useLiveQuery(() => db.categorias.toArray(), [], [])
  const recientes = useLiveQuery(() => db.dias.orderBy('fecha').reverse().limit(10).toArray(), [], [])

  // Al cambiar la fecha, carga el día si ya existía (para editarlo).
  useEffect(() => { db.dias.get(dia.fecha).then((x) => { if (x) setDia(x) }) }, [dia.fecha])

  const saldoImp = d.bolsillos.imprevistos
  const r = resumenDia(dia, d.config, saldoImp)
  const catNombre = (id: number) => cats.find((c) => c.id === id)?.nombre ?? '?'
  const setGasto = (i: number, g: Gasto) => setDia({ ...dia, gastos: dia.gastos.map((x, j) => (j === i ? g : x)) })
  const agregarGasto = () => cats[0] && setDia({ ...dia, gastos: [...dia.gastos, { categoriaId: cats[0].id!, monto: 0, origen: cats[0].origen, cuenta: 'efectivo' }] })

  const guardar = async () => {
    await guardarDia({ ...dia, gastos: dia.gastos.filter((g) => g.monto > 0) })
    setDia(nuevoDia(hoyISO()))
  }

  return (
    <>
      <h1>Registrar el día</h1>
      <div className="card">
        <label>Fecha</label><input type="date" value={dia.fecha} max={hoyISO()} onChange={(e) => e.target.value && setDia({ ...nuevoDia(e.target.value) })} />
        <div className="grid2">
          <div><label>Efectivo</label><Monto valor={dia.efectivo} onChange={(n) => setDia({ ...dia, efectivo: n })} /></div>
          <div><label>Por la app</label><Monto valor={dia.app} onChange={(n) => setDia({ ...dia, app: n })} /></div>
          <div><label>Viajes</label><input inputMode="numeric" value={dia.viajes || ''} onChange={(e) => setDia({ ...dia, viajes: num(e.target.value) })} /></div>
          <div><label>Horas</label><input inputMode="decimal" value={dia.horas || ''} onChange={(e) => setDia({ ...dia, horas: num(e.target.value) })} /></div>
        </div>
        <label>Km recorridos hoy (opcional, suma al kilometraje de la moto)</label>
        <input inputMode="numeric" value={dia.km || ''} onChange={(e) => setDia({ ...dia, km: num(e.target.value) })} />
        <p className="big">Producido: {formatCOP(r.producido)}</p>
      </div>

      <div className="card">
        <h2>Gastos del día</h2>
        {dia.gastos.map((g, i) => (
          <div key={i} style={{ marginBottom: 10 }}>
            <div className="row">
              <select value={g.categoriaId} onChange={(e) => { const c = cats.find((x) => x.id === Number(e.target.value))!; setGasto(i, { ...g, categoriaId: c.id!, origen: c.origen }) }}>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              <button className="bad sm" onClick={() => setDia({ ...dia, gastos: dia.gastos.filter((_, j) => j !== i) })}>✕</button>
            </div>
            <div className="row" style={{ marginTop: 4 }}>
              <Monto valor={g.monto} placeholder="Monto" onChange={(n) => setGasto(i, { ...g, monto: n })} />
              <select value={g.cuenta ?? 'efectivo'} onChange={(e) => setGasto(i, { ...g, cuenta: e.target.value as 'efectivo' | 'nequi' })}>
                <option value="efectivo">Paga Efectivo</option><option value="nequi">Paga Nequi</option>
              </select>
            </div>
            <div style={{ marginTop: 4 }}>
              <select value={g.origen} onChange={(e) => setGasto(i, { ...g, origen: e.target.value as Origen })}>
                <option value="operativo">Operativo</option>
                {BOLSILLOS.map((b) => <option key={b} value={b}>Sale de {NOMBRE_BOLSILLO[b]}</option>)}
              </select>
            </div>
          </div>
        ))}
        <button className="sec" onClick={agregarGasto}>+ Agregar gasto</button>
      </div>

      <div className="card">
        <h2>Así se reparte</h2>
        <div className="item"><span>Producido</span><b>{formatCOP(r.producido)}</b></div>
        <div className="item"><span>− Gastos operativos</span><b>{formatCOP(r.operativos)}</b></div>
        <div className="item"><span>Limpio</span><b className={r.limpio < 0 ? 'neg' : ''}>{formatCOP(r.limpio)}</b></div>
        {BOLSILLOS.map((b) => <div className="item dim" key={b}><span>→ {NOMBRE_BOLSILLO[b]}</span><span>{formatCOP(r.reparto[b])}</span></div>)}
        {r.limpio < 0 && <p className="warnc">Día en pérdida: lo cubre Imprevistos.</p>}
      </div>
      <button className="full" disabled={r.producido === 0 && dia.gastos.length === 0} onClick={guardar}>Guardar día</button>

      <h2 style={{ marginTop: 24 }}>Últimos días</h2>
      <div className="card">
        {recientes.length === 0 && <p className="dim">Aún no hay días.</p>}
        {recientes.map((x) => (
          <div className="item" key={x.fecha}>
            <span>{x.fecha}<br /><span className="dim">{x.viajes} viajes · gastos {formatCOP(x.gastos.reduce((a, g) => a + g.monto, 0))}{x.gastos[0] ? ' (' + catNombre(x.gastos[0].categoriaId) + '…)' : ''}</span></span>
            <span style={{ textAlign: 'right' }}><b>{formatCOP(x.efectivo + x.app)}</b><br />
              <button className="sm sec" onClick={() => setDia(x)}>Editar</button>{' '}
              <button className="sm bad" onClick={() => confirmar('¿Borrar el día ' + x.fecha + '? Se devuelve todo lo que repartió.') && borrarDia(x.fecha)}>Borrar</button></span>
          </div>
        ))}
      </div>
    </>
  )
}
