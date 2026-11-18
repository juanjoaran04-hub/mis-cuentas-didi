import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { comprarMeta, db } from '../db'
import { ahorroSemanalMetas, asignarMetas, diasDeTrabajo, formatCOP, hoyISO, metasPorDiaTrabajado, proyeccion } from '../logica/dinero'
import { Barra, Monto, confirmar, type Datos } from '../ui'

/** Calcula acumulado/falta/fecha estimada de cada meta. Se usa también en Inicio. */
export function useMetas(d: Datos) {
  const metas = useLiveQuery(() => db.metas.toArray(), [], [])
  const hoy = hoyISO()
  const semanal = ahorroSemanalMetas(d.movs, hoy)
  const porDia = metasPorDiaTrabajado(d.movs, hoy)
  const filas = asignarMetas(d.bolsillos.metas, metas).map((f) => ({ ...f, proy: proyeccion(f.falta, semanal, hoy), dias: diasDeTrabajo(f.falta, porDia) }))
  return { metas, filas, semanal }
}

export default function Metas({ d }: { d: Datos }) {
  const { metas, filas, semanal } = useMetas(d)
  const [n, setN] = useState({ nombre: '', monto: 0, prioridad: metas.length + 1, fechaDeseada: '' })
  const logradas = metas.filter((m) => m.lograda)

  return (
    <>
      <h1>Metas</h1>
      <p className="dim">Ahorro promedio a Metas (últimas 4 semanas): <b>{formatCOP(semanal)}</b> por semana. Saldo en el bolsillo: {formatCOP(d.bolsillos.metas)}.</p>
      {filas.map(({ meta, acumulado, falta, proy, dias }) => (
        <div className="card" key={meta.id}>
          <div className="row"><h2>#{meta.prioridad} {meta.nombre}</h2><b style={{ flex: 'none' }}>{formatCOP(meta.monto)}</b></div>
          <Barra pct={(acumulado / meta.monto) * 100} />
          <div className="dim">Llevas {formatCOP(acumulado)} · Faltan {formatCOP(falta)}{dias ? ` · ≈ ${dias} días de trabajo` : ''}</div>
          <div>{falta === 0 ? <b className="okc">🎉 ¡Ya alcanza! Puedes comprarla.</b> : proy.fecha ? <>Fecha estimada: <b>{proy.fecha}</b></> : <span className="warnc">Sin ahorro reciente: no se puede estimar.</span>}</div>
          {meta.fechaDeseada && <div className={proy.fecha && proy.fecha > meta.fechaDeseada ? 'warnc' : 'dim'}>Fecha deseada: {meta.fechaDeseada}{proy.fecha && proy.fecha > meta.fechaDeseada ? ' (vas tarde)' : ''}</div>}
          <div className="row" style={{ marginTop: 8 }}>
            {falta === 0 && <button onClick={() => confirmar(`¿Ya compraste "${meta.nombre}"? Se descuenta ${formatCOP(meta.monto)} del bolsillo Metas y del Efectivo.`) && comprarMeta(meta, 'efectivo', hoyISO())}>Ya la compré</button>}
            <button className="sm bad" onClick={() => confirmar('¿Borrar la meta?') && db.metas.delete(meta.id!)}>Borrar</button>
          </div>
        </div>
      ))}
      {logradas.length > 0 && <p className="dim">Logradas: {logradas.map((m) => m.nombre).join(', ')}</p>}

      <div className="card">
        <h2>Nueva meta</h2>
        <label>Nombre</label><input value={n.nombre} onChange={(e) => setN({ ...n, nombre: e.target.value })} />
        <label>Monto</label><Monto valor={n.monto} onChange={(v) => setN({ ...n, monto: v })} />
        <label>Prioridad (1 = primero)</label><input inputMode="numeric" value={n.prioridad} onChange={(e) => setN({ ...n, prioridad: Number(e.target.value.replace(/\D/g, '')) || 1 })} />
        <label>Fecha deseada (opcional)</label><input type="date" value={n.fechaDeseada} onChange={(e) => setN({ ...n, fechaDeseada: e.target.value })} />
        <button className="full" disabled={!n.nombre.trim() || n.monto <= 0} onClick={async () => { await db.metas.add({ nombre: n.nombre.trim(), monto: n.monto, prioridad: n.prioridad, fechaDeseada: n.fechaDeseada || undefined }); setN({ nombre: '', monto: 0, prioridad: metas.length + 2, fechaDeseada: '' }) }}>Agregar meta</button>
      </div>
    </>
  )
}
