import { useState } from 'react'
import {
  CalendarDays, ChevronLeft, ChevronRight, Clock3, Coins, MapPin, Pencil, Plus, Scissors,
  Store, Ticket, Trash2, UsersRound,
} from 'lucide-react'
import { api } from './api'
import { dateLabel, initials, localDate, money, prettyDate, shiftDate, upcomingTimes } from './data'

export function DateControls({ date, onChange }) {
  const today = localDate()
  return <div className="date-controls">
    <button className="icon-button" aria-label="Dia anterior" onClick={() => onChange(shiftDate(date, -1))}><ChevronLeft size={17} /></button>
    <label className="date-label">
      <CalendarDays size={16} />
      <span>{dateLabel(date)}</span>
      <input type="date" aria-label="Selecionar data" value={date} onChange={(event) => event.target.value && onChange(event.target.value)} />
    </label>
    <button className="icon-button" aria-label="Próximo dia" onClick={() => onChange(shiftDate(date, 1))}><ChevronRight size={17} /></button>
    {date !== today && <button className="today-button" onClick={() => onChange(today)}>Hoje</button>}
  </div>
}

export function Notice({ children, kind = 'neutral' }) {
  return <div className={`notice ${kind}`} role={kind === 'error' ? 'alert' : 'status'}>{children}</div>
}

function Summary({ appointments, loading, clientCount }) {
  const total = appointments?.reduce((sum, item) => sum + item.service.price, 0)
  const show = (value) => loading || value == null ? '—' : value
  const cards = [
    { icon: Coins, label: 'Receita prevista', value: show(total == null ? null : money(total)), note: 'Valor dos serviços do dia', tone: 'blue' },
    { icon: CalendarDays, label: 'Agendamentos', value: show(appointments?.length), note: 'Reservas nesta data', tone: 'green' },
    { icon: UsersRound, label: 'Meus clientes', value: show(clientCount), note: 'Clientes atendidos por você', tone: 'teal' },
    { icon: Ticket, label: 'Ticket médio', value: show(appointments?.length ? money(total / appointments.length) : null), note: 'Valor médio por atendimento', tone: 'sky' },
  ]

  return <section className="summary" aria-label="Indicadores do dia">
    {cards.map(({ icon: Icon, label, value, note, tone }) =>
      <article className="metric" key={label}>
        <div className="metric-top"><span>{label}</span><div className={`metric-icon ${tone}`}><Icon size={17} strokeWidth={1.7} /></div></div>
        <strong>{value}</strong>
        <small>{note}</small>
      </article>
    )}
  </section>
}

function AppointmentCard({ item, onOpen, subtitle }) {
  const tone = item.service.id % 4
  return <button className={`appointment appt-${tone}`} onClick={() => onOpen(item)}>
    <div className="appointment-text">
      <span title={item.client}>{item.client}</span>
      <small title={subtitle || item.service.name}>{subtitle || item.service.name}</small>
    </div>
    <span className="appointment-price">{money(item.service.price)}</span>
  </button>
}

function LiveAgenda({ appointments, date, shops, selectedShopId, onSelectShop, times, bookings, session, retry, onNew, onOpen, onCatalog, onLogin }) {
  const available = upcomingTimes(times.value, date)
  const selectedShop = shops.value?.find((item) => String(item.id) === String(selectedShopId))
  return <div className="live-agenda">
    <div className="live-column">
      <h3>Meus agendamentos</h3>
      {!session && <Notice><span>Entre como cliente para ver e confirmar seus agendamentos.</span><button className="text-button" onClick={() => onLogin('cliente')}>Entrar como cliente</button></Notice>}
      {session && bookings.loading && <Notice>Carregando seus agendamentos…</Notice>}
      {session && bookings.error && <Notice kind="error">{bookings.error.message}<button className="text-button" onClick={retry}>Tentar novamente</button></Notice>}
      {session && appointments?.length === 0 && <Notice>Você não tem agendamentos nesta data.</Notice>}
      {appointments?.map((item) => <div className="live-booking" key={item.id}>
        <time>{item.time}</time>
        <AppointmentCard item={item} onOpen={onOpen} subtitle={[item.service.name, item.shop, item.barber].filter(Boolean).join(' · ')} />
      </div>)}
    </div>
    <div className="live-column">
      <h3>Horários disponíveis</h3>
      <p>Consulte a disponibilidade de cada barbearia e barbeiro.</p>
      {shops.value?.length > 0 && <label className="agenda-shop-filter">
        Barbearia / Barbeiro
        <select
          value={selectedShopId ?? ''} onChange={(event) => onSelectShop(event.target.value)}>
          <option value="">Escolha uma barbearia</option>
          {shops.value.map((item) => <option key={item.id} value={item.id}>{item.name}{item.owner?.nome ? ` · ${item.owner.nome}` : ''}</option>)}
        </select>
      </label>}
      {!selectedShop && !shops.loading && <Notice>Selecione uma barbearia para consultar os horários disponíveis.</Notice>}
      {selectedShop && times.loading && <Notice>Consultando horários…</Notice>}
      {selectedShop && times.error && <Notice kind="error">{times.error.message}<button className="text-button" onClick={retry}>Tentar novamente</button></Notice>}
      {selectedShop && available?.length === 0 && <Notice>Nenhum horário disponível nesta data.</Notice>}
      {selectedShop && available && <div className="time-options">
        {available.map((time) => <button key={time} type="button" onClick={() => onNew({ time, shopId: selectedShop.id })}>{time}</button>)}
      </div>}
      <button className="text-button catalog-link" onClick={onCatalog}>Ver barbeiros e serviços disponíveis</button>
    </div>
  </div>
}

export function Dashboard({ overview, date, setDate, session, items, bookings, shops, selectedShopId, onSelectShop, times, retry, onNew, onOpen, onCatalog, onLogin }) {
  const filtered = items?.filter((item) => item.date === date)
    .sort((a, b) => a.time.localeCompare(b.time))
  const title = overview ? 'Visão geral' : 'Meus agendamentos'

  return <>
    {overview ?
      <section className="hero" aria-labelledby="dashboard-heading">
        <div className="hero-content">
          <div className="hero-date"><CalendarDays size={14} />{prettyDate(date)}</div>
          <h1 id="dashboard-heading">Visão geral</h1>
          <p>Escolha um barbeiro, serviço e horário para o seu atendimento.</p>
          <button className="primary hero-button" onClick={() => onNew({})}><Plus size={18} /> Novo agendamento</button>
        </div>
      </section> :
      <header className="page-heading">
        <div><h1>{title}</h1><p className="capitalize">{prettyDate(date)}</p></div>
        <button className="primary" onClick={() => onNew({})}><Plus size={18} /> Novo agendamento</button>
      </header>
    }
    <section className="agenda-section" aria-labelledby="schedule-heading">
      <header className="agenda-heading">
        <div>
          <h2 id="schedule-heading">Reservas e horários</h2>
          <p>{prettyDate(date)}</p>
        </div>
        <div className="agenda-actions">
          <DateControls date={date} onChange={setDate} />
        </div>
      </header>
      <LiveAgenda appointments={filtered} {...{ date, shops, selectedShopId, onSelectShop, times, bookings, session, retry, onNew, onOpen, onCatalog, onLogin }} />
    </section>
  </>
}

export function BarberPlansSection({ myShops, myServices, myPlans, retry, onEditPlan, onMessage }) {
  const [deletingId, setDeletingId] = useState(null)

  async function removePlan(item) {
    if (deletingId === item.id) return
    setDeletingId(item.id)
    try {
      await api.deletePlan(item.id)
      onMessage('Plano mensal removido.')
      retry()
    } catch (failure) {
      onMessage(failure.message)
    } finally {
      setDeletingId(null)
    }
  }

  const canCreatePlan = (myShops.value?.length > 0) && (myServices.value?.length > 0)

  return <section className="live-column" aria-labelledby="barber-plans-heading">
    <div className="panel-card-header">
      <div>
        <h3 id="barber-plans-heading">Meus planos mensais</h3>
        <small className="form-hint">Pacotes mensais de atendimentos vinculados aos serviços da sua barbearia.</small>
      </div>
      {canCreatePlan && (
        <button className="secondary" onClick={() => onEditPlan(null)}>
          <Plus size={15} /> Plano mensal
        </button>
      )}
    </div>
    {myPlans?.loading && <Notice>Carregando planos mensais…</Notice>}
    {myPlans?.error && <Notice kind="error">{myPlans.error.message}<button className="text-button" onClick={retry}>Tentar novamente</button></Notice>}
    {!myPlans?.loading && !myPlans?.error && myPlans?.value?.length === 0 && (
      <Notice>
        {canCreatePlan
          ? 'Nenhum plano mensal cadastrado ainda. Crie um plano para oferecer pacotes mensais aos seus clientes.'
          : 'Cadastre sua barbearia e ao menos um serviço antes de criar planos mensais.'}
      </Notice>
    )}
    <div className="catalog-grid">
      {myPlans?.value?.map((item) => {
        const shopItem = myShops.value?.find((shop) => Number(shop.id) === Number(item.barbershop_id))
        const serviceItem = myServices.value?.find((svc) => Number(svc.id) === Number(item.service_id))
        return <article className="catalog-card plan-card" key={item.id}>
          <div className="plan-card-top">
            <span className="metric-icon green"><Ticket size={18} /></span>
            <span className={`role-pill ${item.active ? '' : 'pill-inactive'}`}>
              {item.active ? 'Ativo' : 'Inativo'}
            </span>
          </div>
          <h3>{item.name}</h3>
          <p>
            {[shopItem?.name, serviceItem?.name].filter(Boolean).join(' · ') || 'Serviço vinculado'}
            {item.description ? ` — ${item.description}` : ''}
          </p>
          <small className="plan-visits-tag">
            {item.includedVisits} {item.includedVisits === 1 ? 'atendimento incluso/mês' : 'atendimentos inclusos/mês'}
          </small>
          <div className="plan-card-actions">
            <strong>{money(item.monthlyPrice)}<small>/mês</small></strong>
            <span style={{ display: 'inline-flex', gap: 6 }}>
              <button className="icon-button" aria-label={`Editar ${item.name}`} onClick={() => onEditPlan(item)}><Pencil size={14} /></button>
              <button className="icon-button" aria-label={`Excluir ${item.name}`} disabled={deletingId === item.id} onClick={() => removePlan(item)}><Trash2 size={14} /></button>
            </span>
          </div>
        </article>
      })}
    </div>
  </section>
}

export function BarberPlans({ myShops, myServices, myPlans, retry, onEditPlan, onMessage }) {
  const canCreatePlan = (myShops.value?.length > 0) && (myServices.value?.length > 0)
  return <>
    <header className="page-heading">
      <div>
        <h1>Planos mensais</h1>
        <p>Gerencie os planos de assinatura e pacotes de atendimentos oferecidos pelas suas barbearias.</p>
      </div>
      {canCreatePlan && (
        <button className="primary" onClick={() => onEditPlan(null)}>
          <Plus size={18} /> Novo plano mensal
        </button>
      )}
    </header>
    <BarberPlansSection {...{ myShops, myServices, myPlans, retry, onEditPlan, onMessage }} />
  </>
}

export function BarberPanel({ overview, date, setDate, bookings, clients, myShops, myServices, myPlans, retry, onOpen, onEditShop, onEditService, onEditPlan, onMessage }) {
  const appointments = bookings.value?.filter((item) => item.date === date).sort((a, b) => a.time.localeCompare(b.time))
  const [deletingServiceId, setDeletingServiceId] = useState(null)

  async function removeService(item) {
    if (deletingServiceId === item.id) return
    setDeletingServiceId(item.id)
    try {
      await api.deleteService(item.id)
      onMessage('Serviço removido.')
      retry()
    } catch (failure) {
      onMessage(failure.message)
    } finally {
      setDeletingServiceId(null)
    }
  }

  return <>
    {overview ?
      <section className="hero" aria-labelledby="barber-heading">
        <div className="hero-content">
          <div className="hero-date"><CalendarDays size={14} />{prettyDate(date)}</div>
          <h1 id="barber-heading">Área do barbeiro</h1>
          <p>Gerencie seus clientes, horários agendados, barbearia, serviços e planos mensais.</p>
          <button className="primary hero-button" onClick={() => onEditShop(null)}><Store size={18} /> Nova barbearia</button>
        </div>
      </section> :
      <header className="page-heading">
        <div><h1>Minha agenda</h1><p className="capitalize">{prettyDate(date)}</p></div>
      </header>
    }
    {overview && <Summary appointments={appointments} clientCount={clients.value?.length} loading={bookings.loading || clients.loading} />}

    <section className="agenda-section" aria-labelledby="barber-schedule-heading">
      <header className="agenda-heading">
        <div>
          <h2 id="barber-schedule-heading">Agendamentos recebidos</h2>
          <p>{appointments ? `${appointments.length} ${appointments.length === 1 ? 'atendimento' : 'atendimentos'} em ${dateLabel(date)}` : prettyDate(date)}</p>
        </div>
        <div className="agenda-actions">
          <DateControls date={date} onChange={setDate} />
        </div>
      </header>
      <div className="live-agenda">
        <div className="live-column">
          <h3>Horários do dia</h3>
          {bookings.loading && <Notice>Carregando agenda…</Notice>}
          {bookings.error && <Notice kind="error">{bookings.error.message}<button className="text-button" onClick={retry}>Tentar novamente</button></Notice>}
          {appointments?.length === 0 && <Notice>Nenhum cliente agendado para esta data.</Notice>}
          {appointments?.map((item) => <div className="live-booking" key={item.id}>
            <time>{item.time}</time>
            <AppointmentCard item={item} onOpen={onOpen} subtitle={[item.service.name, item.clientPhone].filter(Boolean).join(' · ')} />
          </div>)}
        </div>
        <div className="live-column">
          <div className="panel-card-header">
            <h3>Clientes recentes</h3>
          </div>
          {clients.loading && <Notice>Carregando clientes…</Notice>}
          {clients.error && <Notice kind="error">{clients.error.message}</Notice>}
          {clients.value?.length === 0 && <Notice>Nenhum cliente com agendamento registrado.</Notice>}
          {clients.value?.slice(0, 8).map((person) => <div className="client-row" key={person.id}>
            <div>
              <strong>{person.name}</strong>
              <small>{person.phone || person.email}</small>
            </div>
            <div className="client-meta">
              <div>{person.total} {person.total === 1 ? 'reserva' : 'reservas'}</div>
              {person.next && <small>Próximo: {dateLabel(person.next.date)} {person.next.time}</small>}
            </div>
          </div>)}
        </div>
      </div>
    </section>

    {overview && <div className="panel-stack">
      <section className="live-column">
        <div className="panel-card-header">
          <h3>Minhas barbearias</h3>
          <button className="secondary" onClick={() => onEditShop(null)}><Plus size={15} /> Barbearia</button>
        </div>
        {myShops.loading && <Notice>Carregando barbearias…</Notice>}
        {myShops.value?.length === 0 && <Notice>Cadastre sua barbearia para receber agendamentos.</Notice>}
        <div className="catalog-grid">
          {myShops.value?.map((shop) => <article className="catalog-card" key={shop.id}>
            <span className="metric-icon blue"><Store size={18} /></span>
            <h3>{shop.name}</h3>
            <p>{shop.address}<br />{shop.open}–{shop.close}</p>
            <button className="secondary" onClick={() => onEditShop(shop)}><Pencil size={14} /> Editar</button>
          </article>)}
        </div>
      </section>

      <section className="live-column">
        <div className="panel-card-header">
          <h3>Meus serviços e cortes</h3>
          {myShops.value?.length > 0 && <button className="secondary" onClick={() => onEditService(null)}><Plus size={15} /> Serviço</button>}
        </div>
        {myServices.loading && <Notice>Carregando serviços…</Notice>}
        {myServices.value?.length === 0 && <Notice>Nenhum serviço cadastrado ainda.</Notice>}
        <div className="catalog-grid">
          {myServices.value?.map((item) => <article className="catalog-card" key={item.id}>
            <span className="metric-icon teal"><Scissors size={18} /></span>
            <h3>{item.name}</h3>
            <p>{item.shopName ? `${item.shopName} · ` : ''}{item.description || 'Serviço de barbearia'}</p>
            <div>
              <strong>{money(item.price)}</strong>
              <span style={{ display: 'inline-flex', gap: 6 }}>
                <button className="icon-button" aria-label={`Editar ${item.name}`} onClick={() => onEditService(item)}><Pencil size={14} /></button>
                <button className="icon-button" aria-label={`Excluir ${item.name}`} disabled={deletingServiceId === item.id} onClick={() => removeService(item)}><Trash2 size={14} /></button>
              </span>
            </div>
          </article>)}
        </div>
      </section>

      <BarberPlansSection {...{ myShops, myServices, myPlans, retry, onEditPlan, onMessage }} />
    </div>}
  </>
}

export function BarberClients({ clients, bookings, retry, onOpen }) {
  const [selectedClientId, setSelectedClientId] = useState(null)
  const selectedClient = clients.value?.find((person) => person.id === selectedClientId)
  const history = selectedClient && bookings.value?.filter((item) => item.clientId === selectedClient.id)
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))

  return <>
    <header className="page-heading">
      <div><h1>Meus clientes</h1><p>Consulte os contatos e selecione um cliente para ver seus atendimentos.</p></div>
    </header>
    {clients.loading && <Notice>Carregando clientes…</Notice>}
    {clients.error && <Notice kind="error">{clients.error.message}<button className="text-button" onClick={retry}>Tentar novamente</button></Notice>}
    {clients.value?.length === 0 && <Notice>Você ainda não possui clientes com agendamentos.</Notice>}
    <div className="live-agenda client-directory">
      <div className="live-column">
        <h3>Lista de clientes</h3>
        {clients.value?.map((person) => <article className={`client-profile ${person.id === selectedClientId ? 'client-selected' : ''}`} key={person.id}>
          <span className="initials" aria-hidden="true">{initials(person.name)}</span>
          <div className="client-profile-info">
            <strong>{person.name}</strong>
            {person.phone && <a href={`tel:${person.phone}`}>{person.phone}</a>}
            {person.email && <a href={`mailto:${person.email}`}>{person.email}</a>}
            <small>{person.total} {person.total === 1 ? 'agendamento' : 'agendamentos'}</small>
            {person.next && <small>Próximo: {dateLabel(person.next.date)} às {person.next.time}</small>}
            <button className="text-button" aria-pressed={person.id === selectedClientId} aria-controls="client-history"
              onClick={() => setSelectedClientId(person.id)}>Ver histórico<ChevronRight size={14} /></button>
          </div>
        </article>)}
      </div>
      <section className="live-column" id="client-history" aria-labelledby="client-history-heading">
        <h3 id="client-history-heading">{selectedClient ? `Atendimentos de ${selectedClient.name}` : 'Histórico de atendimentos'}</h3>
        {!selectedClient && <Notice>Selecione um cliente na lista para consultar o histórico.</Notice>}
        {selectedClient && bookings.loading && <Notice>Carregando agendamentos…</Notice>}
        {selectedClient && bookings.error && <Notice kind="error">{bookings.error.message}<button className="text-button" onClick={retry}>Tentar novamente</button></Notice>}
        {history?.length === 0 && <Notice>Nenhum agendamento registrado para este cliente.</Notice>}
        {history?.map((item) => <div className="live-booking" key={item.id}>
          <time>{item.time}</time>
          <AppointmentCard item={item} onOpen={onOpen} subtitle={`${dateLabel(item.date)} · ${item.service.name}`} />
        </div>)}
      </section>
    </div>
  </>
}

export function ShopCatalog({ shops, onSelect, retry }) {
  return <>
    <header className="page-heading"><div>
      <h1>Barbearias</h1>
      <p>Conheça os estabelecimentos, seus barbeiros e horários de funcionamento.</p>
    </div></header>
    {shops.loading && <Notice>Carregando barbearias…</Notice>}
    {shops.error && <Notice kind="error">{shops.error.message}<button className="text-button" onClick={retry}>Tentar novamente</button></Notice>}
    {shops.value?.length === 0 && <Notice>Nenhuma barbearia cadastrada.</Notice>}
    <div className="catalog-grid shop-grid">
      {shops.value?.map((item) => <article className="catalog-card shop-card" key={item.id}>
        <div className="shop-card-heading">
          <span className="metric-icon green"><Store size={20} /></span>
          <div><h2>{item.name}</h2>{item.owner?.nome && <p>Barbeiro: {item.owner.nome}</p>}</div>
        </div>
        <div className="shop-information">
          <p><MapPin size={16} aria-hidden="true" /><span>{item.address}</span></p>
          <p><Clock3 size={16} aria-hidden="true" /><span>{item.open}–{item.close}</span></p>
          {item.phone && <a href={`tel:${item.phone}`}>Telefone: {item.phone}</a>}
        </div>
        <button className="secondary" onClick={() => onSelect(item.id)}>Ver cortes e serviços<ChevronRight size={16} /></button>
      </article>)}
    </div>
  </>
}

export function ServicesCatalog({ shops, shop, services, onSelect, onBook, retry }) {
  return <>
    <header className="page-heading">
      <div><h1>Cortes e serviços</h1><p>Compare os serviços e preços e escolha o seu próximo atendimento.</p></div>
      <label className="catalog-filter">Barbearia
        <select value={shop?.id ?? ''} onChange={(event) => onSelect(event.target.value || null)} disabled={shops.loading}>
          <option value="">Todas as barbearias</option>
          {shops.value?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
    </header>
    {shops.error && <Notice kind="error">{shops.error.message}<button className="text-button" onClick={retry}>Tentar novamente</button></Notice>}
    {services.loading && <Notice>Carregando serviços…</Notice>}
    {services.error && <Notice kind="error">{services.error.message}<button className="text-button" onClick={retry}>Tentar novamente</button></Notice>}
    {services.value?.length === 0 && <Notice>{shop ? 'Esta barbearia ainda não tem serviços cadastrados.' : 'Nenhum serviço cadastrado.'}</Notice>}
    <div className="service-list">
      {services.value?.map((item) => {
        const establishment = shops.value?.find((entry) => entry.id === item.shopId) || shop
        const shopId = item.shopId || establishment?.id
        return <article className="service-row" key={item.id}>
          <span className="metric-icon blue"><Scissors size={20} /></span>
          <div className="service-information">
            <h2>{item.name}</h2>
            <p>{item.description || 'Serviço de barbearia'}</p>
            <span><Store size={14} aria-hidden="true" />{item.shopName || establishment?.name}
              {establishment?.owner?.nome && ` · ${establishment.owner.nome}`}</span>
          </div>
          <div className="service-action"><strong>{money(item.price)}</strong>
            <button className="primary" disabled={!shopId} onClick={() => onBook({ shopId, serviceId: item.id })}>Agendar</button>
          </div>
        </article>
      })}
    </div>
  </>
}

export function Account({ profile, name, error, retry, session, onLogin, onLogout }) {
  const roleLabel = profile?.perfil === 'barbeiro' ? 'Barbeiro' : profile?.perfil === 'cliente' ? 'Cliente' : null
  return <>
    <header className="page-heading"><div><h1>Minha conta</h1><p>Acesse seus dados e gerencie sua sessão.</p></div></header>
    <div className="account-card">
      {error && <Notice kind="error">{error.message}<button className="text-button" onClick={retry}>Tentar novamente</button></Notice>}
      {session && !profile && !error && <Notice>Carregando perfil…</Notice>}
      {profile && <div className="account-name"><span className="initials">{initials(name)}</span><div><h2>{name}</h2><p>{profile.Vinculado.email}</p></div></div>}
      {roleLabel && <span className="role-pill">{roleLabel}</span>}
      {profile && <p>Telefone · {profile.Telefone || 'Sem telefone cadastrado'}</p>}
      {profile?.cpf && <p>CPF · {profile.cpf}</p>}
      {session ? <button className="secondary" onClick={onLogout}>Sair da conta</button> :
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button className="primary" onClick={() => onLogin('cliente')}>Entrar como cliente</button>
          <button className="secondary" onClick={() => onLogin('barbeiro')}>Área do barbeiro</button>
        </div>}
    </div>
  </>
}
