import { useCallback, useEffect, useRef, useState } from 'react'
import { CalendarDays, Check, Clock3, Phone, Store, UserRound, X } from 'lucide-react'
import { api } from './api'
import { Notice } from './Dashboard'
import { dateLabel, localDate, money, upcomingTimes } from './data'
import { useResource } from './useResource'

function Dialog({ title, children, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    const dialog = ref.current
    dialog.showModal()
    return () => dialog.close()
  }, [])

  return <dialog ref={ref} aria-labelledby="dialog-title" onCancel={(event) => { event.preventDefault(); onClose() }}>
    <div className="dialog-content">
      <div className="dialog-heading">
        <h2 id="dialog-title">{title}</h2>
        <button type="button" className="icon-button" aria-label="Fechar" onClick={onClose}><X size={19} /></button>
      </div>
      {children}
    </div>
  </dialog>
}

export function AuthDialog({ initialRole = 'cliente', onClose, onLogin }) {
  const [role, setRole] = useState(initialRole === 'barbeiro' ? 'barbeiro' : 'cliente')
  const [register, setRegister] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState({})
  const [username, setUsername] = useState('')

  function switchRole(nextRole) {
    setRole(nextRole)
    if (nextRole === 'barbeiro') setRegister(false)
    setResult({})
  }

  async function submit(event) {
    event.preventDefault()
    const fields = Object.fromEntries(new FormData(event.currentTarget))
    setBusy(true)
    setResult({})
    try {
      if (register && role === 'cliente') {
        await api.register(fields)
        setRegister(false)
        setResult({ success: 'Conta de cliente criada. Entre com seu usuário e senha.' })
      } else {
        const tokens = await api.login(fields, role)
        onLogin({ ...tokens, perfil: tokens.perfil || role })
      }
    } catch (error) {
      setResult({ error: error.status === 401 ? 'Usuário ou senha incorretos.' : error.message })
    } finally {
      setBusy(false)
    }
  }

  const isBarber = role === 'barbeiro'

  return <Dialog title={register ? 'Criar conta de cliente' : isBarber ? 'Acesso do barbeiro' : 'Acesso do cliente'} onClose={busy ? () => {} : onClose}>
    <div className="role-switch" role="group" aria-label="Tipo de acesso">
      <button type="button" aria-pressed={!isBarber} disabled={busy} onClick={() => switchRole('cliente')}>Sou cliente</button>
      <button type="button" aria-pressed={isBarber} disabled={busy} onClick={() => switchRole('barbeiro')}>Sou barbeiro</button>
    </div>
    <form onSubmit={submit}>
      {result.error && <Notice kind="error">{result.error}</Notice>}
      {result.success && <Notice kind="success">{result.success}</Notice>}
      {register && !isBarber && <label>Nome<input name="first_name" autoComplete="given-name" maxLength={150} required /></label>}
      <label>Usuário<input name="username" autoComplete="username" maxLength={150} value={username} onChange={(event) => setUsername(event.target.value)} required /></label>
      {register && !isBarber && <>
        <label>E-mail<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>
        <div className="form-row">
          <label>Telefone<input name="telefone" type="tel" autoComplete="tel-national" placeholder="DDD e número" pattern="[0-9]{10,11}" required /></label>
          <label>CPF<input name="cpf" inputMode="numeric" placeholder="Somente números" pattern="[0-9]{11}" required /></label>
        </div>
      </>}
      <label>Senha<input key={`${role}-${register}`} name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} minLength={register ? 8 : undefined} required /></label>
      <button type="submit" className="primary form-submit" disabled={busy}>
        {busy ? 'Aguarde…' : register ? 'Criar conta' : isBarber ? 'Entrar como barbeiro' : 'Entrar como cliente'}
      </button>
      {!isBarber ? (
        <button type="button" className="text-button" disabled={busy} onClick={() => { setRegister(!register); setResult({}) }}>
          {register ? 'Já tenho uma conta' : 'Criar conta de cliente'}
        </button>
      ) : (
        <p className="form-hint">Contas de barbeiro são habilitadas pela administração.</p>
      )}
    </form>
  </Dialog>
}

export function BookingDialog({ defaults, shops, name, session, role, onLogin, onSave, onClose, retry }) {
  const [date, setDate] = useState(defaults.date)
  const [shopId, setShopId] = useState(defaults.shopId ?? '')
  const [serviceId, setServiceId] = useState(defaults.serviceId ?? '')
  const [time, setTime] = useState(defaults.time ?? '')
  const [description, setDescription] = useState(defaults.description ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const actualShop = shops.value?.find((item) => String(item.id) === String(shopId)) ||
    (shopId === '' && shops.value?.length === 1 ? shops.value[0] : null)
  const shopKey = actualShop?.id
  const loadServices = useCallback((signal) => api.services(shopKey, signal), [shopKey])
  const loadTimes = useCallback((signal) => api.times(date, { shopId: shopKey }, signal), [date, shopKey])
  const liveServices = useResource(shopKey && `${shopKey}/${revision}`, loadServices)
  const liveTimes = useResource(date && shopKey && `${date}/${shopKey}/${revision}`, loadTimes)
  const services = liveServices.value
  const service = services?.find((item) => String(item.id) === String(serviceId))
  const today = localDate()
  const times = upcomingTimes(liveTimes.value, date)
  const selectedTime = times?.includes(time) ? time : ''
  const restricted = session && role === 'barbeiro'
  const canSubmit = actualShop && service && date && selectedTime && !restricted && !busy

  async function submit(event) {
    event.preventDefault()
    if (!canSubmit) return
    if (!session) {
      onLogin({ date, shopId: actualShop.id, serviceId: service.id, time: selectedTime, description }, 'cliente')
      return
    }
    setBusy(true)
    setError('')
    try {
      const booking = await api.book({ date, time: selectedTime, description, serviceId: service.id })
      onSave(booking)
    } catch (failure) {
      setError(failure.message)
      setRevision((value) => value + 1)
    } finally {
      setBusy(false)
    }
  }

  return <Dialog title="Novo agendamento" onClose={busy ? () => {} : onClose}>
    <form onSubmit={submit}>
      {error && <Notice kind="error">{error}</Notice>}
      {restricted && <Notice>Apenas contas de cliente podem criar novos agendamentos.</Notice>}
      {shops.loading && <Notice>Carregando barbearias…</Notice>}
      {shops.error && <Notice kind="error">{shops.error.message}<button className="text-button" type="button" onClick={retry}>Tentar novamente</button></Notice>}
      {shops.value?.length === 0 && <Notice>Nenhuma barbearia cadastrada.</Notice>}
      <label>Barbearia / Barbeiro<select required value={actualShop?.id ?? ''} onChange={(event) => { setShopId(event.target.value); setServiceId(''); setTime('') }}>
        <option value="">Escolha uma barbearia</option>
        {shops.value?.map((item) => <option key={item.id} value={item.id}>{item.name}{item.owner?.nome ? ` · ${item.owner.nome}` : ''}</option>)}
      </select></label>
      <label>Serviço / Corte<select required disabled={!services?.length} value={service?.id ?? ''} onChange={(event) => setServiceId(event.target.value)}>
        <option value="">{liveServices.loading ? 'Carregando…' : 'Escolha um serviço'}</option>
        {services?.map((item) => <option key={item.id} value={item.id}>{item.name} · {money(item.price)}</option>)}
      </select></label>
      {services?.length === 0 && <Notice>Esta barbearia ainda não tem serviços.</Notice>}
      {liveServices.error && <Notice kind="error">{liveServices.error.message}<button type="button" className="text-button" onClick={() => setRevision((value) => value + 1)}>Tentar novamente</button></Notice>}
      <div className="form-row">
        <label>Data<input type="date" required min={today} value={date} onChange={(event) => { setDate(event.target.value); setTime('') }} /></label>
        <label>Horário<select required disabled={!times?.length} value={selectedTime} onChange={(event) => setTime(event.target.value)}>
          <option value="">{liveTimes.loading ? 'Carregando…' : !shopKey ? 'Escolha a barbearia' : 'Selecione'}</option>
          {times?.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
        </select></label>
      </div>
      {actualShop && <p className="form-hint">Horários de {actualShop.owner?.nome || actualShop.name} ({actualShop.open}–{actualShop.close}).</p>}
      {shopKey && times?.length === 0 && <Notice>Nenhum horário disponível nesta data.</Notice>}
      {liveTimes.error && <Notice kind="error">{liveTimes.error.message}<button type="button" className="text-button" onClick={() => setRevision((value) => value + 1)}>Tentar novamente</button></Notice>}
      <label>Observações <span className="form-hint">(opcional)</span><textarea rows={2} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
      {service && selectedTime && <div className="booking-summary"><span>{service.name} · {dateLabel(date)} às {selectedTime}{name ? ` · ${name}` : ''}</span><strong>{money(service.price)}</strong></div>}
      <button type="submit" className="primary form-submit" disabled={!canSubmit}>
        {busy ? 'Confirmando…' : !session ? 'Entrar como cliente para reservar' : 'Confirmar agendamento'}
      </button>
    </form>
  </Dialog>
}

export function DetailsDialog({ item, onCancel, onClose }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function cancel() {
    setBusy(true)
    try {
      await api.cancel(item.id)
      onCancel(item.id)
    } catch (failure) {
      setError(failure.message)
      setBusy(false)
    }
  }

  return <Dialog title="Detalhes do agendamento" onClose={busy ? () => {} : onClose}>
    {error && <Notice kind="error">{error}</Notice>}
    <div className="detail-card">
      <h3>{item.client}</h3>
      <p>{item.service.name} · {money(item.service.price)}</p>
      <p><CalendarDays size={16} />{dateLabel(item.date)} <Clock3 size={16} />{item.time}</p>
      {item.shop && <p><Store size={16} />{item.shop}{item.barber ? ` · ${item.barber}` : ''}</p>}
      {item.clientPhone && <p><Phone size={16} />{item.clientPhone}{item.clientEmail ? ` · ${item.clientEmail}` : ''}</p>}
      {!item.clientPhone && item.barber && !item.shop && <p><UserRound size={16} />{item.barber}</p>}
      {item.description && <p>{item.description}</p>}
    </div>
    {confirming && <Notice>Cancelar este agendamento e liberar o horário?</Notice>}
    <div className="dialog-actions">
      <button className="secondary" disabled={busy} onClick={confirming ? () => setConfirming(false) : onClose}>{confirming ? 'Voltar' : 'Fechar'}</button>
      <button className="primary" disabled={busy} onClick={confirming ? cancel : () => setConfirming(true)}>
        {busy ? 'Cancelando…' : confirming ? 'Confirmar cancelamento' : 'Cancelar agendamento'}
      </button>
    </div>
  </Dialog>
}

export function ShopDialog({ shop, onSave, onClose }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    const fields = Object.fromEntries(new FormData(event.currentTarget))
    setBusy(true)
    setError('')
    try {
      if (shop) await api.updateShop(shop.id, fields)
      else await api.createShop(fields)
      onSave(shop ? 'Barbearia atualizada.' : 'Barbearia cadastrada.')
    } catch (failure) {
      setError(failure.message)
      setBusy(false)
    }
  }

  return <Dialog title={shop ? 'Editar barbearia' : 'Nova barbearia'} onClose={busy ? () => {} : onClose}>
    <form onSubmit={submit}>
      {error && <Notice kind="error">{error}</Notice>}
      <label>Nome<input name="Nome" defaultValue={shop?.name ?? ''} maxLength={100} required /></label>
      <label>Endereço<input name="Endereco" defaultValue={shop?.address ?? ''} maxLength={255} required /></label>
      <div className="form-row">
        <label>Telefone<input name="Telefone" defaultValue={shop?.phone ?? ''} maxLength={15} required /></label>
        <label>E-mail<input name="Email" type="email" defaultValue={shop?.email ?? ''} required /></label>
      </div>
      <div className="form-row">
        <label>Abertura<input name="horario_abertura" type="time" defaultValue={shop?.open ?? '08:00'} required /></label>
        <label>Fechamento<input name="horario_fechamento" type="time" defaultValue={shop?.close ?? '18:00'} required /></label>
      </div>
      <button type="submit" className="primary form-submit" disabled={busy}>{busy ? 'Salvando…' : 'Salvar barbearia'}</button>
    </form>
  </Dialog>
}

export function ServiceDialog({ service, shops, onSave, onClose }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    if (busy) return
    const fields = Object.fromEntries(new FormData(event.currentTarget))
    setBusy(true)
    setError('')
    try {
      if (service) await api.updateService(service.id, fields)
      else await api.createService(fields)
      onSave(service ? 'Serviço atualizado.' : 'Serviço cadastrado.')
    } catch (failure) {
      setError(failure.message)
      setBusy(false)
    }
  }

  return <Dialog title={service ? 'Editar serviço' : 'Novo serviço'} onClose={busy ? () => {} : onClose}>
    <form onSubmit={submit}>
      {error && <Notice kind="error">{error}</Notice>}
      <label>Barbearia<select name="Barbearia" defaultValue={service?.shopId ?? shops[0]?.id ?? ''} required>
        {shops.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>
      <label>Nome do corte / serviço<input name="Nome" defaultValue={service?.name ?? ''} maxLength={100} required /></label>
      <label>Descrição<textarea name="Descricao" rows={2} defaultValue={service?.description ?? ''} /></label>
      <label>Preço (R$)<input name="Preco" type="number" step="0.01" min="0" defaultValue={service?.price ?? ''} required /></label>
      <button type="submit" className="primary form-submit" disabled={busy}>{busy ? 'Salvando…' : 'Salvar serviço'}</button>
    </form>
  </Dialog>
}

export function PlanDialog({ plan, shops, services, onSave, onClose }) {
  const initialService = services.find((item) => Number(item.id) === Number(plan?.service_id ?? plan?.serviceId))
  const initialShopId = plan?.barbershop_id ?? plan?.shopId ?? initialService?.shopId ?? shops[0]?.id ?? ''
  const [shopId, setShopId] = useState(initialShopId ? String(initialShopId) : '')
  const shopServices = services.filter((item) => !item.shopId || String(item.shopId) === String(shopId))
  const initialServiceId = plan?.service_id ?? plan?.serviceId ?? shopServices[0]?.id ?? ''
  const [serviceId, setServiceId] = useState(initialServiceId ? String(initialServiceId) : '')
  const [name, setName] = useState(plan?.name ?? '')
  const [description, setDescription] = useState(plan?.description ?? '')
  const [monthlyPrice, setMonthlyPrice] = useState(plan?.monthly_price ?? '')
  const [includedVisits, setIncludedVisits] = useState(plan?.included_visits ?? 4)
  const [active, setActive] = useState(plan ? Boolean(plan.active) : true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function handleShopChange(nextShopId) {
    setShopId(nextShopId)
    const nextServices = services.filter((item) => !item.shopId || String(item.shopId) === String(nextShopId))
    setServiceId(nextServices[0]?.id ? String(nextServices[0].id) : '')
  }

  async function submit(event) {
    event.preventDefault()
    if (busy) return
    if (!shopId || !serviceId) {
      setError('Selecione a barbearia e o serviço vinculado ao plano.')
      return
    }
    const priceNum = Number(String(monthlyPrice).replace(',', '.'))
    const visitsNum = Number(includedVisits)
    const trimmedName = name.trim()
    const trimmedDescription = description.trim()
    if (!trimmedName || trimmedName.length > 100) {
      setError('Informe o nome do plano mensal (máximo de 100 caracteres).')
      return
    }
    if (trimmedDescription.length > 1000) {
      setError('A descrição do plano deve ter no máximo 1000 caracteres.')
      return
    }
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      setError('Informe um preço mensal válido maior que zero.')
      return
    }
    if (!Number.isInteger(visitsNum) || visitsNum < 1 || visitsNum > 100) {
      setError('Informe entre 1 e 100 atendimentos inclusos por mês.')
      return
    }

    setBusy(true)
    setError('')
    try {
      const payload = {
        barbershop_id: Number(shopId),
        service_id: Number(serviceId),
        name: trimmedName,
        description: trimmedDescription,
        monthly_price: priceNum.toFixed(2),
        included_visits: visitsNum,
        active: Boolean(active),
      }
      if (plan) await api.updatePlan(plan.id, payload)
      else await api.createPlan(payload)
      onSave(plan ? 'Plano mensal atualizado.' : 'Plano mensal cadastrado.')
    } catch (failure) {
      setError(failure.message)
      setBusy(false)
    }
  }

  return <Dialog title={plan ? 'Editar plano mensal' : 'Novo plano mensal'} onClose={busy ? () => {} : onClose}>
    <form onSubmit={submit}>
      {error && <Notice kind="error">{error}</Notice>}
      <label>Barbearia<select name="barbershop_id" value={shopId} onChange={(event) => handleShopChange(event.target.value)} required>
        <option value="">Escolha uma barbearia</option>
        {shops.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>
      <label>Serviço incluído no plano<select name="service_id" value={serviceId} onChange={(event) => setServiceId(event.target.value)} disabled={!shopServices.length} required>
        <option value="">{shopServices.length ? 'Escolha um serviço' : 'Sem serviços nesta barbearia'}</option>
        {shopServices.map((item) => <option key={item.id} value={item.id}>{item.name} · {money(item.price)} avulso</option>)}
      </select></label>
      {shopId && shopServices.length === 0 && <Notice>Cadastre um serviço nesta barbearia antes de criar um plano mensal.</Notice>}
      <label>Nome do plano<input name="name" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} placeholder="Ex.: Plano Corte Mensal" required /></label>
      <label>Descrição<textarea name="description" rows={2} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} placeholder="O que está incluído no pacote mensal" /></label>
      <div className="form-row">
        <label>Preço mensal (R$)<input name="monthly_price" type="number" step="0.01" min="0.01" value={monthlyPrice} onChange={(event) => setMonthlyPrice(event.target.value)} required /></label>
        <label>Atendimentos inclusos<input name="included_visits" type="number" step="1" min="1" max="100" value={includedVisits} onChange={(event) => setIncludedVisits(event.target.value)} required /></label>
      </div>
      <label className="checkbox-row">
        <input name="active" type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
        <span>Plano ativo e disponível para clientes</span>
      </label>
      <button type="submit" className="primary form-submit" disabled={busy || !shopServices.length}>
        {busy ? 'Salvando…' : 'Salvar plano mensal'}
      </button>
    </form>
  </Dialog>
}

export function Toast({ message, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4500)
    return () => clearTimeout(timer)
  }, [message, onClose])
  return <div role="status" className="toast"><Check size={19} />{message}<button aria-label="Dispensar aviso" onClick={onClose}><X size={16} /></button></div>
}
