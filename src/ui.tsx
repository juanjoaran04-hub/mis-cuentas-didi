import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { parseCOP, saldos } from './logica/dinero'

/** Campo de plata: muestra 1.234.567 mientras escribes, guarda un número. */
export function Monto({ valor, onChange, ...r }: { valor: number; onChange: (n: number) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return <input inputMode="numeric" {...r} value={valor ? valor.toLocaleString('es-CO') : ''} onChange={(e) => onChange(parseCOP(e.target.value))} />
}

export function Barra({ pct }: { pct: number }) {
  return <div className="bar"><div style={{ width: Math.min(100, Math.max(0, pct)) + '%' }} /></div>
}

/** Config + movimientos + saldos calculados. undefined = todavía cargando. */
export function useDatos() {
  return useLiveQuery(async () => {
    const config = await db.config.get(1)
    if (!config) return undefined
    const movs = await db.movs.toArray()
    return { config, movs, ...saldos(movs, config.inicialCuentas, config.inicialBolsillos) }
  })
}
export type Datos = NonNullable<ReturnType<typeof useDatos>>

/** Confirmación antes de borrar. */
export const confirmar = (txt: string) => window.confirm(txt)
