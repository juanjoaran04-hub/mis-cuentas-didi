// Solo presentación: íconos y colores por bolsillo. No contiene lógica de dinero.
import { Bike, ShieldCheck, Tablet, User } from 'lucide-react'
import { formatCOP, type Bolsillo } from './logica/dinero'

export const ICONO_BOLSILLO: Record<Bolsillo, typeof Tablet> = { metas: Tablet, moto: Bike, personal: User, imprevistos: ShieldCheck }

/** Tarjeta de un bolsillo: ícono y color propios, monto grande (verde si es positivo, rojo si es negativo). */
export function TarjetaBolsillo({ b, nombre, monto, nota }: { b: Bolsillo; nombre: string; monto: number; nota?: string }) {
  const Icono = ICONO_BOLSILLO[b]
  return (
    <div className="bols">
      <div className="ico" style={{ background: `var(--bg-${b})`, color: `var(--c-${b})` }}><Icono size={22} aria-hidden /></div>
      <div className="nom">{nombre}</div>
      <div className={'monto ' + (monto < 0 ? 'neg' : 'pos')}>{formatCOP(monto)}</div>
      {nota && <div className="dim">{nota}</div>}
    </div>
  )
}

/** Monto con color: verde positivo, rojo negativo. `gasto` fuerza rojo (los gastos se guardan como números positivos). */
export function Cop({ n, gasto }: { n: number; gasto?: boolean }) {
  return <span className={gasto ? (n > 0 ? 'neg' : '') : n < 0 ? 'neg' : n > 0 ? 'pos' : ''}>{formatCOP(n)}</span>
}
