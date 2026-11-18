import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { borrarExtra, db, guardarExtra, retirarDidi, trasladar } from '../db'
import { BOLSILLOS, CUENTAS, NOMBRE_BOLSILLO, NOMBRE_CUENTA, cuadre, formatCOP, hoyISO, type Bolsillo, type Cuenta } from '../logica/dinero'
import { Monto, confirmar, type Datos } from '../ui'

export default function Cuentas({ d }: { d: Datos }) {
  const cu = cuadre(d.cuentas, d.bolsillos, d.config.caja)
  const extras = useLiveQuery(() => db.extras.orderBy('fecha').reverse().limit(8).toArray(), [], [])
  const [ret, setRet] = useState(0)
  const [tr, setTr] = useState({ de: 'moto' as Bolsillo, a: 'metas' as Bolsillo, monto: 0, nota: '' })
  const [ex, setEx] = useState({ tipo: 'familiar' as 'familiar' | 'bono', monto: 0, cuenta: 'nequi' as Cuenta, destino: 'metas' as Bolsillo, nota: '' })

  return (
    <>
      <h1>Cuentas y bolsillos</h1>
      <div className={'alert ' + (cu.cuadra ? 'ok' : 'bad')}>
        {cu.cuadra ? '✔ Todo cuadra' : `⚠ No cuadra. Diferencia: ${formatCOP(cu.diferencia)}`}
        <div className="dim">Cuentas {formatCOP(cu.totalCuentas)} = Bolsillos {formatCOP(cu.totalBolsillos)} + Caja de cambio {formatCOP(d.config.caja)}</div>
      </div>

      <div className="card">
        <h2>Cuentas reales</h2>
        {CUENTAS.map((k) => <div className="item" key={k}><span>{NOMBRE_CUENTA[k]}</span><b>{formatCOP(d.cuentas[k])}</b></div>)}
        <label>Retirar de DiDi a Nequi</label>
        <div className="row"><Monto valor={ret} onChange={setRet} placeholder="Monto" />
          <button disabled={ret <= 0} onClick={() => { retirarDidi(hoyISO(), ret); setRet(0) }}>Retirar</button></div>
      </div>

      <div className="card">
        <h2>Mover entre bolsillos</h2>
        <div className="row">
          <select value={tr.de} onChange={(e) => setTr({ ...tr, de: e.target.value as Bolsillo })}>{BOLSILLOS.map((b) => <option key={b} value={b}>De {NOMBRE_BOLSILLO[b]}</option>)}</select>
          <select value={tr.a} onChange={(e) => setTr({ ...tr, a: e.target.value as Bolsillo })}>{BOLSILLOS.map((b) => <option key={b} value={b}>A {NOMBRE_BOLSILLO[b]}</option>)}</select>
        </div>
        <label>Monto</label><Monto valor={tr.monto} onChange={(n) => setTr({ ...tr, monto: n })} />
        <label>Nota (obligatoria)</label><input value={tr.nota} onChange={(e) => setTr({ ...tr, nota: e.target.value })} />
        <button className="full" disabled={tr.monto <= 0 || tr.de === tr.a || !tr.nota.trim()} onClick={() => { trasladar(hoyISO(), tr.de, tr.a, tr.monto, tr.nota.trim()); setTr({ ...tr, monto: 0, nota: '' }) }}>Mover</button>
      </div>

      <div className="card">
        <h2>Ingreso extra (familia o bono DiDi)</h2>
        <div className="row">
          <select value={ex.tipo} onChange={(e) => setEx({ ...ex, tipo: e.target.value as 'familiar' | 'bono' })}><option value="familiar">Aporte familiar</option><option value="bono">Bono DiDi</option></select>
          <select value={ex.cuenta} onChange={(e) => setEx({ ...ex, cuenta: e.target.value as Cuenta })}>{CUENTAS.map((c) => <option key={c} value={c}>Entra a {NOMBRE_CUENTA[c]}</option>)}</select>
        </div>
        <label>Monto</label><Monto valor={ex.monto} onChange={(n) => setEx({ ...ex, monto: n })} />
        <label>Destino (por defecto la meta)</label>
        <select value={ex.destino} onChange={(e) => setEx({ ...ex, destino: e.target.value as Bolsillo })}>{BOLSILLOS.map((b) => <option key={b} value={b}>{NOMBRE_BOLSILLO[b]}</option>)}</select>
        <label>Nota (opcional)</label><input value={ex.nota} onChange={(e) => setEx({ ...ex, nota: e.target.value })} />
        <button className="full" disabled={ex.monto <= 0} onClick={() => { guardarExtra({ ...ex, fecha: hoyISO() }); setEx({ ...ex, monto: 0, nota: '' }) }}>Guardar ingreso</button>
        {extras.map((e) => (
          <div className="item" key={e.id}><span>{e.fecha} · {e.tipo === 'bono' ? 'Bono' : 'Familia'} → {NOMBRE_BOLSILLO[e.destino]}<br /><span className="dim">{e.nota}</span></span>
            <span><b>{formatCOP(e.monto)}</b> <button className="sm bad" onClick={() => confirmar('¿Borrar este ingreso?') && borrarExtra(e.id!)}>✕</button></span></div>
        ))}
      </div>
    </>
  )
}
