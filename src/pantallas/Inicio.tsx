import { useLiveQuery } from 'dexie-react-hooks'
import { CircleAlert, CircleCheck, HardDriveDownload, PenLine, Wrench, Zap } from 'lucide-react'
import { db, ultimoRespaldo } from '../db'
import { BOLSILLOS, CUENTAS, NOMBRE_BOLSILLO, NOMBRE_CUENTA, cuadre, formatCOP, hoyISO, producidoPorDia, statsPeriodo, sumarDias, variacion } from '../logica/dinero'
import { Cop, TarjetaBolsillo } from '../tema'
import { Barra, type Datos } from '../ui'
import { useMetas } from './Metas'
import { useRecordatorios } from './Moto'

const flecha = (v: number | null, buenoSiSube = true) =>
  v === null ? <span className="dim">—</span> : <span className={(v >= 0) === buenoSiSube ? 'pos' : 'neg'}>{v >= 0 ? '▲' : '▼'} {Math.abs(Math.round(v))}%</span>

function Grafica({ datos }: { datos: { fecha: string; producido: number }[] }) {
  const max = Math.max(1, ...datos.map((d) => d.producido))
  const w = 300 / datos.length
  return (
    <svg viewBox="0 0 300 112" width="100%" role="img" aria-label="Producido por día">
      {datos.map((d, i) => { const h = (d.producido / max) * 80; return (
        <g key={d.fecha}>
          <rect x={i * w + 2} y={90 - h} width={w - 4} height={Math.max(h, 2)} rx="3" fill={d.producido ? 'var(--acc)' : 'var(--line)'} />
          <text x={i * w + w / 2} y="105" fontSize="9" textAnchor="middle" fill="var(--dim)">{d.fecha.slice(8)}</text>
        </g>) })}
      <text x="0" y="9" fontSize="9" fill="var(--dim)">máx {formatCOP(max)}</text>
    </svg>
  )
}

function Periodo({ titulo, a, b }: { titulo: string; a: ReturnType<typeof statsPeriodo>; b: ReturnType<typeof statsPeriodo> }) {
  const cop = (n: number | null) => (n === null ? '—' : <Cop n={n} />)
  return (
    <div className="card">
      <h2>{titulo}</h2>
      <div className="dim" style={{ marginTop: -4, marginBottom: 8 }}>{a.dias} días{a.rapidos > 0 && ` (${a.rapidos} rápido${a.rapidos > 1 ? 's' : ''})`} · {a.horas} h · {a.viajes} viajes</div>
      <div className="item"><span>Producido</span><span><b className={a.producido > 0 ? 'pos' : ''}>{formatCOP(a.producido)}</b> {flecha(variacion(a.producido, b.producido))}</span></div>
      <div className="item"><span>Gastos</span><span><b><Cop n={a.gastos} gasto /></b> {flecha(variacion(a.gastos, b.gastos), false)}</span></div>
      <div className="item"><span>Neto</span><span><b><Cop n={a.neto} /></b> {flecha(variacion(a.neto, b.neto))}</span></div>
      <div className="item"><span>Ganancia por hora</span><b>{cop(a.porHora && Math.round(a.porHora))}</b></div>
      <div className="item"><span>Ganancia por viaje</span><b>{cop(a.porViaje && Math.round(a.porViaje))}</b></div>
      <div className="item"><span>Gasto operativo</span><b>{a.pctOperativo === null ? '—' : a.pctOperativo.toFixed(1) + '%'}</b></div>
      <div className="dim" style={{ marginTop: 8 }}>Flechas: contra el periodo anterior equivalente.{a.rapidos > 0 && ' El % operativo no cuenta los días rápidos (no traen gastos).'}</div>
    </div>
  )
}

export default function Inicio({ d, ir }: { d: Datos; ir: (t: 'registrar' | 'rapido' | 'ajustes') => void }) {
  const { filas } = useMetas(d)
  const { rec } = useRecordatorios(d)
  const dias = useLiveQuery(() => db.dias.toArray(), [], [])
  const hoy = hoyISO()
  const rango = (desde: string, hasta: string) => statsPeriodo(dias.filter((x) => x.fecha >= desde && x.fecha <= hasta))
  const sem = rango(sumarDias(hoy, -6), hoy), semAnt = rango(sumarDias(hoy, -13), sumarDias(hoy, -7))
  const mesIni = hoy.slice(0, 8) + '01'
  const mesAntFin = sumarDias(mesIni, -1)
  const mes = rango(mesIni, hoy), mesAnt = rango(mesAntFin.slice(0, 8) + '01', mesAntFin)
  const cu = cuadre(d.cuentas, d.bolsillos, d.config.caja)
  const alertas = rec.filter((r) => r.estado === 'vencido' || r.estado === 'pronto')
  const hoyHecho = dias.some((x) => x.fecha === hoy)
  const ultimo = ultimoRespaldo()
  const diasSinRespaldo = ultimo ? Math.floor((Date.now() - new Date(ultimo).getTime()) / 86400000) : null
  const pedirRespaldo = dias.length > 0 && (diasSinRespaldo === null || diasSinRespaldo >= 7)

  return (
    <>
      <h1>Mis Cuentas</h1>
      <button className="full hero" style={{ marginTop: 0 }} onClick={() => ir('registrar')}><PenLine size={24} aria-hidden />{hoyHecho ? 'Editar el día de hoy' : 'Registrar día'}</button>
      <button className="full hero sec" style={{ marginTop: 0 }} onClick={() => ir('rapido')}><Zap size={24} aria-hidden />Registro rápido</button>
      {pedirRespaldo && <div className="alert warn"><HardDriveDownload size={20} aria-hidden /><span>{diasSinRespaldo === null ? 'Nunca has hecho un respaldo.' : `Hace ${diasSinRespaldo} días no haces respaldo.`} <button className="sm" onClick={() => ir('ajustes')}>Hacer respaldo</button></span></div>}
      {!cu.cuadra && <div className="alert bad"><CircleAlert size={20} aria-hidden /><span>Cuentas y bolsillos no cuadran: {formatCOP(cu.diferencia)}. Mira la pestaña Cuentas.</span></div>}
      {alertas.map((r) => <div key={r.nombre} className={'alert ' + (r.estado === 'vencido' ? 'bad' : 'warn')}><Wrench size={20} aria-hidden />{r.nombre}: {r.estado === 'vencido' ? 'ya toca' : 'pronto'}</div>)}

      <div className="bolsillos">
        {BOLSILLOS.map((b) => <TarjetaBolsillo key={b} b={b} nombre={NOMBRE_BOLSILLO[b]} monto={d.bolsillos[b]} nota={b === 'imprevistos' ? 'tope ' + formatCOP(d.config.topeImprevistos) : undefined} />)}
      </div>

      {filas.map(({ meta, acumulado, falta, proy }) => {
        const pct = Math.min(100, Math.floor((acumulado / meta.monto) * 100))
        return (
          <div className="card" key={meta.id}>
            <div className="meta-top"><h2 style={{ margin: 0 }}>{meta.nombre}</h2><span className="pct">{pct}%</span></div>
            <Barra pct={(acumulado / meta.monto) * 100} />
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="dim">{falta === 0 ? <b className="pos"><CircleCheck size={16} style={{ verticalAlign: -3 }} aria-hidden /> ¡Ya alcanza!</b> : <>Faltan <b className="neg">{formatCOP(falta)}</b></>}</span>
              <span className="dim" style={{ textAlign: 'right' }}>{falta === 0 ? '' : proy.fecha ? 'Llegas el ' + proy.fecha : 'Sin fecha estimada'}</span>
            </div>
          </div>
        )
      })}

      <div className="card">
        <h2>Cuentas</h2>
        {CUENTAS.map((k) => <div className="item" key={k}><span>{NOMBRE_CUENTA[k]}</span><b><Cop n={d.cuentas[k]} /></b></div>)}
        <div className="item dim"><span>Caja de cambio (aparte)</span><span>{formatCOP(d.config.caja)}</span></div>
      </div>

      <div className="card"><h2>Producido, últimos 14 días</h2><Grafica datos={producidoPorDia(dias, hoy, 14)} /></div>
      <Periodo titulo="Últimos 7 días" a={sem} b={semAnt} />
      <Periodo titulo="Este mes" a={mes} b={mesAnt} />
    </>
  )
}
