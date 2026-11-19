import { useState } from 'react'
import { X } from 'lucide-react'
import { borrarPorRef, guardarGastoSuelto } from '../db'
import { BOLSILLOS, NOMBRE_BOLSILLO, NOMBRE_CUENTA, formatCOP, hoyISO, type Bolsillo } from '../logica/dinero'
import { ICONO_BOLSILLO } from '../tema'
import { Monto, confirmar, type Datos } from '../ui'

const TIPOS = ['Comida', 'Salida', 'Transporte', 'Otro']

/** Gasto fuera del turno (comida en la U, salida con amigos): NO cuenta como gasto de trabajo. */
export default function Gasto({ d, volver }: { d: Datos; volver: () => void }) {
  const [f, setF] = useState({ fecha: hoyISO(), monto: 0, tipo: 'Comida', nota: '', cuenta: 'efectivo' as 'efectivo' | 'nequi', bolsillo: 'personal' as Bolsillo })
  const saldoCuenta = d.cuentas[f.cuenta], saldoBols = d.bolsillos[f.bolsillo]

  // Lista: una fila por gasto (la del bolsillo trae nota y monto; la cuenta sale de su pareja con el mismo ref).
  const gastos = d.movs.filter((m) => m.tipo === 'gasto-suelto' && m.bolsillo && m.ref).sort((a, b) => b.fecha.localeCompare(a.fecha) || b.ref!.localeCompare(a.ref!)).slice(0, 15)
    .map((m) => ({ ...m, cuenta: d.movs.find((x) => x.ref === m.ref && x.cuenta)?.cuenta }))

  const guardar = async () => {
    await guardarGastoSuelto(f.fecha, f.monto, f.cuenta, f.bolsillo, f.nota.trim() ? `${f.tipo}: ${f.nota.trim()}` : f.tipo)
    setF({ ...f, monto: 0, nota: '' })
  }

  return (
    <>
      <h1>Gasto personal</h1>
      <p className="dim">Para lo que gastas fuera del turno: comida en la universidad, una salida, etc. No cuenta como gasto de trabajo ni mueve tus resúmenes de DiDi.</p>
      <div className="card">
        <label>Fecha</label><input type="date" value={f.fecha} max={hoyISO()} onChange={(e) => e.target.value && setF({ ...f, fecha: e.target.value })} />
        <label>Monto</label><Monto valor={f.monto} autoFocus onChange={(n) => setF({ ...f, monto: n })} />
        <label>¿Qué fue?</label>
        <div className="row" style={{ flexWrap: 'wrap' }}>{TIPOS.map((t) => <button key={t} className={'sm ' + (f.tipo === t ? '' : 'sec')} style={{ flex: '1 1 40%' }} onClick={() => setF({ ...f, tipo: t })}>{t}</button>)}</div>
        <label>Nota (opcional)</label><input value={f.nota} placeholder="Almuerzo en la U" onChange={(e) => setF({ ...f, nota: e.target.value })} />
        <label>¿Con qué pagaste?</label>
        <select value={f.cuenta} onChange={(e) => setF({ ...f, cuenta: e.target.value as 'efectivo' | 'nequi' })}><option value="efectivo">Efectivo</option><option value="nequi">Nequi</option></select>
        <label>¿De qué bolsillo sale?</label>
        <select value={f.bolsillo} onChange={(e) => setF({ ...f, bolsillo: e.target.value as Bolsillo })}>{BOLSILLOS.map((b) => <option key={b} value={b}>{NOMBRE_BOLSILLO[b]}</option>)}</select>
        {f.monto > 0 && <p className="dim">{NOMBRE_CUENTA[f.cuenta]}: {formatCOP(saldoCuenta)} → <b className={saldoCuenta - f.monto < 0 ? 'neg' : ''}>{formatCOP(saldoCuenta - f.monto)}</b><br />{NOMBRE_BOLSILLO[f.bolsillo]}: {formatCOP(saldoBols)} → <b className={saldoBols - f.monto < 0 ? 'neg' : ''}>{formatCOP(saldoBols - f.monto)}</b></p>}
      </div>
      <div className="row"><button className="sec" onClick={volver}>Volver</button><button style={{ flex: 2 }} disabled={f.monto <= 0} onClick={guardar}>Guardar gasto</button></div>

      <h2 style={{ marginTop: 24 }}>Últimos gastos personales</h2>
      <div className="card">
        {gastos.length === 0 && <p className="dim">Aún no hay.</p>}
        {gastos.map((g) => { const I = ICONO_BOLSILLO[g.bolsillo!]; return (
          <div className="item" key={g.ref}>
            <span><I size={16} style={{ color: `var(--c-${g.bolsillo})`, verticalAlign: -2, marginRight: 6 }} aria-hidden />{g.nota}<br /><span className="dim">{g.fecha} · {g.cuenta ? NOMBRE_CUENTA[g.cuenta] : ''} · {NOMBRE_BOLSILLO[g.bolsillo!]}</span></span>
            <span><b className="neg">{formatCOP(-g.monto)}</b> <button className="sm bad" aria-label="Borrar gasto" onClick={() => confirmar('¿Borrar este gasto? La plata vuelve a la cuenta y al bolsillo.') && borrarPorRef(g.ref!)}><X size={16} aria-hidden /></button></span>
          </div>) })}
      </div>
    </>
  )
}
