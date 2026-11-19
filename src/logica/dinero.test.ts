import { describe, expect, it } from 'vitest'
import {
  asignarMetas, ahorroSemanalMetas, BOLSILLOS, cuadre, diasDeTrabajo, movimientosDia, movimientosExtra, movimientosRetiro,
  movimientosTraslado, parseCOP, proyeccion, recordatorios, repartir, resumenDia, saldos, CFG_MOTO, type Reparto,
  statsPeriodo, variacion, producidoPorDia, diaRapido, movimientosEntreCuentas, movimientosGastoSuelto, movimientosAjuste, baseARestituir,
} from './dinero'

const cfg: Reparto = { porcentajes: { metas: 40, moto: 20, personal: 25, imprevistos: 15 }, topeImprevistos: 100000 }
const suma = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0)
const cero = { nequi: 0, efectivo: 0, didi: 0 }
const ceroB = { metas: 0, moto: 0, personal: 0, imprevistos: 0 }

describe('repartir', () => {
  it('reparte por porcentajes', () => {
    expect(repartir(100000, cfg, 0)).toEqual({ metas: 40000, moto: 20000, personal: 25000, imprevistos: 15000 })
  })
  it('el redondeo va a Metas y la suma siempre es exacta', () => {
    const r = repartir(33333, cfg, 0)
    expect(suma(r)).toBe(33333)
  })
  it('imprevistos lleno: su parte pasa a Metas', () => {
    const r = repartir(100000, cfg, 100000)
    expect(r.imprevistos).toBe(0)
    expect(r.metas).toBe(55000)
  })
  it('imprevistos casi lleno: solo entra lo que cabe', () => {
    const r = repartir(100000, cfg, 95000)
    expect(r.imprevistos).toBe(5000)
    expect(suma(r)).toBe(100000)
  })
  it('día en pérdida lo cubre Imprevistos', () => {
    expect(repartir(-20000, cfg, 50000)).toEqual({ ...ceroB, imprevistos: -20000 })
  })
})

describe('resumenDia y movimientos', () => {
  const dia = { efectivo: 60000, app: 90000, gastos: [
    { categoriaId: 1, monto: 30000, origen: 'operativo' as const },
    { categoriaId: 5, monto: 10000, origen: 'moto' as const },
  ] }
  it('gastos operativos se restan primero; los de bolsillo no', () => {
    const r = resumenDia(dia, cfg, 0)
    expect(r.producido).toBe(150000)
    expect(r.limpio).toBe(120000)
    expect(suma(r.reparto)).toBe(120000)
  })
  it('cuentas totales == bolsillos totales después de un día (cuadra)', () => {
    const { cuentas, bolsillos } = saldos(movimientosDia('2026-01-01', dia, cfg, 0, 'd'), cero, ceroB)
    expect(cuadre(cuentas, bolsillos, 0).cuadra).toBe(true)
    expect(bolsillos.moto).toBe(24000 - 10000) // 20% de 120000 menos el gasto del bolsillo
  })
  it('gasto sale de la cuenta elegida (Nequi) y efectivo por defecto', () => {
    const d = { efectivo: 0, app: 0, gastos: [
      { categoriaId: 1, monto: 5000, origen: 'operativo' as const, cuenta: 'nequi' as const },
      { categoriaId: 1, monto: 2000, origen: 'operativo' as const },
    ] }
    const { cuentas, bolsillos } = saldos(movimientosDia('2026-01-01', d, cfg, 0, 'd'), { nequi: 10000, efectivo: 10000, didi: 0 }, { ...ceroB, personal: 20000 })
    expect(cuentas.nequi).toBe(5000); expect(cuentas.efectivo).toBe(8000)
    expect(cuadre(cuentas, bolsillos, 0).cuadra).toBe(true) // la pérdida del día la cubre Imprevistos
  })
  it('día en pérdida también cuadra', () => {
    const d = { efectivo: 10000, app: 0, gastos: [{ categoriaId: 1, monto: 30000, origen: 'operativo' as const }] }
    const { cuentas, bolsillos } = saldos(movimientosDia('2026-01-01', d, cfg, 0, 'd'), cero, ceroB)
    expect(cuadre(cuentas, bolsillos, 0).cuadra).toBe(true)
  })
})

describe('extras, traslados y retiros', () => {
  it('extra suma a cuenta y bolsillo', () => {
    const { cuentas, bolsillos } = saldos(movimientosExtra('2026-01-01', 50000, 'nequi', 'metas', 'mamá', 'e'), cero, ceroB)
    expect(cuentas.nequi).toBe(50000); expect(bolsillos.metas).toBe(50000)
    expect(cuadre(cuentas, bolsillos, 0).cuadra).toBe(true)
  })
  it('traslado mueve entre bolsillos sin tocar cuentas', () => {
    const { bolsillos, cuentas } = saldos(movimientosTraslado('2026-01-01', 'moto', 'metas', 5000, 'x'), cero, { ...ceroB, moto: 20000 })
    expect(bolsillos.moto).toBe(15000); expect(bolsillos.metas).toBe(5000); expect(suma(cuentas)).toBe(0)
  })
  it('retiro mueve de DiDi a Nequi', () => {
    const { cuentas } = saldos(movimientosRetiro('2026-01-01', 80000), { ...cero, didi: 100000 }, ceroB)
    expect(cuentas).toEqual({ nequi: 80000, efectivo: 0, didi: 20000 })
  })
})

describe('mover entre cuentas', () => {
  it('cambia las cuentas y NO toca los bolsillos', () => {
    const ini = { nequi: 5000, efectivo: 50000, didi: 0 }
    const inicialB = { ...ceroB, personal: 55000 }
    const { cuentas, bolsillos } = saldos(movimientosEntreCuentas('2026-01-01', 'efectivo', 'nequi', 20000, 'consigné'), ini, inicialB)
    expect(cuentas).toEqual({ nequi: 25000, efectivo: 30000, didi: 0 })
    expect(bolsillos).toEqual(inicialB)
    expect(cuadre(cuentas, bolsillos, 0).cuadra).toBe(true)
  })
  it('sin nota genera una descripción', () => {
    expect(movimientosEntreCuentas('2026-01-01', 'efectivo', 'nequi', 1, '')[0].nota).toBe('Efectivo → Nequi')
  })
})

describe('gasto suelto, ajuste y base de vuelto', () => {
  const ini = { nequi: 100000, efectivo: 80000, didi: 0 }
  const iniB = { ...ceroB, personal: 100000, metas: 80000 }
  it('gasto suelto baja la cuenta y el bolsillo, y no es operativo', () => {
    const { cuentas, bolsillos } = saldos(movimientosGastoSuelto('2026-01-01', 15000, 'efectivo', 'personal', 'almuerzo U', 'g:1'), ini, iniB)
    expect(cuentas.efectivo).toBe(65000); expect(bolsillos.personal).toBe(85000)
    expect(cuadre(cuentas, bolsillos, 0).cuadra).toBe(true)
    expect(statsPeriodo([]).gastos).toBe(0) // no entra a los resúmenes de trabajo
  })
  it('gasto suelto desde Nequi con otro bolsillo', () => {
    const { cuentas, bolsillos } = saldos(movimientosGastoSuelto('2026-01-01', 30000, 'nequi', 'metas', 'salida', 'g:2'), ini, iniB)
    expect(cuentas.nequi).toBe(70000); expect(bolsillos.metas).toBe(50000)
  })
  it('ajuste: la cuenta queda en el saldo real y el bolsillo absorbe la diferencia', () => {
    const { cuentas, bolsillos } = saldos(movimientosAjuste('2026-01-01', 'efectivo', 80000, 72000, 'personal', ''), ini, iniB)
    expect(cuentas.efectivo).toBe(72000); expect(bolsillos.personal).toBe(92000)
    expect(cuadre(cuentas, bolsillos, 0).cuadra).toBe(true)
  })
  it('ajuste hacia arriba y sin diferencia', () => {
    expect(saldos(movimientosAjuste('2026-01-01', 'nequi', 100000, 120000, 'personal', ''), ini, iniB).cuentas.nequi).toBe(120000)
    expect(movimientosAjuste('2026-01-01', 'nequi', 5, 5, 'personal', '')).toEqual([])
  })
  it('base de vuelto: no es un movimiento; cuentas y bolsillos cuadran sin tocarla (caja = 0)', () => {
    expect(cuadre(ini, iniB, 0).cuadra).toBe(true)
  })
  it('migración de la base: repone solo si lo que falta es exactamente la base', () => {
    expect(baseARestituir(50000, 50000)).toBe(50000)
    expect(baseARestituir(0, 50000)).toBe(0)
    expect(baseARestituir(30000, 50000)).toBe(0)
    expect(baseARestituir(50000, 0)).toBe(0)
  })
  it('migración: al reponer la base en Personal vuelve a cuadrar', () => {
    const { cuentas, bolsillos } = saldos([{ fecha: '2026-01-01', tipo: 'base', bolsillo: 'personal', monto: 50000 }], ini, { ...iniB, personal: 50000 })
    expect(cuadre(cuentas, bolsillos, 0).cuadra).toBe(true)
  })
})

describe('cuadre', () => {
  it('caja de cambio no cuenta como disponible', () => {
    expect(cuadre({ nequi: 0, efectivo: 50000, didi: 0 }, { ...ceroB, personal: 30000 }, 20000).cuadra).toBe(true)
  })
  it('muestra la diferencia', () => {
    expect(cuadre({ nequi: 10000, efectivo: 0, didi: 0 }, ceroB, 0).diferencia).toBe(10000)
  })
})

describe('metas', () => {
  const metas = [{ nombre: 'Moto nueva', monto: 500000, prioridad: 2 }, { nombre: 'Tablet', monto: 800000, prioridad: 1 }]
  it('llena por prioridad', () => {
    const r = asignarMetas(900000, metas)
    expect(r[0].meta.nombre).toBe('Tablet'); expect(r[0].falta).toBe(0)
    expect(r[1].acumulado).toBe(100000); expect(r[1].falta).toBe(400000)
  })
  it('promedio de 4 semanas y fecha estimada', () => {
    const movs = [{ fecha: '2026-01-20', tipo: 'reparto', bolsillo: 'metas' as const, monto: 40000 }, { fecha: '2025-11-01', tipo: 'reparto', bolsillo: 'metas' as const, monto: 99999 }]
    const sem = ahorroSemanalMetas(movs, '2026-01-28')
    expect(sem).toBe(10000)
    const p = proyeccion(30000, sem, '2026-01-28')
    expect(p.semanas).toBe(3); expect(p.fecha).toBe('2026-02-18')
  })
  it('sin ahorro no hay fecha; meta cumplida es hoy', () => {
    expect(proyeccion(1000, 0, '2026-01-01').fecha).toBeNull()
    expect(proyeccion(0, 0, '2026-01-01').fecha).toBe('2026-01-01')
  })
  it('días de trabajo', () => { expect(diasDeTrabajo(100000, 30000)).toBe(4); expect(diasDeTrabajo(1, 0)).toBeNull() })
})

describe('moto', () => {
  it('aceite: vencido, pronto, ok y sin registro', () => {
    const m = (km: number) => [{ tipo: 'aceite' as const, fecha: '2026-01-01', km, costo: 0 }]
    expect(recordatorios(13000, CFG_MOTO, m(10000))[0].estado).toBe('vencido')
    expect(recordatorios(12800, CFG_MOTO, m(10000))[0].estado).toBe('pronto')
    expect(recordatorios(10500, CFG_MOTO, m(10000))[0].estado).toBe('ok')
    expect(recordatorios(10500, CFG_MOTO, [])[0].estado).toBe('sinregistro')
  })
  it('arrastre usa ventana 10.000-25.000 km', () => {
    const m = [{ tipo: 'arrastre' as const, fecha: '2026-01-01', km: 5000, costo: 0 }]
    expect(recordatorios(10000, CFG_MOTO, m)[2].estado).toBe('ok')
    expect(recordatorios(16000, CFG_MOTO, m)[2].estado).toBe('pronto')
    expect(recordatorios(30000, CFG_MOTO, m)[2].estado).toBe('vencido')
  })
})

describe('resúmenes', () => {
  const d = (fecha: string, ef: number, viajes: number, horas: number, gastos: { monto: number; origen: 'operativo' | 'moto' }[]) =>
    ({ fecha, efectivo: ef, app: 0, viajes, horas, gastos: gastos.map((g) => ({ categoriaId: 1, ...g })) })
  it('neto, por hora, por viaje y % operativo', () => {
    const s = statsPeriodo([d('2026-01-01', 100000, 10, 5, [{ monto: 20000, origen: 'operativo' }, { monto: 10000, origen: 'moto' }])])
    expect(s.neto).toBe(70000); expect(s.porHora).toBe(14000); expect(s.porViaje).toBe(7000); expect(s.pctOperativo).toBe(20)
  })
  it('sin horas/viajes/producido no divide entre 0', () => {
    const s = statsPeriodo([])
    expect(s.porHora).toBeNull(); expect(s.porViaje).toBeNull(); expect(s.pctOperativo).toBeNull()
  })
  it('variación', () => { expect(variacion(150, 100)).toBe(50); expect(variacion(5, 0)).toBeNull(); expect(variacion(50, 100)).toBe(-50) })
  it('producido por día rellena con 0', () => {
    const r = producidoPorDia([d('2026-01-03', 5000, 1, 1, [])], '2026-01-03', 3)
    expect(r.map((x) => x.producido)).toEqual([0, 0, 5000]); expect(r[0].fecha).toBe('2026-01-01')
  })
})

describe('registro rápido', () => {
  const completo = { efectivo: 150000, app: 0, gastos: [{ categoriaId: 1, monto: 30000, origen: 'operativo' as const }] }
  it('reparte igual que un día completo con el mismo limpio', () => {
    const r = resumenDia(diaRapido('2026-01-01', { efectivo: 120000 }), cfg, 0)
    expect(r.reparto).toEqual(resumenDia(completo, cfg, 0).reparto)
    expect(r.limpio).toBe(120000)
  })
  it('repartido entre varias cuentas: cada una recibe lo suyo, el reparto usa la suma y cuadra', () => {
    const d = diaRapido('2026-01-01', { efectivo: 40000, nequi: 30000, didi: 20000 })
    const { cuentas, bolsillos } = saldos(movimientosDia('2026-01-01', d, cfg, 0, 'd'), cero, ceroB)
    expect(cuentas).toEqual({ efectivo: 40000, nequi: 30000, didi: 20000 })
    expect(suma(bolsillos)).toBe(90000)
    expect(resumenDia(d, cfg, 0).reparto).toEqual(repartir(90000, cfg, 0))
    expect(cuadre(cuentas, bolsillos, 0).cuadra).toBe(true)
  })
  it('Efectivo: entra a Efectivo; Nequi: entra a Nequi; DiDi: queda pendiente; todos cuadran', () => {
    for (const c of ['efectivo', 'nequi', 'didi'] as const) {
      const d = diaRapido('2026-01-01', { [c]: 120000 })
      const { cuentas, bolsillos } = saldos(movimientosDia('2026-01-01', d, cfg, 0, 'd'), cero, ceroB)
      expect(cuentas[c]).toBe(120000)
      expect(cuadre(cuentas, bolsillos, 0).cuadra).toBe(true)
    }
  })
  it('respeta el tope de Imprevistos', () => {
    const r = resumenDia(diaRapido('2026-01-01', { nequi: 100000 }), cfg, 100000)
    expect(r.reparto.imprevistos).toBe(0); expect(r.reparto.metas).toBe(55000)
  })
  it('queda marcado rápido y guarda viajes/horas', () => {
    const d = diaRapido('2026-01-01', { efectivo: 50000 }, 8, 6)
    expect(d.rapido).toBe(true); expect(d.viajes).toBe(8); expect(d.horas).toBe(6); expect(d.gastos).toEqual([])
  })
  it('no usa los días rápidos para el % operativo (sin falso 0%)', () => {
    const normal = { fecha: '2026-01-01', efectivo: 100000, app: 0, viajes: 10, horas: 5, gastos: [{ categoriaId: 1, monto: 20000, origen: 'operativo' as const }] }
    const s = statsPeriodo([normal, diaRapido('2026-01-02', { efectivo: 100000 }, 10, 5)])
    expect(s.pctOperativo).toBe(20); expect(s.rapidos).toBe(1); expect(s.producido).toBe(200000)
  })
  it('solo días rápidos: % operativo no disponible', () => {
    expect(statsPeriodo([diaRapido('2026-01-02', { nequi: 100000 })]).pctOperativo).toBeNull()
  })
  it('el producido por día cuenta lo que entró a Nequi', () => {
    expect(producidoPorDia([diaRapido('2026-01-02', { nequi: 7000 })],'2026-01-02', 1)[0].producido).toBe(7000)
  })
})

describe('parseCOP', () => {
  it('quita puntos y letras', () => { expect(parseCOP('1.234.567')).toBe(1234567); expect(parseCOP('')).toBe(0); expect(parseCOP('$ 50.000')).toBe(50000) })
  it('BOLSILLOS tiene 4', () => expect(BOLSILLOS.length).toBe(4))
})
