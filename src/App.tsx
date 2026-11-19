import { useEffect, useState } from 'react'
import { Bike, House, PenLine, Settings, Target, Wallet } from 'lucide-react'
import { iniciar } from './db'
import { useDatos } from './ui'
import Setup from './pantallas/Setup'
import Inicio from './pantallas/Inicio'
import Registrar from './pantallas/Registrar'
import RegistroRapido from './pantallas/RegistroRapido'
import Gasto from './pantallas/Gasto'
import Cuentas from './pantallas/Cuentas'
import Metas from './pantallas/Metas'
import Moto from './pantallas/Moto'
import Ajustes from './pantallas/Ajustes'

const TABS = [['inicio', House, 'Inicio'], ['registrar', PenLine, 'Registrar'], ['cuentas', Wallet, 'Cuentas'], ['metas', Target, 'Metas'], ['moto', Bike, 'Moto'], ['ajustes', Settings, 'Ajustes']] as const
type Tab = (typeof TABS)[number][0] | 'rapido' | 'gasto' // 'rapido' no tiene botón abajo: se abre desde Inicio

export default function App() {
  const [listo, setListo] = useState(false)
  const [tab, setTab] = useState<Tab>('inicio')
  const datos = useDatos()
  useEffect(() => { iniciar().then(() => setListo(true)) }, [])

  if (!listo || !datos) return <main>Cargando…</main>
  if (!datos.config.listo) return <main><Setup config={datos.config} /></main>

  return (
    <>
      <main>
        {tab === 'inicio' && <Inicio d={datos} ir={setTab} />}
        {tab === 'registrar' && <Registrar d={datos} />}
        {tab === 'rapido' && <RegistroRapido d={datos} volver={() => setTab('inicio')} />}
        {tab === 'gasto' && <Gasto d={datos} volver={() => setTab('inicio')} />}
        {tab === 'cuentas' && <Cuentas d={datos} />}
        {tab === 'metas' && <Metas d={datos} />}
        {tab === 'moto' && <Moto d={datos} />}
        {tab === 'ajustes' && <Ajustes d={datos} />}
      </main>
      <nav>{TABS.map(([k, Ico, nom]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}><Ico size={24} aria-hidden />{nom}</button>)}</nav>
    </>
  )
}
