import { useCallback, useEffect, useRef, useState } from 'react'
import { CalendarDays, Check, Coins, Info, Scissors, Sparkles, Store, Ticket } from 'lucide-react'
import { api } from './api'
import { Notice } from './Dashboard'
import { money } from './data'
import { useResource } from './useResource'

const HAIR_TYPES = [
  { value: 'straight', label: 'Liso' },
  { value: 'wavy', label: 'Ondulado' },
  { value: 'curly', label: 'Cacheado' },
  { value: 'coily', label: 'Crespo' },
]

const HAIR_LENGTHS = [
  { value: 'short', label: 'Curto' },
  { value: 'medium', label: 'Médio' },
  { value: 'long', label: 'Longo' },
]

const STYLES = [
  { value: 'classic', label: 'Clássico' },
  { value: 'modern', label: 'Moderno' },
  { value: 'discreet', label: 'Discreto' },
  { value: 'bold', label: 'Marcante' },
]

const MAINTENANCE_LEVELS = [
  { value: 'low', label: 'Baixa (prático no dia a dia)' },
  { value: 'medium', label: 'Média (finalização rápida)' },
  { value: 'high', label: 'Alta (modelagem e retoques frequentes)' },
]

const VISIT_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8]

function BudgetBadge({ withinBudget }) {
  if (typeof withinBudget !== 'boolean') return null
  return (
    <span className={`budget-pill ${withinBudget ? 'budget-ok' : 'budget-over'}`}>
      {withinBudget ? 'Dentro do orçamento' : 'Acima do orçamento'}
    </span>
  )
}

export function AssistantConsultation({ shops, session, role, retry, onBook, onLogin }) {
  const [shopId, setShopId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [hairType, setHairType] = useState('straight')
  const [hairLength, setHairLength] = useState('short')
  const [style, setStyle] = useState('modern')
  const [maintenance, setMaintenance] = useState('low')
  const [monthlyVisits, setMonthlyVisits] = useState(2)
  const [monthlyBudget, setMonthlyBudget] = useState('')
  const [preferences, setPreferences] = useState('')
  const [localRevision, setLocalRevision] = useState(0)

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [result, setResult] = useState(null)
  const [submittedBudget, setSubmittedBudget] = useState(null)

  const abortRef = useRef(null)
  const mountedRef = useRef(true)
  const resultsHeadingRef = useRef(null)

  const cancelPendingRecommendation = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    setSubmitting(false)
  }, [])

  const clearRecommendationOutput = useCallback(() => {
    cancelPendingRecommendation()
    setResult(null)
    setSubmitError('')
    setSubmittedBudget(null)
  }, [cancelPendingRecommendation])

  useEffect(() => {
    if (result) {
      resultsHeadingRef.current?.focus()
    }
  }, [result])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (abortRef.current) {
        abortRef.current.abort()
        abortRef.current = null
      }
    }
  }, [])

  // Cancela e limpa qualquer recomendação se o usuário sair da conta ou trocar de perfil.
  useEffect(() => {
    clearRecommendationOutput()
  }, [session?.access, role, clearRecommendationOutput])

  const loadStatus = useCallback((signal) => api.assistantStatus(signal), [])
  const status = useResource(`assistant-status/${localRevision}`, loadStatus)

  const selectedShop = shops.value?.find((item) => String(item.id) === String(shopId)) || null
  const activeShopId = selectedShop?.id

  const loadServices = useCallback((signal) => api.services(activeShopId, signal), [activeShopId])
  const loadPlans = useCallback((signal) => api.plans(activeShopId, signal), [activeShopId])

  const services = useResource(activeShopId && `assistant-services/${activeShopId}/${localRevision}`, loadServices)
  const publicPlans = useResource(activeShopId && `assistant-plans/${activeShopId}/${localRevision}`, loadPlans)

  const selectedService = services.value?.find((item) => String(item.id) === String(serviceId)) || null
  const servicePlans = publicPlans.value?.filter(
    (plan) => plan.active && (!selectedService || Number(plan.service_id) === Number(selectedService.id)),
  )

  const assistantAvailable = status.value?.available === true
  const assistantUnavailable = status.value?.available === false
  const isClient = Boolean(session) && role !== 'barbeiro'

  function handleShopChange(nextShopId) {
    setShopId(nextShopId)
    setServiceId('')
    clearRecommendationOutput()
  }

  function handleFieldChange(setter) {
    return (event) => {
      setter(event.target.value)
      clearRecommendationOutput()
    }
  }

  function retryAll() {
    clearRecommendationOutput()
    setLocalRevision((value) => value + 1)
    retry?.()
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting) return

    if (!session || role === 'barbeiro') {
      onLogin('cliente')
      return
    }

    if (!selectedShop || !selectedService) {
      setSubmitError('Selecione uma barbearia e um serviço para receber a consultoria.')
      return
    }

    if (assistantUnavailable) {
      setSubmitError('A consultoria inteligente não está disponível neste momento.')
      return
    }

    const visitsNum = Number(monthlyVisits)
    if (!Number.isInteger(visitsNum) || visitsNum < 1 || visitsNum > 8) {
      setSubmitError('Informe entre 1 e 8 visitas mensais.')
      return
    }

    let formattedBudget = null
    const rawBudget = monthlyBudget.trim().replace(',', '.')
    if (rawBudget !== '') {
      const parsed = Number(rawBudget)
      if (!Number.isFinite(parsed) || parsed < 0) {
        setSubmitError('Informe um orçamento mensal válido maior ou igual a zero ou deixe o campo em branco.')
        return
      }
      formattedBudget = parsed.toFixed(2)
    }

    const trimmedPreferences = preferences.trim()
    if (trimmedPreferences.length > 500) {
      setSubmitError('As preferências devem ter no máximo 500 caracteres.')
      return
    }

    cancelPendingRecommendation()
    const controller = new AbortController()
    abortRef.current = controller

    setSubmitting(true)
    setSubmitError('')

    try {
      const response = await api.recommendAssistant(
        {
          barbershop_id: Number(selectedShop.id),
          service_id: Number(selectedService.id),
          hair_type: hairType,
          hair_length: hairLength,
          style,
          maintenance,
          monthly_visits: visitsNum,
          monthly_budget: formattedBudget,
          preferences: trimmedPreferences,
        },
        controller.signal,
      )
      if (!mountedRef.current || controller.signal.aborted) return
      setSubmittedBudget(formattedBudget)
      setResult(response)
    } catch (error) {
      if (!mountedRef.current || error.name === 'AbortError' || controller.signal.aborted) return
      setSubmitError(error.message || 'Não foi possível gerar a recomendação agora. Tente novamente.')
    } finally {
      if (mountedRef.current && abortRef.current === controller) {
        abortRef.current = null
        setSubmitting(false)
      }
    }
  }

  const comparison = result?.comparison
  const recommendation = comparison?.recommendation
  const recommendedService = result?.service || selectedService
  const bookingShopId = Number(result?.service?.barbershop_id || selectedShop?.id || 0)
  const bookingServiceId = Number(result?.service?.id || selectedService?.id || 0)
  const hasBudgetContext = submittedBudget !== null && submittedBudget !== undefined

  return (
    <>
      <header className="page-heading">
        <div>
          <h1>Consultoria com IA</h1>
          <p>Descubra sugestões de cortes para o seu perfil e compare se vale mais a pena agendar avulso ou aderir a um plano mensal.</p>
        </div>
        {selectedShop && selectedService && (
          <button
            type="button"
            className="secondary"
            onClick={() => onBook({ shopId: selectedShop.id, serviceId: selectedService.id })}
          >
            <CalendarDays size={16} /> Agendar serviço selecionado
          </button>
        )}
      </header>

      {status.loading && <Notice>Verificando disponibilidade da consultoria inteligente…</Notice>}
      {status.error && (
        <Notice kind="error">
          {status.error.message}
          <button type="button" className="text-button" onClick={retryAll}>Tentar novamente</button>
        </Notice>
      )}
      {assistantUnavailable && (
        <Notice>
          A consultoria inteligente de cortes está temporariamente indisponível no momento. Você ainda pode consultar os serviços e planos das barbearias abaixo e realizar seu agendamento normalmente.
        </Notice>
      )}

      {!session && (
        <Notice>
          <span>Entre com sua conta de cliente para solicitar recomendações personalizadas de corte e comparativo de planos.</span>
          <button type="button" className="text-button" onClick={() => onLogin('cliente')}>Entrar como cliente</button>
        </Notice>
      )}

      {shops.loading && <Notice>Carregando barbearias…</Notice>}
      {shops.error && (
        <Notice kind="error">
          {shops.error.message}
          <button type="button" className="text-button" onClick={retryAll}>Tentar novamente</button>
        </Notice>
      )}
      {!shops.loading && !shops.error && shops.value?.length === 0 && (
        <Notice>Nenhuma barbearia cadastrada no momento para realizar a consultoria.</Notice>
      )}

      <div className="assistant-layout">
        <section className="live-column assistant-form-card" aria-labelledby="assistant-form-heading">
          <div className="panel-card-header">
            <h2 id="assistant-form-heading" className="section-title">
              <Sparkles size={19} aria-hidden="true" /> Seu perfil e objetivo
            </h2>
          </div>
          <p>Preencha as características do seu cabelo e a frequência desejada na barbearia.</p>

          <form onSubmit={handleSubmit} className="assistant-form" noValidate>
            {submitError && <Notice kind="error">{submitError}</Notice>}

            <div className="form-row">
              <label htmlFor="assistant-shop">
                Barbearia
                <select
                  id="assistant-shop"
                  required
                  disabled={shops.loading || !shops.value?.length}
                  value={selectedShop?.id ?? ''}
                  onChange={(event) => handleShopChange(event.target.value)}
                >
                  <option value="">Escolha uma barbearia</option>
                  {shops.value?.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}{item.owner?.nome ? ` · ${item.owner.nome}` : ''}
                    </option>
                  ))}
                </select>
              </label>

              <label htmlFor="assistant-service">
                Serviço / Corte desejado
                <select
                  id="assistant-service"
                  required
                  disabled={!selectedShop || services.loading || !services.value?.length}
                  value={selectedService?.id ?? ''}
                  onChange={handleFieldChange(setServiceId)}
                >
                  <option value="">
                    {!selectedShop
                      ? 'Selecione a barbearia primeiro'
                      : services.loading
                        ? 'Carregando serviços…'
                        : 'Escolha um serviço'}
                  </option>
                  {services.value?.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {money(item.price)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {selectedShop && services.error && (
              <Notice kind="error">
                {services.error.message}
                <button type="button" className="text-button" onClick={retryAll}>Tentar novamente</button>
              </Notice>
            )}
            {selectedShop && !services.loading && !services.error && services.value?.length === 0 && (
              <Notice>Esta barbearia ainda não possui serviços cadastrados para consultoria.</Notice>
            )}

            <div className="form-row">
              <label htmlFor="assistant-hair-type">
                Tipo de cabelo
                <select id="assistant-hair-type" value={hairType} onChange={handleFieldChange(setHairType)}>
                  {HAIR_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label htmlFor="assistant-hair-length">
                Comprimento do cabelo
                <select id="assistant-hair-length" value={hairLength} onChange={handleFieldChange(setHairLength)}>
                  {HAIR_LENGTHS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="form-row">
              <label htmlFor="assistant-style">
                Estilo desejado
                <select id="assistant-style" value={style} onChange={handleFieldChange(setStyle)}>
                  {STYLES.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label htmlFor="assistant-maintenance">
                Rotina de manutenção
                <select id="assistant-maintenance" value={maintenance} onChange={handleFieldChange(setMaintenance)}>
                  {MAINTENANCE_LEVELS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="form-row">
              <label htmlFor="assistant-visits">
                Visitas por mês
                <select
                  id="assistant-visits"
                  value={monthlyVisits}
                  onChange={(event) => {
                    setMonthlyVisits(Number(event.target.value))
                    clearRecommendationOutput()
                  }}
                >
                  {VISIT_OPTIONS.map((count) => (
                    <option key={count} value={count}>
                      {count} {count === 1 ? 'visita por mês' : 'visitas por mês'}
                    </option>
                  ))}
                </select>
              </label>

              <label htmlFor="assistant-budget">
                Orçamento mensal em R$ <span className="form-hint">(opcional)</span>
                <input
                  id="assistant-budget"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder="Ex.: 150.00"
                  value={monthlyBudget}
                  onChange={handleFieldChange(setMonthlyBudget)}
                />
              </label>
            </div>

            <label htmlFor="assistant-preferences">
              Preferências e detalhes do visual <span className="form-hint">(opcional, máx. 500 caracteres)</span>
              <textarea
                id="assistant-preferences"
                rows={3}
                maxLength={500}
                placeholder="Ex.: Gosto das laterais mais baixas em degradê, topo texturizado e acabamento natural."
                value={preferences}
                onChange={handleFieldChange(setPreferences)}
              />
              <span className="form-hint char-counter">{preferences.length}/500 caracteres</span>
            </label>

            <div className="assistant-privacy-note" role="note">
              <Info size={16} aria-hidden="true" />
              <div>
                <p>Ao clicar no botão abaixo, as preferências preenchidas neste formulário serão enviadas ao assistente para elaborar sua sugestão.</p>
                <p>As recomendações são uma orientação inicial para conversar e alinhar o corte ideal diretamente com seu barbeiro.</p>
              </div>
            </div>

            {!isClient ? (
              <button
                type="button"
                className="primary form-submit"
                onClick={() => onLogin('cliente')}
              >
                Entrar como cliente para consultar IA
              </button>
            ) : (
              <button
                type="submit"
                className="primary form-submit"
                disabled={submitting || status.loading || assistantUnavailable || !shops.value?.length}
              >
                <Sparkles size={16} />
                {submitting ? 'Analisando seu perfil e planos…' : 'Receber recomendação de corte e plano'}
              </button>
            )}
          </form>
        </section>

        <section className="live-column assistant-context-card" aria-labelledby="assistant-plans-preview-heading">
          <h2 id="assistant-plans-preview-heading" className="section-title">
            <Ticket size={19} aria-hidden="true" /> Planos da barbearia selecionada
          </h2>
          {!selectedShop && (
            <Notice>Escolha uma barbearia no formulário para visualizar os planos mensais disponíveis e simular sua consultoria.</Notice>
          )}
          {selectedShop && publicPlans.loading && <Notice>Carregando planos mensais da barbearia…</Notice>}
          {selectedShop && publicPlans.error && (
            <Notice kind="error">
              {publicPlans.error.message}
              <button type="button" className="text-button" onClick={retryAll}>Tentar novamente</button>
            </Notice>
          )}
          {selectedShop && !publicPlans.loading && !publicPlans.error && publicPlans.value?.length === 0 && (
            <Notice>
              Esta barbearia ainda não cadastrou planos mensais. A análise financeira calculará o valor dos seus atendimentos no modelo avulso.
            </Notice>
          )}
          {selectedShop && !publicPlans.loading && !publicPlans.error && publicPlans.value?.length > 0 && servicePlans?.length === 0 && (
            <Notice>
              Não há planos mensais ativos vinculados a este serviço específico. O cálculo comparativo considerará o valor avulso de {selectedService ? money(selectedService.price) : 'atendimento'}.
            </Notice>
          )}
          {selectedShop && servicePlans?.length > 0 && (
            <div className="plan-preview-list">
              <p className="form-hint">
                {selectedService
                  ? `Planos ativos para ${selectedService.name} em ${selectedShop.name}:`
                  : `Planos mensais ativos em ${selectedShop.name}:`}
              </p>
              {servicePlans.map((plan) => {
                const svc = services.value?.find((item) => Number(item.id) === Number(plan.service_id))
                return (
                  <article className="plan-preview-item" key={plan.id}>
                    <div>
                      <strong>{plan.name}</strong>
                      <small>
                        {svc ? `${svc.name} · ` : ''}
                        {plan.includedVisits} {plan.includedVisits === 1 ? 'atendimento incluso/mês' : 'atendimentos inclusos/mês'}
                      </small>
                      {plan.description && <p>{plan.description}</p>}
                    </div>
                    <span className="plan-preview-price">{money(plan.monthlyPrice)}<small>/mês</small></span>
                  </article>
                )
              })}
              <p className="form-hint">
                Visitas além da franquia mensal do plano são calculadas pelo valor avulso do serviço.
              </p>
            </div>
          )}

          {selectedShop && selectedService && (
            <div className="selected-service-summary">
              <div>
                <span className="form-hint">Simulação atual</span>
                <strong>{selectedService.name} · {money(selectedService.price)} por visita avulsa</strong>
                <small>{monthlyVisits} {monthlyVisits === 1 ? 'visita planejada' : 'visitas planejadas'} por mês em {selectedShop.name}</small>
              </div>
              <button
                type="button"
                className="secondary"
                onClick={() => onBook({ shopId: selectedShop.id, serviceId: selectedService.id })}
              >
                Agendar agora
              </button>
            </div>
          )}
        </section>
      </div>

      {result && (
        <section className="assistant-results" aria-labelledby="assistant-results-heading" aria-live="polite">
          <div className="assistant-summary-card">
            <div className="assistant-summary-header">
              <div>
                <span className="role-pill"><Sparkles size={13} /> Consultoria personalizada</span>
                <h2 id="assistant-results-heading" ref={resultsHeadingRef} tabIndex={-1}>
                  Sugestões de corte e análise de economia
                </h2>
              </div>
              {bookingShopId > 0 && bookingServiceId > 0 && (
                <button
                  type="button"
                  className="primary"
                  onClick={() => onBook({ shopId: bookingShopId, serviceId: bookingServiceId })}
                >
                  <CalendarDays size={16} /> Agendar {recommendedService?.name || 'atendimento'}
                </button>
              )}
            </div>

            <p className="assistant-summary-text">{result.summary}</p>

            <div className="assistant-disclaimer">
              <Info size={16} aria-hidden="true" />
              <span>
                Use estas recomendações como ponto de partida para conversar com seu barbeiro na cadeira e ajustar o corte ao formato do seu rosto.
              </span>
            </div>
          </div>

          <div className="assistant-section-block">
            <div className="agenda-heading">
              <div>
                <h2>Cortes recomendados</h2>
                <p>Opções selecionadas de acordo com seu tipo de cabelo, estilo e tempo de manutenção.</p>
              </div>
            </div>
            <div className="catalog-grid haircuts-grid">
              {result.haircuts?.map((item, index) => (
                <article className="catalog-card haircut-card" key={`${item.name}-${index}`}>
                  <div className="haircut-card-top">
                    <span className="metric-icon blue"><Scissors size={18} /></span>
                    <span className="haircut-badge">Sugestão {index + 1}</span>
                  </div>
                  <h3>{item.name}</h3>
                  <div className="haircut-details">
                    <p><strong>Por que combina com você:</strong> {item.reason}</p>
                    <p><strong>Cuidados e manutenção:</strong> {item.maintenance}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>

          {comparison && (
            <div className="assistant-section-block" aria-labelledby="comparison-heading">
              <div className="agenda-heading">
                <div>
                  <h2 id="comparison-heading">Comparação de valores: avulso vs. planos</h2>
                  <p>
                    Cálculo oficial para {comparison.monthly_visits}{' '}
                    {comparison.monthly_visits === 1 ? 'atendimento mensal' : 'atendimentos mensais'} de{' '}
                    <strong>{result.service?.name || selectedService?.name}</strong> (avulso: {money(Number(result.service?.price ?? selectedService?.price ?? 0))})
                    {hasBudgetContext ? ` · Orçamento informado: ${money(Number(submittedBudget))}` : ''}
                  </p>
                </div>
              </div>

              {recommendation && (
                <article className="recommendation-banner" aria-label="Recomendação mais econômica">
                  <div className="recommendation-banner-main">
                    <span className="metric-icon green"><Coins size={20} /></span>
                    <div>
                      <div className="recommendation-badges">
                        <span className="role-pill">Opção mais econômica</span>
                        {hasBudgetContext && <BudgetBadge withinBudget={recommendation.within_budget} />}
                      </div>
                      <h3>
                        {recommendation.kind === 'plan'
                          ? `Plano recomendado: ${recommendation.name}`
                          : `Melhor escolha: ${recommendation.name || 'Atendimento avulso'}`}
                      </h3>
                      <p>{recommendation.reason}</p>
                    </div>
                  </div>
                  <div className="recommendation-banner-price">
                    <span>Total estimado no mês</span>
                    <strong>{money(Number(recommendation.estimated_total))}</strong>
                    {bookingShopId > 0 && bookingServiceId > 0 && (
                      <button
                        type="button"
                        className="primary"
                        onClick={() => onBook({ shopId: bookingShopId, serviceId: bookingServiceId })}
                      >
                        Agendar este serviço
                      </button>
                    )}
                  </div>
                </article>
              )}

              {(!comparison.plans || comparison.plans.length === 0) && (
                <Notice>
                  Esta barbearia não possui planos mensais cadastrados para o serviço selecionado. O comparativo abaixo apresenta o valor total para atendimentos avulsos.
                </Notice>
              )}

              <div className="catalog-grid comparison-grid">
                <article
                  className={`catalog-card comparison-card ${recommendation?.kind === 'pay_as_you_go' ? 'comparison-recommended' : ''}`}
                >
                  <div className="comparison-card-top">
                    <span className="metric-icon sky"><Store size={18} /></span>
                    <div className="recommendation-badges">
                      {recommendation?.kind === 'pay_as_you_go' && (
                        <span className="role-pill"><Check size={12} /> Mais econômico</span>
                      )}
                      {hasBudgetContext && (
                        <BudgetBadge
                          withinBudget={
                            recommendation?.kind === 'pay_as_you_go' && typeof recommendation.within_budget === 'boolean'
                              ? recommendation.within_budget
                              : Number(comparison.pay_as_you_go_total) <= Number(submittedBudget)
                          }
                        />
                      )}
                    </div>
                  </div>
                  <h3>Atendimento avulso</h3>
                  <p className="comparison-subtitle">
                    Pagamento por visita realizada ({comparison.monthly_visits}x de {money(Number(result.service?.price ?? selectedService?.price ?? 0))})
                  </p>
                  <div className="comparison-breakdown">
                    <div>
                      <span>Visitas no mês</span>
                      <strong>{comparison.monthly_visits} {comparison.monthly_visits === 1 ? 'atendimento' : 'atendimentos'}</strong>
                    </div>
                    <div>
                      <span>Total mensal estimado</span>
                      <strong className="comparison-total">{money(Number(comparison.pay_as_you_go_total))}</strong>
                    </div>
                  </div>
                </article>

                {comparison.plans?.map((plan) => {
                  const isRecommendedPlan =
                    recommendation?.kind === 'plan' && Number(recommendation.plan_id) === Number(plan.id)
                  const visits = Number(comparison.monthly_visits)
                  const included = Number(plan.included_visits)
                  const extraVisits = Math.max(0, visits - included)
                  const savingsNum = Number(plan.savings)
                  const unitPrice = Number(result.service?.price ?? selectedService?.price ?? 0)

                  return (
                    <article
                      key={plan.id}
                      className={`catalog-card comparison-card ${isRecommendedPlan ? 'comparison-recommended' : ''}`}
                    >
                      <div className="comparison-card-top">
                        <span className="metric-icon teal"><Ticket size={18} /></span>
                        <div className="recommendation-badges">
                          {isRecommendedPlan && (
                            <span className="role-pill"><Check size={12} /> Mais econômico</span>
                          )}
                          {hasBudgetContext && <BudgetBadge withinBudget={plan.within_budget} />}
                        </div>
                      </div>
                      <h3>{plan.name}</h3>
                      <p className="comparison-subtitle">
                        Mensalidade fixa de {money(Number(plan.monthly_price))} com {included}{' '}
                        {included === 1 ? 'atendimento incluso' : 'atendimentos inclusos'}
                      </p>

                      <div className="comparison-breakdown">
                        <div>
                          <span>Franquia do plano</span>
                          <strong>{included} {included === 1 ? 'visita/mês' : 'visitas/mês'}</strong>
                        </div>
                        <div>
                          <span>Visitas extras ({extraVisits})</span>
                          <strong>
                            {extraVisits > 0
                              ? `+${money(extraVisits * unitPrice)} (${extraVisits}x avulso)`
                              : 'Sem custo extra'}
                          </strong>
                        </div>
                        <div>
                          <span>Total mensal estimado</span>
                          <strong className="comparison-total">{money(Number(plan.estimated_total))}</strong>
                        </div>
                      </div>

                      <div className="comparison-footer">
                        {savingsNum > 0 ? (
                          <span className="savings-positive">
                            Economia de {money(savingsNum)}/mês em relação ao avulso
                          </span>
                        ) : savingsNum < 0 ? (
                          <span className="savings-neutral">
                            {money(Math.abs(savingsNum))} acima do avulso para {visits} {visits === 1 ? 'visita' : 'visitas'}/mês
                          </span>
                        ) : (
                          <span className="savings-neutral">Mesmo custo total do atendimento avulso</span>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            </div>
          )}
        </section>
      )}
    </>
  )
}
