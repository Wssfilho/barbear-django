import { useCallback, useEffect, useState } from 'react'
import {
  CalendarDays, ChevronDown, ChevronRight, CircleUserRound, LayoutDashboard,
  LogIn, Menu, PanelLeftClose, PanelLeftOpen, Scissors, Sparkles, Store, Ticket, UsersRound, X,
} from 'lucide-react'
import { api, profileName, readSession, roleHome, saveSession } from './api'
import { AssistantConsultation } from './Assistant'
import { Account, BarberClients, BarberPanel, BarberPlans, Dashboard, ServicesCatalog, ShopCatalog } from './Dashboard'
import { AuthDialog, BookingDialog, DetailsDialog, PlanDialog, ServiceDialog, ShopDialog, Toast } from './Dialogs'
import { initials, localDate } from './data'
import { useResource } from './useResource'

const clientLinks = [
  { id: 'visao-geral', title: 'Visão geral', icon: LayoutDashboard },
  { id: 'agenda', title: 'Agenda', icon: CalendarDays },
  { id: 'barbearias', title: 'Barbearias', icon: Store },
  { id: 'servicos', title: 'Serviços', icon: Scissors },
  { id: 'consultoria', title: 'Consultoria com IA', icon: Sparkles },
  { id: 'conta', title: 'Minha conta', icon: CircleUserRound },
]

const barberLinks = [
  { id: 'painel', title: 'Painel do barbeiro', icon: LayoutDashboard },
  { id: 'agenda', title: 'Minha agenda', icon: CalendarDays },
  { id: 'planos', title: 'Planos mensais', icon: Ticket },
  { id: 'clientes', title: 'Meus clientes', icon: UsersRound },
  { id: 'conta', title: 'Minha conta', icon: CircleUserRound },
]

const allLinkIds = new Set([...clientLinks, ...barberLinks].map((link) => link.id))
const sidebarStorageKey = 'barbear.sidebar.collapsed'

function readSidebarCollapsed() {
  try {
    return localStorage.getItem(sidebarStorageKey) === '1'
  } catch {
    return false
  }
}

function saveSidebarCollapsed(collapsed) {
  try {
    if (collapsed) localStorage.setItem(sidebarStorageKey, '1')
    else localStorage.removeItem(sidebarStorageKey)
  } catch {
    // Ignora bloqueios de localStorage
  }
}

function readPage() {
  const [id, shop] = window.location.hash.slice(1).split('/')
  return {
    id: allLinkIds.has(id) ? id : 'visao-geral',
    shopId: id === 'servicos' && /^[0-9]+$/.test(shop) ? Number(shop) : null,
  }
}

function Sidebar({ links, homeId, page, open, collapsed, onToggleCollapse, onNavigate, onClose }) {
  const toggleLabel = collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'
  return <>
    {open && <button className="sidebar-overlay" aria-label="Fechar navegação" onClick={onClose} />}
    <aside className={`sidebar ${open ? 'sidebar-open' : ''} ${collapsed ? 'sidebar-collapsed' : ''}`} id="sidebar">
      <div className="sidebar-head">
        <a
          href={`#${homeId}`}
          className="brand"
          aria-label="Barbear - Ir para o início"
          title={collapsed ? 'Barbear · Agenda e gestão' : undefined}
          onClick={(event) => { event.preventDefault(); onNavigate(homeId) }}
        >
          <span className="brand-icon"><Scissors size={21} strokeWidth={1.8} /></span>
          <span className="brand-text"><strong>Barbear<span>.</span></strong><small>AGENDA E GESTÃO</small></span>
        </a>
        <button
          type="button"
          className="icon-button sidebar-toggle"
          aria-label={toggleLabel}
          title={toggleLabel}
          aria-pressed={collapsed}
          aria-controls="sidebar"
          onClick={onToggleCollapse}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>
      <button className="icon-button mobile-close" aria-label="Fechar navegação" onClick={onClose}><X size={19} /></button>
      <nav aria-label="Menu principal">
        {links.map(({ id, title, icon: Icon }) =>
          <a
            key={id}
            href={`#${id}`}
            aria-label={title}
            title={title}
            aria-current={page.id === id ? 'page' : undefined}
            onClick={(event) => {
              event.preventDefault()
              onNavigate(id)
            }}
          >
            <Icon className="nav-icon" size={18} strokeWidth={1.75} aria-hidden="true" />
            <span className="nav-label">{title}</span>
            {page.id === id && <ChevronRight className="active-arrow" size={15} aria-hidden="true" />}
          </a>
        )}
      </nav>
    </aside>
  </>
}

export function App() {
  const [page, setPage] = useState(readPage)
  const [date, setDate] = useState(localDate)
  const [session, setSession] = useState(readSession)
  const [revision, setRevision] = useState(0)
  const [dialog, setDialog] = useState(null)
  const [menu, setMenu] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed)
  const [message, setMessage] = useState('')
  const [returnsToBooking, setReturnsToBooking] = useState(null)
  const [selectedShopId, setSelectedShopId] = useState('')

  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      const next = !current
      saveSidebarCollapsed(next)
      return next
    })
  }

  const retry = () => setRevision((value) => value + 1)
  const profile = useResource(session && `profile/${revision}`, api.profile)
  // A fonte definitiva do perfil é o banco (via /usuario/me/); session.perfil evita flash durante o carregamento.
  const role = session ? (profile.value?.perfil || session.perfil || null) : null
  const isBarber = role === 'barbeiro'
  const links = isBarber ? barberLinks : clientLinks
  const homeId = isBarber ? 'painel' : 'visao-geral'

  const catalogPage = ['barbearias', 'servicos', 'consultoria'].includes(page.id)
  const agendaPage = ['visao-geral', 'agenda'].includes(page.id)
  const barberPage = isBarber && ['painel', 'agenda', 'clientes', 'planos'].includes(page.id)
  const barberManagePage = isBarber && ['painel', 'planos'].includes(page.id)

  const shops = useResource(!isBarber && (catalogPage || agendaPage || dialog?.type === 'book') && `shops/${revision}`, api.shops)
  const effectiveShopId = selectedShopId || (shops.value?.length ? String(shops.value[0].id) : '')
  const bookings = useResource(session && (agendaPage || barberPage || dialog?.type === 'book') && `bookings/${revision}`, api.bookings)
  const clients = useResource(isBarber && barberPage && `clients/${revision}`, api.clients)
  const myShops = useResource(barberManagePage && `myShops/${revision}`, api.myShops)
  const myServices = useResource(barberManagePage && `myServices/${revision}`, api.myServices)
  const myPlans = useResource(barberManagePage && `myPlans/${revision}`, api.myPlans)

  const loadServices = useCallback(
    (signal) => page.shopId ? api.services(page.shopId, signal) : api.allServices(signal),
    [page.shopId],
  )
  const loadTimes = useCallback((signal) => api.times(date, { shopId: effectiveShopId }, signal), [date, effectiveShopId])
  const services = useResource(!isBarber && page.id === 'servicos' && `services/${page.shopId || 'all'}/${revision}`, loadServices)
  const times = useResource(!isBarber && agendaPage && effectiveShopId && `times/${date}/${effectiveShopId}/${revision}`, loadTimes)

  const shop = shops.value?.find((item) => item.id === page.shopId)
  const name = profile.value ? profileName(profile.value.Vinculado) : ''
  const currentLink = links.find((link) => link.id === page.id) || links[0]

  useEffect(() => {
    const onHash = () => setPage(readPage())
    function expire() {
      setSession(null)
      setDialog(null)
      setMessage('Sua sessão expirou. Entre novamente.')
    }
    window.addEventListener('hashchange', onHash)
    window.addEventListener('barbear:session-ended', expire)
    return () => {
      window.removeEventListener('hashchange', onHash)
      window.removeEventListener('barbear:session-ended', expire)
    }
  }, [])

  // Redireciona automaticamente caso a rota atual não pertença ao perfil autenticado.
  useEffect(() => {
    if (isBarber && !barberLinks.some((link) => link.id === page.id)) {
      window.location.hash = 'painel'
    } else if (!isBarber && !clientLinks.some((link) => link.id === page.id)) {
      window.location.hash = 'visao-geral'
    }
  }, [isBarber, page.id])

  function navigate(id, shopId) {
    window.location.hash = shopId ? `${id}/${shopId}` : id
    setMenu(false)
    window.scrollTo(0, 0)
  }

  function login(tokens) {
    saveSession(tokens)
    setSession(tokens)
    setMenu(false)
    const userRole = tokens.perfil
    if (returnsToBooking && userRole === 'cliente') {
      setDialog({ type: 'book', defaults: returnsToBooking })
    } else {
      setDialog(null)
      if (!(userRole === 'cliente' && page.id === 'consultoria')) {
        navigate(roleHome(userRole))
      }
    }
    setReturnsToBooking(null)
    retry()
  }

  function logout() {
    saveSession(null)
    setSession(null)
    if (!clientLinks.some((link) => link.id === page.id)) navigate('visao-geral')
    setMessage('Sessão encerrada.')
  }

  function openBooking(defaults) {
    setDialog({ type: 'book', defaults: { date: date < localDate() ? localDate() : date, shopId: effectiveShopId, ...defaults } })
  }

  function completeBooking(item) {
    retry()
    setDate(item.date)
    if (!agendaPage) navigate('agenda')
    setDialog(null)
    setMessage('Agendamento confirmado.')
  }

  function cancelBooking() {
    retry()
    setDialog(null)
    setMessage('Agendamento cancelado.')
  }

  const closeToast = useCallback(() => setMessage(''), [])
  const openLogin = (defaults, initialRole = 'cliente') => {
    setReturnsToBooking(defaults || null)
    setDialog({ type: 'auth', initialRole })
  }
  const closeDialog = () => {
    setDialog(null)
    setReturnsToBooking(null)
  }

  return <div className={`app-shell ${sidebarCollapsed ? 'app-sidebar-collapsed' : ''}`}>
    <Sidebar
      links={links}
      homeId={homeId}
      page={page}
      open={menu}
      collapsed={sidebarCollapsed}
      onToggleCollapse={toggleSidebar}
      onNavigate={navigate}
      onClose={() => setMenu(false)}
    />
    <div className="main-layout">
      <header className="topbar">
        <div className="breadcrumb">
          <button className="icon-button open-menu" onClick={() => setMenu(!menu)} aria-label="Abrir navegação" aria-expanded={menu} aria-controls="sidebar"><Menu size={20} /></button>
          <Store size={16} /><span>Barbear</span><ChevronRight size={13} /><strong>{currentLink.title}</strong>
        </div>
        <div className="topbar-actions">
          {session ?
            <>
              {role && <span className="role-pill">{isBarber ? 'Barbeiro' : 'Cliente'}</span>}
              <button className="account-button" onClick={() => navigate('conta')} aria-label="Minha conta">
                <span className="initials">{name ? initials(name) : <CircleUserRound size={18} />}</span>
                <span>{name || 'Minha conta'}</span><ChevronDown size={14} />
              </button>
            </> :
            <button className="primary login-button" onClick={() => openLogin(null, 'cliente')}><LogIn size={16} />Entrar</button>
          }
        </div>
      </header>
      <main id="main-content" className="main-content">
        {isBarber && (page.id === 'painel' || page.id === 'agenda') && <BarberPanel
          overview={page.id === 'painel'} {...{ date, setDate, bookings, clients, myShops, myServices, myPlans, retry }}
          onOpen={(item) => setDialog({ type: 'details', item })}
          onEditShop={(item) => setDialog({ type: 'shop', shop: item })}
          onEditService={(item) => setDialog({ type: 'service', service: item })}
          onEditPlan={(item) => setDialog({ type: 'plan', plan: item })}
          onMessage={setMessage}
        />}
        {isBarber && page.id === 'planos' && <BarberPlans
          {...{ myShops, myServices, myPlans, retry }}
          onEditPlan={(item) => setDialog({ type: 'plan', plan: item })}
          onMessage={setMessage}
        />}
        {isBarber && page.id === 'clientes' && <BarberClients
          {...{ clients, bookings, retry }}
          onOpen={(item) => setDialog({ type: 'details', item })}
        />}
        {!isBarber && agendaPage && <Dashboard
          overview={page.id === 'visao-geral'} {...{ date, setDate, bookings, shops, times, retry, session }}
          selectedShopId={effectiveShopId} onSelectShop={setSelectedShopId}
          items={bookings.value}
          onNew={openBooking} onOpen={(item) => setDialog({ type: 'details', item })}
          onCatalog={() => navigate('barbearias')} onLogin={(r) => openLogin(null, r)}
        />}
        {!isBarber && page.id === 'barbearias' && <ShopCatalog {...{ shops, retry }}
          onSelect={(id) => navigate('servicos', id)}
        />}
        {!isBarber && page.id === 'servicos' && <ServicesCatalog {...{ shops, shop, services, retry }}
          onSelect={(id) => navigate('servicos', id)} onBook={openBooking}
        />}
        {!isBarber && page.id === 'consultoria' && <AssistantConsultation
          {...{ shops, session, role, retry }}
          onBook={openBooking}
          onLogin={(r) => openLogin(null, r)}
        />}
        {page.id === 'conta' && <Account profile={profile.value} error={profile.error} {...{ name, retry, session }}
          onLogin={(r) => openLogin(null, r)} onLogout={logout}
        />}
      </main>
    </div>
    {dialog?.type === 'auth' && <AuthDialog initialRole={dialog.initialRole} onClose={closeDialog} onLogin={login} />}
    {dialog?.type === 'book' && <BookingDialog defaults={dialog.defaults} {...{ shops, name, retry, session, role }}
      onLogin={openLogin} onClose={closeDialog} onSave={completeBooking}
    />}
    {dialog?.type === 'details' && <DetailsDialog item={dialog.item} onClose={closeDialog} onCancel={cancelBooking} />}
    {dialog?.type === 'shop' && <ShopDialog shop={dialog.shop} onClose={closeDialog} onSave={(msg) => { setDialog(null); setMessage(msg); retry() }} />}
    {dialog?.type === 'service' && <ServiceDialog service={dialog.service} shops={myShops.value || []} onClose={closeDialog} onSave={(msg) => { setDialog(null); setMessage(msg); retry() }} />}
    {dialog?.type === 'plan' && <PlanDialog plan={dialog.plan} shops={myShops.value || []} services={myServices.value || []} onClose={closeDialog} onSave={(msg) => { setDialog(null); setMessage(msg); retry() }} />}
    {message && <Toast message={message} onClose={closeToast} />}
  </div>
}
