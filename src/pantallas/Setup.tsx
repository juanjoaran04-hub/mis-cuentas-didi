import { useState } from 'react'
import { db, type Config } from '../db'
import { BOLSILLOS, CUENTAS, NOMBRE_BOLSILLO, NOMBRE_CUENTA, formatCOP, sumaPorcentajes, hoyISO, type Bolsillo, type Cuenta } from '../logica/dinero'
import { Monto } from '../ui'

/** Primera pantalla: aquí se escriben los saldos reales. Nada de esto está en el código. */
export default function Setup({ config }: { config: Config }) {
  const [c, setC] = useState<Config>(config)
  const [meta, setMeta] = useState({ nombre: '', monto: 0 })
  const sumaP = sumaPorcentajes(c.porcentajes)
  const totalCuentas = CUENTAS.reduce((a, k) => a + c.inicialCuentas[k], 0)
  const totalBols = BOLSILLOS.reduce((a, k) => a + c.inicialBolsillos[k], 0)
  const dif = totalCuentas - totalBols - c.caja
  const ok = sumaP === 100

  const guardar = async () => {
    await db.config.put({ ...c, listo: true })
    if (meta.nombre.trim() && meta.monto > 0) await db.metas.add({ nombre: meta.nombre.trim(), monto: meta.monto, prioridad: 1 })
  }

  return (
    <>
      <h1>Configuración inicial</h1>
      <p className="dim">Escribe con cuánta plata empiezas. Todo queda solo en tu celular. Puedes cambiarlo luego en Ajustes.</p>

      <div className="card">
        <h2>1. ¿Dónde está tu plata hoy?</h2>
        {CUENTAS.map((k: Cuenta) => <div key={k}><label>{NOMBRE_CUENTA[k]}</label><Monto valor={c.inicialCuentas[k]} onChange={(n) => setC({ ...c, inicialCuentas: { ...c.inicialCuentas, [k]: n } })} /></div>)}
        <label>Caja de cambio (monedas y billetes para dar vueltas; no es plata disponible)</label>
        <Monto valor={c.caja} onChange={(n) => setC({ ...c, caja: n })} />
      </div>

      <div className="card">
        <h2>2. ¿Cuánto hay en cada bolsillo?</h2>
        <p className="dim">Los bolsillos dividen esa plata. Si no sabes, déjalos en 0 y pon todo en Personal.</p>
        {BOLSILLOS.map((k: Bolsillo) => <div key={k}><label>{NOMBRE_BOLSILLO[k]}</label><Monto valor={c.inicialBolsillos[k]} onChange={(n) => setC({ ...c, inicialBolsillos: { ...c.inicialBolsillos, [k]: n } })} /></div>)}
        <p className={dif === 0 ? 'okc' : 'warnc'}>{dif === 0 ? '✔ Cuentas y bolsillos cuadran' : `Diferencia: ${formatCOP(dif)} (cuentas − bolsillos − caja). Puedes guardar igual, pero la app te la va a mostrar.`}</p>
      </div>

      <div className="card">
        <h2>3. ¿Cómo repartir lo limpio de cada día?</h2>
        {BOLSILLOS.map((k) => <div key={k}><label>{NOMBRE_BOLSILLO[k]} (%)</label>
          <input inputMode="numeric" value={c.porcentajes[k]} onChange={(e) => setC({ ...c, porcentajes: { ...c.porcentajes, [k]: Number(e.target.value.replace(/\D/g, '')) || 0 } })} /></div>)}
        <p className={ok ? 'okc' : 'neg'}>Suma: {sumaP}% {ok ? '✔' : '(tiene que dar 100)'}</p>
        <label>Tope de Imprevistos (cuando se llena, su % pasa a Metas)</label>
        <Monto valor={c.topeImprevistos} onChange={(n) => setC({ ...c, topeImprevistos: n })} />
      </div>

      <div className="card">
        <h2>4. Tu primera meta (opcional)</h2>
        <label>Nombre (ej. Tablet)</label><input value={meta.nombre} onChange={(e) => setMeta({ ...meta, nombre: e.target.value })} />
        <label>Cuánto cuesta</label><Monto valor={meta.monto} onChange={(n) => setMeta({ ...meta, monto: n })} />
      </div>

      <div className="card">
        <h2>5. Moto</h2>
        <label>Kilometraje actual</label><Monto valor={c.kmActual} onChange={(n) => setC({ ...c, kmActual: n })} />
      </div>

      <button className="full" disabled={!ok} onClick={guardar}>Guardar y empezar</button>
      <p className="dim">Fecha de hoy: {hoyISO()}</p>
    </>
  )
}
