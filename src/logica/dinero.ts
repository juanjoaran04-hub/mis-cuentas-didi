// Lógica de dinero PURA: sin base de datos ni interfaz. Todo en pesos enteros (COP).

export type Bolsillo = 'metas' | 'moto' | 'personal' | 'imprevistos'
export type Cuenta = 'nequi' | 'efectivo' | 'didi'
export const BOLSILLOS: Bolsillo[] = ['metas', 'moto', 'personal', 'imprevistos']
export const CUENTAS: Cuenta[] = ['nequi', 'efectivo', 'didi']
export const NOMBRE_BOLSILLO: Record<Bolsillo, string> = { metas: 'Metas', moto: 'Moto', personal: 'Personal', imprevistos: 'Imprevistos' }
export const NOMBRE_CUENTA: Record<Cuenta, string> = { nequi: 'Nequi', efectivo: 'Efectivo', didi: 'Pendiente DiDi' }

export type Origen = 'operativo' | Bolsillo
export interface Gasto { categoriaId: number; monto: number; origen: Origen; cuenta?: 'efectivo' | 'nequi' } // cuenta ausente = efectivo (días viejos)
export interface Reparto { porcentajes: Record<Bolsillo, number>; topeImprevistos: number }
export interface Mov { fecha: string; tipo: string; cuenta?: Cuenta; bolsillo?: Bolsillo; monto: number; nota?: string; ref?: string }

export const formatCOP = (n: number) => (n < 0 ? '-' : '') + '$' + Math.abs(Math.round(n)).toLocaleString('es-CO')
/** Convierte lo que escribe el usuario ("1.234.567") en número entero. */
export const parseCOP = (s: string) => Number(s.replace(/\D/g, '')) || 0

export const sumaPorcentajes = (p: Record<Bolsillo, number>) => BOLSILLOS.reduce((a, b) => a + p[b], 0)

const vacio = (): Record<Bolsillo, number> => ({ metas: 0, moto: 0, personal: 0, imprevistos: 0 })

/**
 * Reparte lo limpio. Lo que sobra por redondeo y lo que no cabe en Imprevistos (tope) pasa a Metas.
 * Si el día dio pérdida (limpio < 0), la pérdida la cubre Imprevistos.
 */
export function repartir(limpio: number, cfg: Reparto, saldoImprevistos: number): Record<Bolsillo, number> {
  const r = vacio()
  if (limpio === 0) return r
  if (limpio < 0) { r.imprevistos = limpio; return r }
  for (const b of BOLSILLOS) r[b] = Math.floor((limpio * cfg.porcentajes[b]) / 100)
  const cabe = Math.max(0, cfg.topeImprevistos - saldoImprevistos)
  if (r.imprevistos > cabe) { r.metas += r.imprevistos - cabe; r.imprevistos = cabe }
  r.metas += limpio - BOLSILLOS.reduce((a, b) => a + r[b], 0) // centavos perdidos por redondeo
  return r
}

/** nequi = plata que entró directo a Nequi (solo lo usa el registro rápido). */
export interface DiaIn { efectivo: number; app: number; nequi?: number; gastos: Gasto[] }
export const producidoDia = (d: { efectivo: number; app: number; nequi?: number }) => d.efectivo + d.app + (d.nequi ?? 0)

/**
 * Registro rápido: solo el LIMPIO del día, repartido entre cuentas (la suma es el limpio).
 * Pendiente DiDi se guarda en `app` (es la plata que queda en la app), igual que el registro completo.
 */
export function diaRapido(fecha: string, cuentas: Partial<Record<Cuenta, number>>, viajes = 0, horas = 0) {
  return { fecha, efectivo: cuentas.efectivo ?? 0, app: cuentas.didi ?? 0, nequi: cuentas.nequi ?? 0, viajes, horas, gastos: [] as Gasto[], rapido: true as const }
}

export function resumenDia(d: DiaIn, cfg: Reparto, saldoImprevistos: number) {
  const producido = producidoDia(d)
  const total = d.gastos.reduce((a, g) => a + g.monto, 0)
  const operativos = d.gastos.filter((g) => g.origen === 'operativo').reduce((a, g) => a + g.monto, 0)
  const limpio = producido - operativos
  return { producido, totalGastos: total, operativos, limpio, reparto: repartir(limpio, cfg, saldoImprevistos) }
}

/** Movimientos que genera un día. Cada gasto sale de Efectivo (por defecto) o Nequi. */
export function movimientosDia(fecha: string, d: DiaIn, cfg: Reparto, saldoImprevistos: number, ref: string): Mov[] {
  const m: Mov[] = []
  const nota = 'Día ' + fecha
  if (d.efectivo) m.push({ fecha, tipo: 'ingreso', cuenta: 'efectivo', monto: d.efectivo, nota, ref })
  if (d.app) m.push({ fecha, tipo: 'ingreso', cuenta: 'didi', monto: d.app, nota, ref })
  if (d.nequi) m.push({ fecha, tipo: 'ingreso', cuenta: 'nequi', monto: d.nequi, nota, ref })
  for (const g of d.gastos) {
    if (!g.monto) continue
    m.push({ fecha, tipo: 'gasto', cuenta: g.cuenta ?? 'efectivo', monto: -g.monto, nota, ref })
    if (g.origen !== 'operativo') m.push({ fecha, tipo: 'gasto', bolsillo: g.origen, monto: -g.monto, nota, ref })
  }
  const { reparto } = resumenDia(d, cfg, saldoImprevistos)
  for (const b of BOLSILLOS) if (reparto[b]) m.push({ fecha, tipo: 'reparto', bolsillo: b, monto: reparto[b], nota, ref })
  return m
}

export function movimientosExtra(fecha: string, monto: number, cuenta: Cuenta, destino: Bolsillo, nota: string, ref: string): Mov[] {
  return [
    { fecha, tipo: 'extra', cuenta, monto, nota, ref },
    { fecha, tipo: 'extra', bolsillo: destino, monto, nota, ref },
  ]
}

export function movimientosTraslado(fecha: string, de: Bolsillo, a: Bolsillo, monto: number, nota: string): Mov[] {
  return [
    { fecha, tipo: 'traslado', bolsillo: de, monto: -monto, nota },
    { fecha, tipo: 'traslado', bolsillo: a, monto, nota },
  ]
}

/** Gasto fuera del turno (comida en la U, una salida): sale de una cuenta y de un bolsillo (Personal por defecto). No es gasto operativo. */
export function movimientosGastoSuelto(fecha: string, monto: number, cuenta: 'efectivo' | 'nequi', bolsillo: Bolsillo, nota: string, ref: string): Mov[] {
  return [
    { fecha, tipo: 'gasto-suelto', cuenta, monto: -monto, nota, ref },
    { fecha, tipo: 'gasto-suelto', bolsillo, monto: -monto, nota, ref },
  ]
}

/** Ajusta una cuenta al saldo real que cuentas. La diferencia se carga/abona a un bolsillo para que todo siga cuadrando. */
export function movimientosAjuste(fecha: string, cuenta: Cuenta, saldoActual: number, saldoReal: number, bolsillo: Bolsillo, nota: string): Mov[] {
  const dif = saldoReal - saldoActual
  if (dif === 0) return []
  const n = nota || `Ajuste ${NOMBRE_CUENTA[cuenta]}`
  return [
    { fecha, tipo: 'ajuste', cuenta, monto: dif, nota: n },
    { fecha, tipo: 'ajuste', bolsillo, monto: dif, nota: n },
  ]
}

/**
 * Cambiar la base de vuelto (la caja de cambio). Subirla saca esa plata de un bolsillo; bajarla la devuelve.
 * Así cuentas = bolsillos + base sigue cuadrando.
 */
export function movimientosBase(fecha: string, baseActual: number, baseNueva: number, bolsillo: Bolsillo): Mov[] {
  const dif = baseNueva - baseActual
  if (dif === 0) return []
  return [{ fecha, tipo: 'base', bolsillo, monto: -dif, nota: dif > 0 ? 'Base de vuelto: la separo' : 'Base de vuelto: la devuelvo' }]
}

/** Mover plata entre cuentas reales (ej. consigné de Efectivo a Nequi). No toca los bolsillos. */
export function movimientosEntreCuentas(fecha: string, de: Cuenta, a: Cuenta, monto: number, nota: string): Mov[] {
  const n = nota || `${NOMBRE_CUENTA[de]} → ${NOMBRE_CUENTA[a]}`
  return [
    { fecha, tipo: 'entre-cuentas', cuenta: de, monto: -monto, nota: n },
    { fecha, tipo: 'entre-cuentas', cuenta: a, monto, nota: n },
  ]
}

export function movimientosRetiro(fecha: string, monto: number): Mov[] {
  return [
    { fecha, tipo: 'retiro', cuenta: 'didi', monto: -monto, nota: 'Retiro DiDi' },
    { fecha, tipo: 'retiro', cuenta: 'nequi', monto, nota: 'Retiro DiDi' },
  ]
}

export function saldos(movs: Mov[], inicialCuentas: Record<Cuenta, number>, inicialBolsillos: Record<Bolsillo, number>) {
  const cuentas = { ...inicialCuentas }
  const bolsillos = { ...inicialBolsillos }
  for (const m of movs) {
    if (m.cuenta) cuentas[m.cuenta] += m.monto
    if (m.bolsillo) bolsillos[m.bolsillo] += m.monto
  }
  return { cuentas, bolsillos }
}

const suma = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0)

/** diferencia = cuentas - (bolsillos + caja de cambio). 0 = todo cuadra. */
export function cuadre(cuentas: Record<Cuenta, number>, bolsillos: Record<Bolsillo, number>, caja: number) {
  const diferencia = suma(cuentas) - (suma(bolsillos) + caja)
  return { totalCuentas: suma(cuentas), totalBolsillos: suma(bolsillos), diferencia, cuadra: diferencia === 0 }
}

/* ---------- Resúmenes ---------- */
export interface DiaStat { fecha: string; efectivo: number; app: number; nequi?: number; viajes: number; horas: number; gastos: Gasto[]; rapido?: boolean }

export function statsPeriodo(dias: DiaStat[]) {
  const producido = dias.reduce((a, d) => a + producidoDia(d), 0)
  const gastos = dias.reduce((a, d) => a + d.gastos.reduce((s, g) => s + g.monto, 0), 0)
  // Los días rápidos ya vienen sin gastos operativos: no cuentan para este %, si no saldría un 0% falso.
  const completos = dias.filter((d) => !d.rapido)
  const producidoCompleto = completos.reduce((a, d) => a + producidoDia(d), 0)
  const operativos = completos.reduce((a, d) => a + d.gastos.filter((g) => g.origen === 'operativo').reduce((s, g) => s + g.monto, 0), 0)
  const horas = dias.reduce((a, d) => a + d.horas, 0)
  const viajes = dias.reduce((a, d) => a + d.viajes, 0)
  const neto = producido - gastos
  return {
    dias: dias.length, rapidos: dias.length - completos.length, producido, gastos, neto, horas, viajes,
    porHora: horas > 0 ? neto / horas : null,
    porViaje: viajes > 0 ? neto / viajes : null,
    pctOperativo: producidoCompleto > 0 ? (operativos / producidoCompleto) * 100 : null,
  }
}

/** Cambio porcentual vs el periodo anterior; null si el anterior es 0. */
export const variacion = (actual: number, anterior: number) => (anterior === 0 ? null : ((actual - anterior) / Math.abs(anterior)) * 100)

export const sumarDias = (iso: string, n: number) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

/** Producido por día de los últimos n días (incluye días sin trabajo en 0). */
export function producidoPorDia(dias: DiaStat[], hoy: string, n: number) {
  return Array.from({ length: n }, (_, i) => {
    const f = sumarDias(hoy, i - (n - 1))
    const d = dias.find((x) => x.fecha === f)
    return { fecha: f, producido: d ? producidoDia(d) : 0 }
  })
}

/* ---------- Metas ---------- */
export interface Meta { id?: number; nombre: string; monto: number; prioridad: number; fechaDeseada?: string; lograda?: boolean }

/** Llena las metas en orden de prioridad (1 = primero) con el saldo del bolsillo Metas. */
export function asignarMetas(saldoMetas: number, metas: Meta[]) {
  let resto = Math.max(0, saldoMetas)
  return [...metas].filter((m) => !m.lograda).sort((a, b) => a.prioridad - b.prioridad).map((m) => {
    const acumulado = Math.min(m.monto, resto)
    resto -= acumulado
    return { meta: m, acumulado, falta: m.monto - acumulado }
  })
}

const addDias = (iso: string, n: number) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
export const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

/** Lo que entró al bolsillo Metas en las últimas 4 semanas (28 días) dividido entre 4. Gastos de meta no cuentan. */
export function ahorroSemanalMetas(movs: Mov[], hoy: string) {
  const desde = addDias(hoy, -27)
  const total = movs.filter((m) => m.bolsillo === 'metas' && (m.tipo === 'reparto' || m.tipo === 'extra') && m.monto > 0 && m.fecha >= desde && m.fecha <= hoy).reduce((a, m) => a + m.monto, 0)
  return total / 4
}

export function proyeccion(falta: number, ahorroSemanal: number, hoy: string) {
  if (falta <= 0) return { semanas: 0, fecha: hoy }
  if (ahorroSemanal <= 0) return { semanas: null, fecha: null }
  const semanas = falta / ahorroSemanal
  return { semanas, fecha: addDias(hoy, Math.ceil(semanas * 7)) }
}

/** Días de trabajo que equivale lo que falta, según lo que aporta a Metas un día trabajado. */
export function diasDeTrabajo(falta: number, metasPorDiaTrabajado: number) {
  return metasPorDiaTrabajado > 0 ? Math.ceil(falta / metasPorDiaTrabajado) : null
}

export function metasPorDiaTrabajado(movs: Mov[], hoy: string) {
  const desde = addDias(hoy, -27)
  const dias = new Set<string>()
  let total = 0
  for (const m of movs) if (m.bolsillo === 'metas' && m.tipo === 'reparto' && m.monto > 0 && m.fecha >= desde && m.fecha <= hoy) { total += m.monto; dias.add(m.fecha) }
  return dias.size ? total / dias.size : 0
}

/* ---------- Moto ---------- */
export type TipoMant = 'aceite' | 'cadena' | 'arrastre' | 'otro'
export interface Mant { id?: number; tipo: TipoMant; fecha: string; km: number; costo: number; nota?: string }
export interface CfgMoto { aceiteCada: number; cadenaCada: number; arrastreMin: number; arrastreMax: number }
export const CFG_MOTO: CfgMoto = { aceiteCada: 3000, cadenaCada: 700, arrastreMin: 10000, arrastreMax: 25000 }
export type Estado = 'ok' | 'pronto' | 'vencido' | 'sinregistro'

export function recordatorios(kmActual: number, cfg: CfgMoto, mants: Mant[]) {
  const ultimo = (t: TipoMant) => mants.filter((m) => m.tipo === t).reduce<number | null>((a, m) => (a === null || m.km > a ? m.km : a), null)
  const fila = (nombre: string, tipo: TipoMant, cada: number, margen: number) => {
    const u = ultimo(tipo)
    if (u === null) return { nombre, ultimoKm: null, proximoKm: null, faltan: null, estado: 'sinregistro' as Estado }
    const proximoKm = u + cada
    const faltan = proximoKm - kmActual
    return { nombre, ultimoKm: u, proximoKm, faltan, estado: (faltan <= 0 ? 'vencido' : faltan <= margen ? 'pronto' : 'ok') as Estado }
  }
  const arr = ultimo('arrastre')
  const arrastre = arr === null ? { nombre: 'Kit de arrastre', ultimoKm: null, proximoKm: null, faltan: null, estado: 'sinregistro' as Estado }
    : (() => { const desde = arr + cfg.arrastreMin, hasta = arr + cfg.arrastreMax
      return { nombre: 'Kit de arrastre', ultimoKm: arr, proximoKm: desde, faltan: desde - kmActual, estado: (kmActual >= hasta ? 'vencido' : kmActual >= desde ? 'pronto' : 'ok') as Estado } })()
  return [fila('Cambio de aceite', 'aceite', cfg.aceiteCada, Math.round(cfg.aceiteCada * 0.1)), fila('Lubricar cadena', 'cadena', cfg.cadenaCada, Math.round(cfg.cadenaCada * 0.15)), arrastre]
}
