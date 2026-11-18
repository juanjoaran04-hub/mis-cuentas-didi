import { useState } from 'react'
import { db, guardarDia } from '../db'
import { BOLSILLOS, NOMBRE_BOLSILLO, diaRapido, formatCOP, hoyISO, resumenDia } from '../logica/dinero'
import { Monto, confirmar, type Datos } from '../ui'

const num = (s: string) => Number(s.replace(',', '.').replace(/[^\d.]/g, '')) || 0

export default function RegistroRapido({ d, volver }: { d: Datos; volver: () => void }) {
  const [f, setF] = useState({ fecha: hoyISO(), limpio: 0, cuenta: 'efectivo' as 'efectivo' | 'nequi', viajes: 0, horas: 0 })
  const dia = diaRapido(f.fecha, f.limpio, f.cuenta, f.viajes, f.horas)
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
        <label>Dinero limpio del día</label><Monto valor={f.limpio} autoFocus onChange={(n) => setF({ ...f, limpio: n })} />
        <label>¿En qué cuenta quedó?</label>
        <select value={f.cuenta} onChange={(e) => setF({ ...f, cuenta: e.target.value as 'efectivo' | 'nequi' })}><option value="efectivo">Efectivo</option><option value="nequi">Nequi</option></select>
        <div className="grid2">
          <div><label>Viajes (opcional)</label><input inputMode="numeric" value={f.viajes || ''} onChange={(e) => setF({ ...f, viajes: num(e.target.value) })} /></div>
          <div><label>Horas (opcional)</label><input inputMode="decimal" value={f.horas || ''} onChange={(e) => setF({ ...f, horas: num(e.target.value) })} /></div>
        </div>
      </div>

      <div className="card">
        <h2>Así se reparte</h2>
        {BOLSILLOS.map((b) => <div className="item" key={b}><span>→ {NOMBRE_BOLSILLO[b]}</span><b>{formatCOP(r.reparto[b])}</b></div>)}
        <div className="item dim"><span>Total</span><span>{formatCOP(r.limpio)}</span></div>
      </div>

      <div className="row">
        <button className="sec" onClick={volver}>Cancelar</button>
        <button style={{ flex: 2 }} disabled={f.limpio <= 0} onClick={guardar}>Guardar</button>
      </div>
    </>
  )
}
