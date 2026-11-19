import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ajustarCuenta, borrarExtra, db, guardarBase, guardarExtra, moverEntreCuentas, retirarDidi, trasladar } from '../db'
import { BOLSILLOS, CUENTAS, NOMBRE_BOLSILLO, NOMBRE_CUENTA, cuadre, formatCOP, hoyISO, type Bolsillo, type Cuenta } from '../logica/dinero'
import { CircleAlert, CircleCheck, Wallet, X } from 'lucide-react'
import { Cop } from '../tema'
import { Monto, confirmar, type Datos } from '../ui'

export default function Cuentas({ d }: { d: Datos }) {
  const cu = cuadre(d.cuentas, d.bolsillos, 0) // la base de vuelto es plata tuya dentro del efectivo
  const extras = useLiveQuery(() => db.extras.orderBy('fecha').reverse().limit(8).toArray(), [], [])
  const [ret, setRet] = useState(0)
  const [base, setBase] = useState(d.config.caja)
  const [aj, setAj] = useState({ cuenta: 'efectivo' as Cuenta, real: -1, bolsillo: 'personal' as Bolsillo }) // real -1 = sin escribir todavía
  const ajReal = aj.real < 0 ? d.cuentas[aj.cuenta] : aj.real
  const ajDif = ajReal - d.cuentas[aj.cuenta]
  const [mc, setMc] = useState({ de: 'efectivo' as Cuenta, a: 'nequi' as Cuenta, monto: 0, nota: '' })
  const [tr, setTr] = useState({ de: 'moto' as Bolsillo, a: 'metas' as Bolsillo, monto: 0, nota: '' })
  const [ex, setEx] = useState({ tipo: 'familiar' as 'familiar' | 'bono', monto: 0, cuenta: 'nequi' as Cuenta, destino: 'metas' as Bolsillo, nota: '' })

  return (
    <>
      <h1>Cuentas y bolsillos</h1>
      <div className={'alert ' + (cu.cuadra ? 'ok' : 'bad')}>
        {cu.cuadra ? <CircleCheck size={20} aria-hidden /> : <CircleAlert size={20} aria-hidden />}
        <div><b>{cu.cuadra ? 'Todo cuadra' : `No cuadra. Diferencia: ${formatCOP(cu.diferencia)}`}</b>
        <div className="dim">Cuentas {formatCOP(cu.totalCuentas)} = Bolsillos {formatCOP(cu.totalBolsillos)}</div></div>
      </div>

      <div className="card">
        <h2><Wallet size={20} aria-hidden />Cuentas reales</h2>
        {CUENTAS.map((k) => <div className="item" key={k}><span>{NOMBRE_CUENTA[k]}</span><b><Cop n={d.cuentas[k]} /></b></div>)}
        <label>Retirar de DiDi a Nequi</label>
        <div className="row"><Monto valor={ret} onChange={setRet} placeholder="Monto" />
          <button disabled={ret <= 0} onClick={() => { retirarDidi(hoyISO(), ret); setRet(0) }}>Retirar</button></div>
      </div>

      <div className="card">
        <h2>Base de vuelto</h2>
        <p className="dim">Es parte de tu efectivo que llevas para dar vueltos. Sigue siendo tuya: no se resta de ningún bolsillo ni de tus cuentas. Solo sirve para saber cuánto de tu efectivo es libre.</p>
        <div className="item"><span>Efectivo ahora</span><b>{formatCOP(d.cuentas.efectivo)}</b></div>
        <div className="item"><span>Base de vuelto</span><b>{formatCOP(d.config.caja)}</b></div>
        <div className="item"><span>Efectivo libre (sin la base)</span><b><Cop n={d.cuentas.efectivo - d.config.caja} /></b></div>
        <label>Base con la que sales</label><Monto valor={base} onChange={setBase} />
        <button className="full" disabled={base === d.config.caja} onClick={() => guardarBase(base)}>Guardar base</button>
      </div>

      <div className="card">
        <h2>Ajustar una cuenta al saldo real</h2>
        <p className="dim">Cuenta cuánto hay de verdad y la app corrige la diferencia. Esa diferencia se suma o se resta a un bolsillo para que todo siga cuadrando.</p>
        <label>Cuenta</label>
        <select value={aj.cuenta} onChange={(e) => setAj({ ...aj, cuenta: e.target.value as Cuenta, real: -1 })}>{CUENTAS.map((c) => <option key={c} value={c}>{NOMBRE_CUENTA[c]} (la app dice {formatCOP(d.cuentas[c])})</option>)}</select>
        <label>Saldo real</label><Monto valor={ajReal} onChange={(n) => setAj({ ...aj, real: n })} />
        <label>Diferencia va a</label>
        <select value={aj.bolsillo} onChange={(e) => setAj({ ...aj, bolsillo: e.target.value as Bolsillo })}>{BOLSILLOS.map((b) => <option key={b} value={b}>{NOMBRE_BOLSILLO[b]}</option>)}</select>
        {ajDif !== 0 && <p>Diferencia: <b><Cop n={ajDif} /></b></p>}
        <button className="full" disabled={ajDif === 0} onClick={() => { ajustarCuenta(hoyISO(), aj.cuenta, d.cuentas[aj.cuenta], ajReal, aj.bolsillo, ''); setAj({ ...aj, real: -1 }) }}>Ajustar</button>
      </div>

      <div className="card">
        <h2>Mover entre cuentas</h2>
        <p className="dim">Ej. consigné plata del Efectivo a Nequi. Cambia las cuentas, no los bolsillos.</p>
        <div className="row">
          <select value={mc.de} onChange={(e) => setMc({ ...mc, de: e.target.value as Cuenta })}>{CUENTAS.map((c) => <option key={c} value={c}>De {NOMBRE_CUENTA[c]}</option>)}</select>
          <select value={mc.a} onChange={(e) => setMc({ ...mc, a: e.target.value as Cuenta })}>{CUENTAS.map((c) => <option key={c} value={c}>A {NOMBRE_CUENTA[c]}</option>)}</select>
        </div>
        <label>Monto</label><Monto valor={mc.monto} onChange={(n) => setMc({ ...mc, monto: n })} />
        <label>Nota (opcional)</label><input value={mc.nota} onChange={(e) => setMc({ ...mc, nota: e.target.value })} />
        {mc.monto > d.cuentas[mc.de] && <p className="warnc">Ojo: {NOMBRE_CUENTA[mc.de]} tiene {formatCOP(d.cuentas[mc.de])}, menos de lo que vas a mover.</p>}
        <button className="full" disabled={mc.monto <= 0 || mc.de === mc.a} onClick={() => { moverEntreCuentas(hoyISO(), mc.de, mc.a, mc.monto, mc.nota.trim()); setMc({ ...mc, monto: 0, nota: '' }) }}>Mover</button>
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
            <span><b className="pos">{formatCOP(e.monto)}</b> <button className="sm bad" aria-label="Borrar ingreso" onClick={() => confirmar('¿Borrar este ingreso?') && borrarExtra(e.id!)}><X size={16} aria-hidden /></button></span></div>
        ))}
      </div>
    </>
  )
}
