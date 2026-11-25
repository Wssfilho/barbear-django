from decimal import Decimal


def money(value):
    return format(value.quantize(Decimal('0.01')), '.2f')


def compare(service, plans, visits, budget):
    base = service.Preco * visits
    fits = lambda total: budget is None or total <= budget
    rows = []
    best_total, best_plan = base, None
    for plan in plans:
        total = plan.monthly_price + max(0, visits - plan.included_visits) * service.Preco
        rows.append(dict(id=plan.id, name=plan.name, monthly_price=money(plan.monthly_price),
                         included_visits=plan.included_visits, estimated_total=money(total),
                         savings=money(base-total), within_budget=fits(total)))
        if total < best_total:
            best_total, best_plan = total, plan
    return dict(monthly_visits=visits, pay_as_you_go_total=money(base), plans=rows,
                recommendation=dict(kind='plan' if best_plan else 'pay_as_you_go',
                                    plan_id=best_plan.id if best_plan else None,
                                    name=best_plan.name if best_plan else 'Pagamento avulso',
                                    estimated_total=money(best_total), within_budget=fits(best_total),
                                    reason=('Este plano tem o menor custo estimado para a frequência informada, incluindo atendimentos extras a preço avulso.' if best_plan else
                                            'O pagamento avulso tem o menor custo estimado ou empata com os planos cadastrados.' if rows else
                                            'Não há planos ativos cadastrados para este serviço; a estimativa considera atendimentos avulsos.')))
