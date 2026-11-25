const baseUrl = (import.meta.env.VITE_API_URL || '/django').replace(/\/+$/, '')
const sessionKey = 'barbear.session'
let pendingRefresh

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

function errorMessage(data) {
  if (typeof data === 'string') return data
  if (Array.isArray(data)) return errorMessage(data[0])
  if (data && typeof data === 'object') {
    for (const value of Object.values(data)) {
      const message = errorMessage(value)
      if (message) return message
    }
  }
}

export async function request(path, { body, token, headers, ...options } = {}) {
  let response
  try {
    response = await fetch(baseUrl + path, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new ApiError('Não foi possível conectar à API. Verifique se o Django está em execução.', 0)
  }

  if (response.status === 204) return null

  const contentType = response.headers.get('content-type') || ''
  const data = contentType.includes('application/json') ? await response.json() : null
  const status = response.ok ? Number(data?.status || response.status) : response.status
  if (!response.ok || status >= 400) {
    const message = [data?.detail, data?.error, data?.message, data?.msg]
      .find((value) => typeof value === 'string')
    throw new ApiError(message || errorMessage(data) || `Falha na API (HTTP ${status}).`, status)
  }
  if (data === null && response.status !== 204) {
    throw new ApiError('A API retornou uma resposta inesperada.', response.status)
  }
  return data
}

export function readSession() {
  try {
    return JSON.parse(sessionStorage.getItem(sessionKey)) || null
  } catch {
    return null
  }
}

export function saveSession(session) {
  if (session) sessionStorage.setItem(sessionKey, JSON.stringify(session))
  else sessionStorage.removeItem(sessionKey)
}

async function authenticated(path, options) {
  const session = readSession()
  if (!session) throw new ApiError('Entre para continuar.', 401)
  try {
    return await request(path, { ...options, token: session.access })
  } catch (error) {
    if (error.status !== 401) throw error
    if (options?.signal?.aborted) options.signal.throwIfAborted()
    const current = readSession()
    if (current?.refresh !== session.refresh) throw error
    if (current.access !== session.access) {
      return request(path, { ...options, token: current.access })
    }

    if (pendingRefresh?.token !== session.refresh) {
      const promise = request('/api/token/refresh/', {
        method: 'POST',
        body: { refresh: session.refresh },
      }).then(({ access, refresh }) => {
        if (readSession()?.refresh === session.refresh) {
          saveSession({ ...session, access, refresh: refresh || session.refresh })
        }
        return access
      }).finally(() => {
        if (pendingRefresh?.promise === promise) pendingRefresh = undefined
      })
      pendingRefresh = { token: session.refresh, promise }
    }

    let access
    try {
      access = await pendingRefresh.promise
    } catch (refreshError) {
      if (refreshError.status !== 401) throw refreshError
      if (readSession()?.refresh === session.refresh) {
        saveSession(null)
        window.dispatchEvent(new Event('barbear:session-ended'))
      }
      throw new ApiError('Sua sessão expirou. Entre novamente.', 401)
    }
    if (readSession()?.access !== access) throw new ApiError('Entre para continuar.', 401)
    return request(path, { ...options, token: access })
  }
}

export function profileName(user) {
  return [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username
}

export const roleHome = (role) => role === 'barbeiro' ? 'painel' : 'visao-geral'

function shop(data) {
  return {
    id: data.id, name: data.Nome, address: data.Endereco,
    phone: data.Telefone, email: data.Email, owner: data.Dono,
    open: data.horario_abertura.slice(0, 5), close: data.horario_fechamento.slice(0, 5),
  }
}

function service(data) {
  return {
    id: data.id,
    shopId: data.Barbearia?.id,
    shopName: data.Barbearia?.Nome,
    name: data.Nome,
    description: data.Descricao,
    price: Number(data.Preco),
  }
}

function booking(data) {
  return {
    id: data.id, clientId: data.cliente.id, client: profileName(data.cliente.Vinculado),
    clientEmail: data.cliente.Vinculado.email, clientPhone: data.cliente.Telefone,
    barber: data.barbeiro?.nome, shop: data.barbearia?.Nome,
    date: data.data_agendamento, time: data.horario_agendamento.slice(0, 5),
    description: data.descricao, service: service(data.servico),
  }
}

function barber(data) {
  return {
    id: data.id, name: data.nome,
    shops: data.barbearias.map((item) => ({
      id: item.id, name: item.Nome, address: item.Endereco,
      open: item.horario_abertura.slice(0, 5), close: item.horario_fechamento.slice(0, 5),
    })),
  }
}

function client(data) {
  const next = data.proximo_agendamento
  return {
    id: data.id, name: profileName(data.Vinculado), email: data.Vinculado.email, phone: data.Telefone,
    total: data.total_agendamentos,
    next: next && { date: next.data_agendamento, time: next.horario_agendamento.slice(0, 5) },
  }
}

function plan(data) {
  return {
    id: data.id,
    barbershop_id: data.barbershop_id,
    service_id: data.service_id,
    shopId: data.barbershop_id,
    serviceId: data.service_id,
    name: data.name,
    description: data.description || '',
    monthly_price: String(data.monthly_price ?? '0.00'),
    monthlyPrice: Number(data.monthly_price ?? 0),
    included_visits: Number(data.included_visits ?? 1),
    includedVisits: Number(data.included_visits ?? 1),
    active: Boolean(data.active),
  }
}

export const api = {
  // Cada perfil entra por um endpoint próprio; o backend recusa o perfil errado (HTTP 403).
  login: (body, role) => request(`/api/token/${role === 'barbeiro' ? 'barbeiro' : 'cliente'}/`, { method: 'POST', body }),
  register: (body) => request('/usuario/', { method: 'POST', body: { ...body, tipo_usuario: 1 } }),
  profile: async (signal) => (await authenticated('/usuario/me/', { signal })).Usuario,
  shops: async (signal) => (await request('/barbshop/', { signal })).barbershops.map(shop),
  myShops: async (signal) => (await authenticated('/barbshop/mine/', { signal })).barbershops.map(shop),
  barbers: async (signal) => (await request('/usuario/barbeiros/', { signal })).barbeiros.map(barber),
  clients: async (signal) => (await authenticated('/usuario/', { signal })).Usuario.map(client),
  allServices: async (signal) => {
    try {
      const data = await request('/service/', { signal })
      return data.services.map(service)
    } catch (error) {
      if (error.status === 404) return []
      throw error
    }
  },
  services: async (id, signal) => {
    try {
      const data = await request(`/service/?id=${encodeURIComponent(id)}`, { signal })
      return data.services.map(service)
    } catch (error) {
      if (error.status === 404) return []
      throw error
    }
  },
  // Disponibilidade por barbearia (agenda do barbeiro dono) ou por barbeiro.
  times: async (date, { shopId, barberId } = {}, signal) => {
    if (!shopId && !barberId) return []
    const filter = shopId ? `&barbearia=${encodeURIComponent(shopId)}` : `&barbeiro=${encodeURIComponent(barberId)}`
    const data = await request(`/scheduling/available_times/?date=${encodeURIComponent(date)}${filter}`, { signal })
    return data.available_times
  },
  myServices: async (signal) => (await authenticated('/service/mine/', { signal })).services.map(service),
  createShop: (body) => authenticated('/barbshop/', { method: 'POST', body }),
  updateShop: (id, body) => authenticated(`/barbshop/${encodeURIComponent(id)}/`, { method: 'PUT', body }),
  createService: (body) => authenticated('/service/', { method: 'POST', body }),
  updateService: (id, body) => authenticated(`/service/${encodeURIComponent(id)}/`, { method: 'PATCH', body }),
  deleteService: (id) => authenticated(`/service/${encodeURIComponent(id)}/`, { method: 'DELETE' }),
  plans: async (shopId, signal) => {
    if (!shopId) return []
    const data = await request(`/plans/?barbearia=${encodeURIComponent(shopId)}`, { signal })
    return (data.plans || []).map(plan)
  },
  myPlans: async (signal) => {
    const data = await authenticated('/plans/mine/', { signal })
    return (data.plans || []).map(plan)
  },
  createPlan: (body) => authenticated('/plans/', { method: 'POST', body }),
  updatePlan: (id, body) => authenticated(`/plans/${encodeURIComponent(id)}/`, { method: 'PATCH', body }),
  deletePlan: (id) => authenticated(`/plans/${encodeURIComponent(id)}/`, { method: 'DELETE' }),
  assistantStatus: (signal) => request('/assistant/status/', { signal }),
  recommendAssistant: (body, signal) => authenticated('/assistant/recommend/', { method: 'POST', body, signal }),
  bookings: async (signal) => (await authenticated('/scheduling/', { signal })).map(booking),
  book: async ({ serviceId, date, time, description }) => {
    const data = await authenticated('/scheduling/', {
      method: 'POST',
      body: { servico: serviceId, data_agendamento: date, horario_agendamento: time, descricao: description },
    })
    return booking(data.scheduling)
  },
  cancel: (id) => authenticated(`/scheduling/${encodeURIComponent(id)}/`, { method: 'DELETE' }),
}
