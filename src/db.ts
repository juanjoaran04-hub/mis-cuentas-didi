import Dexie, { type Table } from 'dexie'
import {
  CFG_MOTO, baseARestituir, cuadre, hoyISO, movimientosAjuste, movimientosDia, movimientosEntreCuentas, movimientosGastoSuelto, movimientosExtra, movimientosRetiro, movimientosTraslado, saldos,
  type Bolsillo, type CfgMoto, type Cuenta, type Gasto, type Mant, type Meta, type Mov, type Origen,
} from './logica/dinero'

export interface Config {
  id: 1
  listo: boolean // false = mostrar "Configuración inicial"
  porcentajes: Record<Bolsillo, number>
  topeImprevistos: number
  caja: number
  inicialCuentas: Record<Cuenta, number>
  inicialBolsillos: Record<Bolsillo, number>
  kmActual: number
  moto: CfgMoto
  baseModelo?: number // 2 = la base de vuelto no resta de bolsillos; ausente = versión anterior (se migra en iniciar)
}
export interface Categoria { id?: number; nombre: string; origen: Origen }
export interface Dia { fecha: string; efectivo: number; app: number; nequi?: number; viajes: number; horas: number; km?: number; gastos: Gasto[]; rapido?: boolean }
export interface Extra { id?: number; fecha: string; tipo: 'familiar' | 'bono'; monto: number; cuenta: Cuenta; destino: Bolsillo; nota: string }
export type MovDB = Mov & { id?: number }

class MiDB extends Dexie {
  config!: Table<Config, number>
  categorias!: Table<Categoria, number>
  dias!: Table<Dia, string>
  extras!: Table<Extra, number>
  movs!: Table<MovDB, number>
  metas!: Table<Meta, number>
  mants!: Table<Mant, number>
  constructor() {
    super('mis-cuentas-didi')
    this.version(1).stores({ config: 'id', categorias: '++id', dias: 'fecha', extras: '++id', movs: '++id,fecha,ref', metas: '++id', mants: '++id' })
    // v2: Cuentas ordena los ingresos extra por fecha y faltaba el índice (la pestaña se rompía).
    this.version(2).stores({ extras: '++id,fecha' })
  }
}
export const db = new MiDB()

export const configPorDefecto = (): Config => ({
  id: 1, listo: false,
  porcentajes: { metas: 40, moto: 20, personal: 25, imprevistos: 15 }, topeImprevistos: 100000, caja: 0,
  inicialCuentas: { nequi: 0, efectivo: 0, didi: 0 }, inicialBolsillos: { metas: 0, moto: 0, personal: 0, imprevistos: 0 },
  kmActual: 0, moto: CFG_MOTO, baseModelo: 2,
})

export const categoriasIniciales: Categoria[] = [
  { nombre: 'Gasolina', origen: 'operativo' }, { nombre: 'Comida en turno', origen: 'operativo' }, { nombre: 'Datos', origen: 'operativo' },
  { nombre: 'Lavada', origen: 'moto' }, { nombre: 'Reparación/repuesto', origen: 'moto' }, { nombre: 'Ponchada', origen: 'operativo' }, { nombre: 'Otro', origen: 'operativo' },
]

export async function iniciar() {
  if (!(await db.config.get(1))) await db.config.put(configPorDefecto())
  if ((await db.categorias.count()) === 0) await db.categorias.bulkAdd(categoriasIniciales)
  await migrarBase()
}

/** Una sola vez: la versión anterior restaba la base de Personal; si es exactamente eso lo que falta, se repone. */
async function migrarBase() {
  const cfg = (await db.config.get(1))!
  if (cfg.baseModelo === 2) return
  const { cuentas, bolsillos } = saldos(await db.movs.toArray(), cfg.inicialCuentas, cfg.inicialBolsillos)
  const reponer = baseARestituir(cuadre(cuentas, bolsillos, 0).diferencia, cfg.caja)
  if (reponer) await db.movs.add({ fecha: hoyISO(), tipo: 'base', bolsillo: 'personal', monto: reponer, nota: 'Base de vuelto: ya no se resta de tus bolsillos' })
  await db.config.update(1, { baseModelo: 2 })
}

/** Saldo actual del bolsillo Imprevistos sin contar los movimientos de `ignorarRef` (para re-guardar un día). */
async function saldoImprevistos(cfg: Config, ignorarRef?: string) {
  const movs = (await db.movs.toArray()).filter((m) => !ignorarRef || m.ref !== ignorarRef)
  return saldos(movs, cfg.inicialCuentas, cfg.inicialBolsillos).bolsillos.imprevistos
}

// shortcut: al editar un día viejo no se recalculan los días posteriores (el tope de Imprevistos puede variar un poco), reparar solo si molesta.
export async function guardarDia(d: Dia) {
  const cfg = (await db.config.get(1))!
  const ref = 'dia:' + d.fecha
  const saldo = await saldoImprevistos(cfg, ref)
  await db.transaction('rw', db.dias, db.movs, db.config, async () => {
    const antes = await db.dias.get(d.fecha)
    await db.movs.where('ref').equals(ref).delete()
    await db.dias.put(d)
    await db.movs.bulkAdd(movimientosDia(d.fecha, d, cfg, saldo, ref))
    await db.config.update(1, { kmActual: cfg.kmActual + (d.km ?? 0) - (antes?.km ?? 0) }) // los km del día suman al odómetro
  })
}
export async function borrarDia(fecha: string) {
  await db.transaction('rw', db.dias, db.movs, db.config, async () => {
    const antes = await db.dias.get(fecha)
    const cfg = (await db.config.get(1))!
    await db.movs.where('ref').equals('dia:' + fecha).delete()
    await db.dias.delete(fecha)
    if (antes?.km) await db.config.update(1, { kmActual: cfg.kmActual - antes.km })
  })
}

export async function guardarExtra(e: Extra) {
  const id = await db.extras.add(e)
  await db.movs.bulkAdd(movimientosExtra(e.fecha, e.monto, e.cuenta, e.destino, `${e.tipo === 'bono' ? 'Bono DiDi' : 'Aporte familiar'} ${e.nota}`.trim(), 'extra:' + id))
}
export async function borrarExtra(id: number) {
  await db.transaction('rw', db.extras, db.movs, async () => { await db.movs.where('ref').equals('extra:' + id).delete(); await db.extras.delete(id) })
}

/* ---------- Respaldo ---------- */
const CLAVE_RESPALDO = 'ultimoRespaldo'
export const ultimoRespaldo = () => { try { return localStorage.getItem(CLAVE_RESPALDO) } catch { return null } }
const marcarRespaldo = () => { try { localStorage.setItem(CLAVE_RESPALDO, new Date().toISOString()) } catch { /* sin almacenamiento: no pasa nada */ } }

export async function exportarTodo(): Promise<string> {
  const tablas: Record<string, unknown[]> = {}
  for (const t of db.tables) tablas[t.name] = await t.toArray()
  marcarRespaldo()
  return JSON.stringify({ app: 'mis-cuentas-didi', version: 1, fecha: new Date().toISOString(), tablas }, null, 1)
}

/** Reemplaza TODOS los datos. Valida el archivo antes de tocar nada. */
export async function importarTodo(texto: string) {
  let o: { app?: string; tablas?: Record<string, unknown[]> }
  try { o = JSON.parse(texto) } catch { throw new Error('El archivo no es un respaldo válido.') }
  if (o.app !== 'mis-cuentas-didi' || !o.tablas) throw new Error('Este archivo no es un respaldo de Mis Cuentas DiDi.')
  const nombres = db.tables.map((t) => t.name)
  if (!nombres.every((n) => Array.isArray(o.tablas![n]))) throw new Error('Al respaldo le faltan datos.')
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) { await t.clear(); await t.bulkPut(o.tablas![t.name]) }
  })
  marcarRespaldo()
}

export const trasladar = (fecha: string, de: Bolsillo, a: Bolsillo, monto: number, nota: string) => db.movs.bulkAdd(movimientosTraslado(fecha, de, a, monto, nota))
export const guardarGastoSuelto = (fecha: string, monto: number, cuenta: 'efectivo' | 'nequi', bolsillo: Bolsillo, nota: string) =>
  db.movs.bulkAdd(movimientosGastoSuelto(fecha, monto, cuenta, bolsillo, nota, 'gasto:' + Date.now()))
export const borrarPorRef = (ref: string) => db.movs.where('ref').equals(ref).delete()

export const ajustarCuenta = (fecha: string, cuenta: Cuenta, saldoActual: number, saldoReal: number, bolsillo: Bolsillo, nota: string) =>
  db.movs.bulkAdd(movimientosAjuste(fecha, cuenta, saldoActual, saldoReal, bolsillo, nota))

/** La base de vuelto solo es un número informativo: no mueve plata de ningún bolsillo. */
export const guardarBase = (base: number) => db.config.update(1, { caja: base })

export const moverEntreCuentas = (fecha: string, de: Cuenta, a: Cuenta, monto: number, nota: string) => db.movs.bulkAdd(movimientosEntreCuentas(fecha, de, a, monto, nota))
export const retirarDidi = (fecha: string, monto: number) => db.movs.bulkAdd(movimientosRetiro(fecha, monto))

/** Gasto de mantenimiento: se guarda en el historial y, si se quiere, sale del bolsillo Moto (y del Efectivo). */
export async function guardarMant(m: Mant, descontar: boolean) {
  const id = await db.mants.add(m)
  if (descontar && m.costo > 0) {
    const nota = `Mantenimiento ${m.tipo}`
    await db.movs.bulkAdd([
      { fecha: m.fecha, tipo: 'gasto', cuenta: 'efectivo', monto: -m.costo, nota, ref: 'mant:' + id },
      { fecha: m.fecha, tipo: 'gasto', bolsillo: 'moto', monto: -m.costo, nota, ref: 'mant:' + id },
    ])
  }
}
export async function borrarMant(id: number) {
  await db.transaction('rw', db.mants, db.movs, async () => { await db.movs.where('ref').equals('mant:' + id).delete(); await db.mants.delete(id) })
}

/** Compra de una meta: sale del bolsillo Metas y del Efectivo/Nequi elegido. */
export async function comprarMeta(m: Meta, cuenta: Cuenta, fecha: string) {
  const ref = 'meta:' + m.id
  await db.transaction('rw', db.metas, db.movs, async () => {
    await db.movs.bulkAdd([
      { fecha, tipo: 'compra', cuenta, monto: -m.monto, nota: 'Compra: ' + m.nombre, ref },
      { fecha, tipo: 'compra', bolsillo: 'metas', monto: -m.monto, nota: 'Compra: ' + m.nombre, ref },
    ])
    await db.metas.update(m.id!, { lograda: true })
  })
}
