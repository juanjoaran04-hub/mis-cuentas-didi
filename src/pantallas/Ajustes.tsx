import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, exportarTodo, importarTodo, ultimoRespaldo, type Config } from '../db'
import { BOLSILLOS, CUENTAS, NOMBRE_BOLSILLO, NOMBRE_CUENTA, sumaPorcentajes, type Origen } from '../logica/dinero'
import { Monto, confirmar, type Datos } from '../ui'

/** Quita la copia guardada de la app (service worker + caché) y recarga. IndexedDB (tus datos) no se toca. */
async function actualizarApp() {
  try {
    for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister()
    for (const k of await caches.keys()) await caches.delete(k)
  } catch { /* sin service worker: igual recarga */ }
  location.reload()
}

function Respaldo() {
  const [msg, setMsg] = useState('')
  const ult = ultimoRespaldo()
  const exportar = async () => {
    const blob = new Blob([await exportarTodo()], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `respaldo-mis-cuentas-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    setMsg('✔ Respaldo descargado. Guárdalo en Drive o mándatelo por WhatsApp.')
  }
  const importar = async (f?: File) => {
    if (!f) return
    if (!confirmar('Importar REEMPLAZA todo lo que hay ahora en esta app por lo del archivo. ¿Seguir?')) return
    try { await importarTodo(await f.text()); setMsg('✔ Datos importados.') } catch (e) { setMsg('⚠ ' + (e as Error).message) }
  }
  return (
    <div className="card">
      <h2>Respaldo</h2>
      <p className="dim">Último respaldo: {ult ? new Date(ult).toLocaleDateString('es-CO') : 'nunca'}. La app te lo recuerda cada 7 días.</p>
      <button className="full" onClick={exportar}>Exportar respaldo (JSON)</button>
      <label>Importar respaldo (reemplaza todo)</label>
      <input type="file" accept="application/json,.json" onChange={(e) => { importar(e.target.files?.[0]); e.target.value = '' }} />
      {msg && <p>{msg}</p>}
    </div>
  )
}

export default function Ajustes({ d }: { d: Datos }) {
  const [c, setC] = useState<Config>(d.config)
  const cats = useLiveQuery(() => db.categorias.toArray(), [], [])
  const [nueva, setNueva] = useState({ nombre: '', origen: 'operativo' as Origen })
  const ok = sumaPorcentajes(c.porcentajes) === 100
  const num = (s: string) => Number(s.replace(/\D/g, '')) || 0

  return (
    <>
      <h1>Ajustes</h1>
      <div className="card">
        <h2>Reparto</h2>
        {BOLSILLOS.map((k) => <div key={k}><label>{NOMBRE_BOLSILLO[k]} (%)</label><input inputMode="numeric" value={c.porcentajes[k]} onChange={(e) => setC({ ...c, porcentajes: { ...c.porcentajes, [k]: num(e.target.value) } })} /></div>)}
        <p className={ok ? 'okc' : 'neg'}>Suma: {sumaPorcentajes(c.porcentajes)}%</p>
        <label>Tope de Imprevistos</label><Monto valor={c.topeImprevistos} onChange={(n) => setC({ ...c, topeImprevistos: n })} />
        <label>Caja de cambio</label><Monto valor={c.caja} onChange={(n) => setC({ ...c, caja: n })} />
        <p className="dim">Los cambios de % valen para los días que guardes desde ahora.</p>
      </div>

      <div className="card">
        <h2>Moto: cada cuántos km</h2>
        <label>Aceite</label><Monto valor={c.moto.aceiteCada} onChange={(n) => setC({ ...c, moto: { ...c.moto, aceiteCada: n } })} />
        <label>Lubricar cadena (500 a 1.000)</label><Monto valor={c.moto.cadenaCada} onChange={(n) => setC({ ...c, moto: { ...c.moto, cadenaCada: n } })} />
        <label>Kit de arrastre: revisar desde (km)</label><Monto valor={c.moto.arrastreMin} onChange={(n) => setC({ ...c, moto: { ...c.moto, arrastreMin: n } })} />
        <label>Kit de arrastre: cambiar a más tardar (km)</label><Monto valor={c.moto.arrastreMax} onChange={(n) => setC({ ...c, moto: { ...c.moto, arrastreMax: n } })} />
      </div>
      <button className="full" disabled={!ok} onClick={() => db.config.put(c)}>Guardar ajustes</button>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Categorías de gasto</h2>
        {cats.map((x) => (
          <div className="row" key={x.id} style={{ marginBottom: 6 }}>
            <input defaultValue={x.nombre} onBlur={(e) => e.target.value.trim() && db.categorias.update(x.id!, { nombre: e.target.value.trim() })} />
            <select value={x.origen} onChange={(e) => db.categorias.update(x.id!, { origen: e.target.value as Origen })}>
              <option value="operativo">Operativo</option>{BOLSILLOS.map((b) => <option key={b} value={b}>De {NOMBRE_BOLSILLO[b]}</option>)}
            </select>
            <button className="sm bad" onClick={() => confirmar('¿Borrar la categoría "' + x.nombre + '"? Los días ya guardados no cambian.') && db.categorias.delete(x.id!)}>✕</button>
          </div>
        ))}
        <label>Nueva categoría</label>
        <div className="row"><input value={nueva.nombre} onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })} />
          <select value={nueva.origen} onChange={(e) => setNueva({ ...nueva, origen: e.target.value as Origen })}><option value="operativo">Operativo</option>{BOLSILLOS.map((b) => <option key={b} value={b}>De {NOMBRE_BOLSILLO[b]}</option>)}</select>
          <button disabled={!nueva.nombre.trim()} onClick={() => { db.categorias.add({ nombre: nueva.nombre.trim(), origen: nueva.origen }); setNueva({ ...nueva, nombre: '' }) }}>+</button></div>
      </div>

      <div className="card">
        <h2>Saldos iniciales</h2>
        <p className="dim">Solo para corregir un error de arranque. Los saldos de hoy = inicial + movimientos.</p>
        {CUENTAS.map((k) => <div key={k}><label>{NOMBRE_CUENTA[k]}</label><Monto valor={d.config.inicialCuentas[k]} onChange={(n) => db.config.update(1, { inicialCuentas: { ...d.config.inicialCuentas, [k]: n } })} /></div>)}
        {BOLSILLOS.map((k) => <div key={k}><label>{NOMBRE_BOLSILLO[k]}</label><Monto valor={d.config.inicialBolsillos[k]} onChange={(n) => db.config.update(1, { inicialBolsillos: { ...d.config.inicialBolsillos, [k]: n } })} /></div>)}
      </div>

      <Respaldo />

      <div className="card">
        <h2>Versión de la app</h2>
        <p className="dim">Versión: {__BUILD__}</p>
        <p className="dim">Si algo nuevo no aparece, toca el botón. Baja la última versión sin borrar tus datos.</p>
        <button className="full sec" onClick={actualizarApp}>Forzar actualización</button>
      </div>

      <div className="card">
        <h2>Borrar todo</h2>
        <button className="bad full" onClick={async () => { if (confirmar('¿Borrar TODOS los datos de esta app en este celular? No se puede deshacer.')) { await db.delete(); location.reload() } }}>Borrar todos mis datos</button>
      </div>
    </>
  )
}
