import { useState } from 'react'
import { db, guardarDia } from '../db'
import { BOLSILLOS, NOMBRE_BOLSILLO, NOMBRE_CUENTA, diaRapido, formatCOP, hoyISO, resumenDia } from '../logica/dinero'
import { Cop, ICONO_BOLSILLO } from '../tema'
import { Monto, confirmar, type Datos } from '../ui'

const num = (s: string) => Number(s.replace(',', '.').replace(/[^\d.]/g, '')) || 0

export default function RegistroRapido({ d, volver }: { d: Datos; volver: () => void }) {
  const [f, setF] = useState({ fecha: hoyISO(), efectivo: 0, nequi: 0, didi: 0, viajes: 0, horas: 0 })
  const dia = diaRapido(f.fecha, { efectivo: f.efectivo, nequi: f.nequi, didi: f.didi }, f.viajes, f.horas)
  const r = resumenDia(dia, d.config, d.bolsillos.imprevistos)

  const guardar = async () => {
    const existente = await db.dias.get(f.fecha)
    if (existente && !confirmar(`Ya hay un día registrado el ${f.fecha}. ¿Reemplazarlo por este registro rápido?`)) return
    await guardarDia(dia)
    volver()
  }

  return (
    <>
      <h1>Registro rápido</h1>
      <p className="dim">Escribe solo lo LIMPIO del día: ya restada gasolina, comida, etc.</p>
      <div className="card">
        <label>Fecha</label><input type="date" value={f.fecha} max={hoyISO()} onChange={(e) => e.target.value && setF({ ...f, fecha: e.target.value })} />
        <p className="dim" style={{ marginBottom: 0 }}>¿Dónde quedó lo limpio? Puedes repartirlo entre varias cuentas.</p>
        {(['efectivo', 'nequi', 'didi'] as const).map((c) => <div key={c}><label>{NOMBRE_CUENTA[c]}{c === 'efectivo' && ' (sin la base de vuelto)'}</label>
          <Monto valor={f[c]} autoFocus={c === 'efectivo'} onChange={(n) => setF({ ...f, [c]: n })} /></div>)}
        <p className="big pos">Limpio del día: {formatCOP(r.limpio)}</p>
        <div className="grid2">
          <div><label>Viajes (opcional)</label><input inputMode="numeric" value={f.viajes || ''} onChange={(e) => setF({ ...f, viajes: num(e.target.value) })} /></div>
          <div><label>Horas (opcional)</label><input inputMode="decimal" value={f.horas || ''} onChange={(e) => setF({ ...f, horas: num(e.target.value) })} /></div>
        </div>
      </div>

      <div className="card">
        <h2>Así se reparte</h2>
        {BOLSILLOS.map((b) => { const I = ICONO_BOLSILLO[b]; return <div className="item" key={b}><span className="row" style={{ justifyContent: 'flex-start' }}><I size={18} style={{ color: `var(--c-${b})`, flex: 'none' }} aria-hidden />{NOMBRE_BOLSILLO[b]}</span><b><Cop n={r.reparto[b]} /></b></div> })}
        <div className="item dim"><span>Total</span><span>{formatCOP(r.limpio)}</span></div>
      </div>

      <div className="row">
        <button className="sec" onClick={volver}>Cancelar</button>
        <button style={{ flex: 2 }} disabled={r.limpio <= 0} onClick={guardar}>Guardar</button>
      </div>
    </>
  )
}
