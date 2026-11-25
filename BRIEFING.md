# Briefing — Barbear Django

## Visão do produto

Uma plataforma para aproximar clientes e barbearias: o cliente encontra um estabelecimento, consulta serviços e escolhe um horário; a barbearia organiza sua oferta e acompanha a agenda. O backend existente fornece a base dessa experiência, mas ainda precisa de ajustes para atender todo o fluxo do cliente.

## Problema e proposta de valor

O produto pode reduzir a troca de mensagens para marcar atendimentos, tornar preços e horários visíveis e reunir os agendamentos em um só lugar. Para o cliente, a proposta é reservar com poucos passos. Para o estabelecimento, é ter previsibilidade da agenda e menos trabalho manual.

## Perfis

| Perfil | Experiência desejada | Situação atual |
| --- | --- | --- |
| Visitante | Explorar barbearias, serviços e disponibilidade | Listagens e horários disponíveis são públicos |
| Cliente | Cadastrar-se, entrar, reservar e acompanhar atendimentos | Cadastro e JWT existem; permissões de agendamento ainda exigem barbeiro |
| Barbeiro/dono | Administrar estabelecimento, serviços e agenda | Há cadastro e edição de barbearias; gestão de serviços e agenda precisa de correções |
| Administrador | Preparar dados e administrar a plataforma | Django Admin com os modelos cadastrados |

Hoje só existem os tipos `1 = cliente` e `2 = barbeiro`. Dono e profissional não são papéis separados. Um superusuário do Django não recebe automaticamente um perfil `Usuario` de barbeiro.

## Escopo implementado

- Backend Django/DRF com PostgreSQL e banco local em Docker Compose.
- Login e renovação de tokens JWT.
- Cadastro de usuários vinculado ao usuário nativo do Django.
- Listagem pública de barbearias e serviços por estabelecimento.
- Cadastro e atualização completa de barbearias por barbeiros.
- Consulta pública de horários em intervalos de 20 minutos.
- Criação, consulta e cancelamento de agendamentos para barbeiros, com limitações de autorização e escopo.
- Administração de usuários, barbearias, serviços e agendamentos pelo Django Admin.

Não há frontend, pagamentos, notificações ou relatórios implementados.

## Jornada proposta para o MVP

1. Visitante consulta barbearias e escolhe um estabelecimento.
2. Consulta serviços, preços e informações de funcionamento.
3. Seleciona serviço, data e horário.
4. Entra ou cria uma conta de cliente.
5. Confirma a reserva e recebe uma confirmação na tela.
6. Acompanha e cancela seus próprios agendamentos.
7. Dono consulta a agenda do estabelecimento e mantém seus serviços.

Os passos de reserva por clientes, agenda do estabelecimento e gestão completa de serviços dependem das correções abaixo. Esta é a jornada proposta, não uma descrição de um fluxo já completo.

## Prioridades antes de conectar o frontend

| Prioridade | Entrega | Motivo |
| --- | --- | --- |
| P0 | Permitir reserva e consulta dos próprios agendamentos por clientes | Desbloquear o fluxo central |
| P0 | Autorizar leitura, edição e exclusão por proprietário | Impedir acesso aos dados de outras contas e estabelecimentos |
| P0 | Corrigir ações dos ViewSets e serializers de escrita | Métodos `patch` e `delete` personalizados não são as ações usadas pelo router |
| P0 | Cadastrar serviços aceitando a barbearia e validando o dono | O serializer atual não recebe a relação obrigatória |
| P0 | Disponibilidade e conflitos por estabelecimento/profissional | Hoje um horário ocupado bloqueia todas as barbearias |
| P0 | Validar data, funcionamento e intervalo no backend | A criação direta não executa os validadores do modelo automaticamente |
| P0 | Retornar o tipo de usuário em `/usuario/me/` e exigir autenticação | Permitir navegação por perfil de forma consistente |
| P0 | Configurar CORS e padronizar erros e status HTTP | Evitar falhas de integração e falsas confirmações na interface |
| P1 | Publicar detalhe público de barbearia e serviço | Permitir acesso direto às páginas por URL |
| P1 | Testar cadastro, autenticação, reservas e permissões | Proteger os fluxos essenciais antes do lançamento |

## Funcionalidades que podem ser adicionadas

| Etapa | Funcionalidade | Valor e dependências |
| --- | --- | --- |
| MVP | Agenda diária/semanal com filtro por data | Visão operacional; exige consulta por estabelecimento |
| MVP | Status: confirmado, concluído, cancelado e não compareceu | Preservar histórico; hoje cancelar apaga o registro |
| MVP | Remarcação | Evitar cancelar e preencher tudo novamente; exige validação de conflito |
| MVP | Perfil com foto, descrição e contatos da barbearia | Dar contexto para a escolha; exige novos campos e upload |
| Evolução | Duração por serviço e intervalos entre atendimentos | Disponibilidade coerente para serviços de durações diferentes |
| Evolução | Equipe e escolha do profissional | Atendimentos simultâneos; exige vínculo entre equipe, barbearia e reserva |
| Evolução | Expediente semanal, almoço, feriados e bloqueios | Agenda que reflita a operação real |
| Evolução | Lembretes e confirmações por email ou WhatsApp | Reduzir esquecimentos; exige integração de envio |
| Evolução | Busca por nome, bairro e faixa de preço | Ajudar a encontrar o estabelecimento; exige filtros e dados estruturados |
| Evolução | Recuperação de senha e verificação de email | Completar o ciclo de acesso à conta |
| Expansão | Favoritos, avaliações após atendimento e portfólio | Incentivar retorno e ajudar na escolha |
| Expansão | Sinal, pagamento online e política de cancelamento | Reduzir faltas; exige provedor e controle de pagamento |
| Expansão | Receita, ocupação e clientes recorrentes | Apoiar decisões; exige histórico e preço registrado na reserva |
| Expansão | Fidelidade e pacotes de serviços | Incentivar recorrência após validar o uso do produto |

## Direção para o frontend

Priorizar uso no celular, com navegação curta e botões claros para escolher serviço e horário. Mostrar preço, data e estabelecimento antes da confirmação. Separar a experiência de reserva da área de gestão, conforme o perfil retornado pela API.

Telas iniciais propostas:

| Tela | Conteúdo principal |
| --- | --- |
| Explorar | Lista de barbearias e estado vazio |
| Barbearia | Contatos, expediente e catálogo de serviços |
| Entrar/cadastrar | Formulários e erros por campo |
| Reservar | Serviço, calendário, horários e resumo |
| Meus agendamentos | Próximos atendimentos e cancelamento |
| Meu perfil | Dados pessoais e saída da conta |
| Painel do estabelecimento | Agenda, barbearia e serviços |

Implementar estados de carregamento, erro de conexão, sessão expirada, lista vazia e horário ocupado durante a confirmação. Valores monetários devem aparecer em reais; datas na interface em `DD/MM/AAAA`, enviadas à API em `YYYY-MM-DD`.

## Critérios de sucesso do MVP

- Cliente consegue reservar e consultar a própria reserva pelo celular.
- Uma conta não altera dados de outra conta ou de outro estabelecimento.
- Duas reservas simultâneas não ocupam o mesmo profissional no mesmo período.
- Estabelecimentos diferentes conseguem atender no mesmo horário.
- A agenda do dono corresponde às reservas recebidas.
- Erros não aparecem como confirmação de sucesso.

Métricas sugeridas para acompanhar depois: conclusão do fluxo de reserva, cancelamentos, faltas, ocupação por profissional e retorno dos clientes. Não há coleta dessas métricas hoje.

## Ordem sugerida de execução

1. Ajustar o contrato e as regras P0 do backend.
2. Construir catálogo, cadastro e login do frontend.
3. Integrar reserva, meus agendamentos e cancelamento.
4. Integrar gestão do estabelecimento e agenda.
5. Adicionar status, remarcação e lembretes.
6. Avaliar pagamentos e recursos de fidelização conforme o uso.

Consulte o [README](README.md) para os contratos atuais, exemplos e instruções de execução.
