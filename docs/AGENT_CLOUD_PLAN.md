# AXXA Remote Agent — Planejamento de Produto (PM/PO)

> **Codinome:** `axxa-remote-agent` · **Status:** Planejamento aprovado — aguardando início da execução
> **Data:** 2026-07-23 · **Owner de produto:** Rafael (Axxa Lab) · **Documento vivo** — atualizar a cada milestone.

---

## 1. Visão

Transformar o AXXA OS — AI Agent em um **workspace de IA "Cowork-like" centrado no mobile**, onde o usuário conversa e despacha tarefas agênticas de qualquer dispositivo, e a execução pesada roda em um **runtime central (VPS "master")** operando diretamente sobre o vault — sem depender de um PC ligado.

**Frase de visão:** *"Seu vault com um Claude Code morando dentro dele — acessível do bolso."*

### O insight arquitetural

O usuário já sincroniza PC + mobile via **Self-hosted LiveSync (CouchDB)**. Isso significa que:

1. O **CouchDB já é um hub sempre-ligado** → vira a fila de mensagens de graça.
2. O **vault já é replicado** → vira o canal de transporte (protocolo por arquivos).
3. Um **VPS com livesync-bridge** materializa o vault em disco → o Claude Code opera sobre arquivos reais.
4. PC e mobile viram **thin clients simétricos**: só Obsidian + plugin AXXA.

```
                         VPS "MASTER"
        ┌─────────────────────────────────────────────┐
        │  CouchDB            ← hub de sincronização   │
        │  livesync-bridge    ← materializa o vault    │
        │  /vault/…           ← cópia canônica viva    │
        │  Watcher (Node)     ← observa _agent/inbox   │
        │  Claude Code + Skill← executa as tarefas     │
        └───────────┬──────────────────┬──────────────┘
                    │     LiveSync     │
          ┌─────────▼──────┐  ┌────────▼─────────┐
          │ PC (client)     │  │ Mobile (client)  │
          │ Obsidian + AXXA │  │ Obsidian + AXXA  │
          └─────────────────┘  └──────────────────┘
```

---

## 2. Problema & Oportunidade

### Problemas de hoje

| # | Problema | Evidência |
|---|----------|-----------|
| P1 | Trabalho agêntico pesado no mobile é caro e limitado (API key pay-per-use, contexto curto, sem workspace persistente) | Perfil de uso do usuário-alvo: **75% mobile / 25% desktop** |
| P2 | Assinatura Claude Pro/Max (já paga) não é aproveitável pelo plugin — só API key | Termos da Anthropic restringem assinatura ao Claude Code e apps oficiais |
| P3 | Soluções "Claude Code remoto" exigem PC ligado, rede configurada (Tailscale/portas) ou setup frágil (Termux) | Análise de alternativas (seção 11) |
| P4 | Não existe no mercado um "agente residente no vault" acessível do mobile com aprovação de mudanças | Diferencial competitivo |

### Oportunidade

- **Produto pessoal:** o próprio owner é o usuário 0 (dogfooding com infra já existente).
- **Feature paga:** o pacote VPS (CouchDB + bridge + runtime) é **exatamente o produto** de um tier pago futuro — "Vault na nuvem com agente residente", eliminando a necessidade de PC para qualquer cliente.

---

## 3. Personas

| Persona | Descrição | Necessidade principal |
|---------|-----------|----------------------|
| **Nômade mobile** (usuário 0) | Usa Obsidian 75% no celular, tem LiveSync self-hosted e assinatura Claude | Despachar tarefas agênticas do celular e receber resultado no vault |
| **Power user desktop** | Usa Claude Code no PC, quer o vault como workspace | Skill/convenções para o Claude Code "falar Obsidian" |
| **Cliente cloud (futuro)** | Não quer gerenciar servidor; quer "ligar e usar" | Tier pago: VPS gerenciado com agente residente |

---

## 4. Objetivos & Métricas de Sucesso

### Objetivos (6–12 semanas)

- **O1** — Enviar uma tarefa do mobile e receber o resultado no chat sem nenhum runtime local no celular.
- **O2** — Runtime servidor empacotado (Docker Compose) reproduzível em qualquer VPS em < 30 min de setup.
- **O3** — Toda edição destrutiva do agente passa por aprovação visível no mobile.
- **O4** — O mesmo protocolo serve 3 runtimes (VPS, plugin-desktop embutido, daemon avulso) sem mudança no client.

### Métricas (pós-MVP)

| Métrica | Alvo MVP | Como medir |
|---------|----------|------------|
| Latência ida-e-volta (mensagem → 1º token de resposta visível no mobile) | ≤ 20 s | timestamps no protocolo |
| Taxa de tarefas concluídas sem intervenção manual | ≥ 80% | status nos arquivos de outbox |
| Conflitos de sync causados pelo protocolo | 0 | monitor LiveSync |
| Setup do servidor do zero | ≤ 30 min | teste guiado |
| Uptime do watcher | ≥ 99% | healthcheck |

---

## 5. Escopo

### Dentro do escopo (esta iniciativa)

1. **Protocolo `_agent/`** — spec de comunicação por arquivos no vault.
2. **Runtime servidor** — watcher Node + Claude Code headless + Docker Compose (CouchDB + livesync-bridge + watcher).
3. **Skill Obsidian** — skill nossa que ensina o Claude Code a operar o vault (convenções, protocolo, aprovações).
4. **Modo thin-client no plugin** — novo "provider" virtual `Remote Agent` no chat existente (mobile e desktop).
5. **Fluxo de aprovação** — edições destrutivas pausam e aguardam allow/deny de qualquer device.
6. **Docs de setup** — guia self-hosted (usuário 0 e early adopters).

### Fora do escopo (registrado para depois)

| Item | Por quê ficou fora | Quando reavaliar |
|------|--------------------|------------------|
| Runtime embutido no plugin desktop (spawn do `claude` via Electron) | VPS master torna PC puro client; complexidade adiada | Fase 4 |
| Runtime Termux (Android local) | Setup frágil; caso de uso raro no perfil 75/25 | Se houver demanda |
| Tier pago gerenciado (billing, provisioning multi-tenant) | Precisa do MVP validado primeiro | Fase 5 |
| Streaming token-a-token real | LiveSync não é canal de streaming; usaremos atualização em blocos | Se UX exigir |
| Multi-vault por servidor | Complexidade multi-tenant | Fase 5 |
| Suporte a outros agentes (OpenRouter/router próprio no lugar do Claude Code) | Decisão em aberto (D3) | Fase 5 |

---

## 6. Arquitetura & Decisões Técnicas

### Componentes

| Componente | Tecnologia | Papel | Novo? |
|-----------|-----------|-------|-------|
| Hub de sync | CouchDB (self-hosted) | Fila + replicação | Já existe |
| Materializador | [livesync-bridge](https://github.com/vrtmrz/livesync-bridge) | CouchDB ↔ filesystem no VPS | Configurar |
| Runtime do agente | Claude Code CLI (headless `-p`, `--output-format stream-json`) | Executor das tarefas | Instalar |
| Watcher | Node/TypeScript (novo, pasta `server/`) | Observa inbox, orquestra Claude Code, escreve outbox, gerencia aprovações | **Construir** |
| Skill | `SKILL.md` + recursos (pasta `skills/obsidian-vault/` no repo) | Convenções do vault + protocolo | **Construir** |
| Thin client | Plugin AXXA (novo provider virtual) | UI de chat → arquivos do protocolo | **Construir** |

### Decisões tomadas

- **AD-1: Transporte = vault via LiveSync** (não HTTP/SSH direto). Justificativa: reusa infra, funciona atrás de NAT, fila assíncrona resiliente (requests sobrevivem a runtime offline), plugins mobile não têm TCP bruto.
- **AD-2: VPS master como topologia primária.** PC e mobile simétricos como clients. PC-como-runtime vira variante futura do mesmo protocolo.
- **AD-3: Arquivos append-only, um por mensagem/evento** (nunca editar arquivo de request) para eliminar conflitos LiveSync.
- **AD-4: Auth do runtime** = assinatura própria do usuário (login Claude Code no VPS) **ou** API key — configurável. Nunca assinatura compartilhada entre usuários (ToS).
- **AD-5: Aprovações fail-safe:** sem resposta de aprovação, a ação destrutiva **não** executa (timeout → tarefa pausada, não "auto-allow").

### Rascunho do protocolo `_agent/` (v0 — spec completa é a Story 1.1)

```
_agent/
  inbox/<ulid>.md          # request: frontmatter (id, ts, mode, device) + corpo = prompt
  outbox/<request-id>/
    response.md            # resposta em blocos (append) + frontmatter de status
    events.md              # log de eventos (tool calls, progresso)
  approvals/
    <request-id>-<n>.md    # pedido de aprovação (diff proposto) → client responde
                           # criando <request-id>-<n>.answer.md (allow|deny)
  state/
    runtime.md             # heartbeat do runtime (online/offline, versão, fila)
```

- Status do request: `queued → running → awaiting_approval → done | failed | cancelled`.
- Cancelamento: client cria `inbox/<id>.cancel.md`.
- Tudo é Markdown legível — o usuário pode auditar o histórico no próprio Obsidian (filosofia do plugin: everything is Markdown).

---

## 7. Épicos, Histórias e Critérios de Aceite

### Épico 1 — Protocolo `_agent/` (fundação)

| Story | Como… | Quero… | Critérios de aceite |
|-------|-------|--------|---------------------|
| 1.1 | dev | Spec formal do protocolo em `docs/AGENT_PROTOCOL.md` | Formatos de frontmatter definidos; máquina de estados; regras anti-conflito (append-only); versionamento do protocolo (`protocol: 1`) |
| 1.2 | usuário | Que a pasta `_agent/` não polua meu vault | Pasta configurável; oculta das buscas/graph por padrão (instrução na doc); housekeeping (retenção configurável de requests antigos) |

### Épico 2 — Runtime servidor (watcher + Claude Code)

| Story | Como… | Quero… | Critérios de aceite |
|-------|-------|--------|---------------------|
| 2.1 | usuário | Watcher que processa a fila | Detecta novo request em ≤ 2 s (fs events); processa em ordem; 1 tarefa por vez (concorrência configurável); sobrevive a restart sem perder/duplicar requests |
| 2.2 | usuário | Execução via Claude Code headless | Invoca `claude -p` com working dir do vault, skill carregada, permissões restritas ao vault; resposta em blocos no `response.md` (atualização incremental ≤ 5 s) |
| 2.3 | usuário | Aprovação de ações destrutivas | Edit/delete/move geram approval request com diff; execução pausa; allow/deny de qualquer device; timeout configurável → pausa (nunca auto-allow) |
| 2.4 | usuário | Resiliência e observabilidade | Heartbeat em `state/runtime.md` (≤ 60 s); erros viram status `failed` com mensagem legível; logs no servidor; healthcheck para systemd/Docker |
| 2.5 | operador | Pacote de deploy | `docker-compose.yml` com couchdb + livesync-bridge + watcher; `.env.example`; guia `docs/SERVER_SETUP.md` testado do zero em VPS limpo em ≤ 30 min |
| 2.6 | operador | Segurança mínima viável | CouchDB somente atrás de TLS + senha forte; watcher roda sem root; secrets fora do vault e fora do git; nota sobre backup do CouchDB |

### Épico 3 — Skill Obsidian (a "alma" do agente)

| Story | Como… | Quero… | Critérios de aceite |
|-------|-------|--------|---------------------|
| 3.1 | usuário | Skill que ensina o vault ao Claude Code | Wikilinks, frontmatter, tags, templates e estrutura de pastas respeitados; sabe escrever no protocolo `_agent/`; sabe quando pedir aprovação |
| 3.2 | usuário | Skill ciente do MEU vault | Watcher gera/atualiza um `VAULT_CONTEXT.md` (pastas, convenções, MOCs) consumido pela skill; regenerável sob demanda |
| 3.3 | dev | Skill versionada no repo | Pasta `skills/obsidian-vault/`; changelog; instalada automaticamente pelo deploy do servidor |

### Épico 4 — Thin client no plugin AXXA

| Story | Como… | Quero… | Critérios de aceite |
|-------|-------|--------|---------------------|
| 4.1 | usuário | "Remote Agent" como opção no chat | Aparece como provider/modo no seletor existente; envio cria request no inbox; UI mostra estado da fila (`queued/running/…`) |
| 4.2 | usuário mobile | Resposta renderizada no chat | Plugin observa outbox via eventos do vault (mudanças aplicadas pelo LiveSync); renderiza blocos incrementais; indicador "agente digitando" |
| 4.3 | usuário | Aprovações no chat | Approval request vira card com diff + botões Allow/Deny; resposta gravada no protocolo; funciona igual em mobile e desktop |
| 4.4 | usuário | Status do runtime visível | Indicador online/offline (via heartbeat); mensagem clara quando runtime está off ("tarefa ficará na fila") |
| 4.5 | usuário | Fallback natural | Se runtime offline e usuário quer resposta imediata, 1 toque para reenviar a mesma mensagem a um provider API-key normal |
| 4.6 | usuário | Histórico unificado | Conversa do Remote Agent salva como chat `.md` no vault, igual aos outros modos |

### Épico 5 — Produtização cloud (futuro, pós-validação)

| Story | Resumo |
|-------|--------|
| 5.1 | Provisioning automatizado de instância por cliente (1 vault = 1 stack isolada) |
| 5.2 | Onboarding: cliente conecta própria API key ou faz próprio login Claude Code (nunca assinatura compartilhada — ToS) |
| 5.3 | Billing (assinatura do serviço) + limites de uso |
| 5.4 | Decisão de router multi-modelo (Claude Code vs router próprio/OpenRouter) |
| 5.5 | Hardening multi-tenant, backups gerenciados, painel de status |

---

## 8. Roadmap & Milestones

**Premissa de esforço:** desenvolvimento por agente (Claude Code) com revisão do owner; fases sequenciais com entregas utilizáveis por fase.

| Fase | Entrega | Conteúdo | Critério de saída ("demo") |
|------|---------|----------|---------------------------|
| **F1 — Fundação** | Protocolo + esqueleto | Stories 1.1, 1.2, spec + scaffolding `server/` | Spec revisada e aprovada pelo owner |
| **F2 — Runtime MVP** | Servidor funcional | Stories 2.1, 2.2, 2.5 (parcial), 3.1 | Do PC: criar request manualmente no vault → resposta aparece via sync |
| **F3 — Client MVP** | Loop completo mobile | Stories 4.1, 4.2, 4.4 | **Demo-chave:** enviar do celular pelo chat AXXA e ver a resposta chegar, PC desligado |
| **F4 — Confiança** | Aprovações + robustez | Stories 2.3, 2.4, 2.6, 4.3, 4.5, 3.2 | Tarefa destrutiva pausada e aprovada do celular; watcher sobrevive a reboot |
| **F5 — Polimento self-hosted** | Release early-adopter | 2.5 completo, 4.6, 3.3, docs finais | Terceiro consegue montar o stack só com a doc |
| **F6 — Cloud pago** | Produto | Épico 5 | Primeiro cliente externo onboarded |

**Ordem de execução imediata (próximas sessões de dev):** F1 → F2.

---

## 9. Riscos & Mitigações

| # | Risco | Prob. | Impacto | Mitigação |
|---|-------|-------|---------|-----------|
| R1 | **ToS Anthropic** — uso indevido de assinatura em serviço multi-usuário | Média | Alto | AD-4: assinatura só pessoal/por-cliente; tier cloud default = API key própria do cliente; revisar termos antes da F6 |
| R2 | **Conflitos LiveSync** corrompendo protocolo | Média | Médio | AD-3 append-only; arquivos pequenos; testes de conflito na F4 |
| R3 | **Segurança**: CouchDB exposto = vault inteiro exposto | Média | Alto | Story 2.6 obrigatória antes de qualquer uso real; TLS + senha forte + fail2ban |
| R4 | **Agente destrutivo** (edita/apaga errado) | Média | Alto | Aprovações fail-safe (AD-5); LiveSync guarda histórico de docs; recomendar backup CouchDB |
| R5 | **Latência frustra UX de chat** | Média | Médio | Posicionar Remote Agent para *tarefas*, não chat rápido; fallback API key (4.5); medir métrica de latência |
| R6 | **livesync-bridge** é projeto de terceiro (manutenção incerta) | Baixa | Médio | Isolar via Docker; plano B: réplica via cliente CouchDB próprio no watcher |
| R7 | **Claude Code headless muda de interface** (flags/output) | Baixa | Médio | Encapsular invocação num adapter único; testes de contrato; considerar Agent SDK como alternativa estável |
| R8 | Escopo crescer antes do MVP validar a hipótese | Alta | Médio | Este documento: fora-de-escopo explícito; demo-chave da F3 como gate |

---

## 10. Decisões em Aberto (para o owner)

| # | Decisão | Opções | Recomendação PM | Prazo |
|---|---------|--------|-----------------|-------|
| D1 | Nome da feature no produto | "Remote Agent" / "AXXA Cloud" / "Vault Agent" | Definir na F3 (naming afeta UI) | F3 |
| D2 | Auth padrão do runtime pessoal | Assinatura (login CC) vs API key | Assinatura para usuário 0; decidir default da doc self-hosted | F2 |
| D3 | Motor do tier cloud | Claude Code vs router próprio (OpenRouter etc.) | Adiar; abstrair executor no watcher para permitir ambos | F5/F6 |
| D4 | Pasta do protocolo visível ou "oculta" (`.agent/` não sincroniza bem no LiveSync — validar) | `_agent/` vs configurável | `_agent/` default + configurável | F1 |
| D5 | Retenção de histórico da fila | dias vs quantidade | 30 dias default configurável | F4 |

---

## 11. Alternativas Consideradas (registro)

| Alternativa | Por que não foi escolhida como primária |
|-------------|------------------------------------------|
| Assinatura Claude direto no plugin (OAuth) | Viola ToS Anthropic; risco de bloqueio; inviável para produto publicado |
| SSH do celular → PC (terminal) | Funciona manualmente hoje, mas UX de TUI em celular; sem integração com plugin (Capacitor não tem TCP bruto). Mantido como ferramenta de emergência |
| Ponte HTTP direta plugin → PC (Tailscale) | Exige PC ligado + configuração de rede por usuário; falha "hard" quando PC off (sem fila) |
| Termux (Claude Code no Android) | Setup frágil, Android-only, background kills. Reavaliável como runtime adicional do mesmo protocolo |
| Runtime embutido no plugin desktop (Electron spawn) | Bom, mas exige Obsidian aberto no PC; VPS master domina no perfil 75% mobile. Vira variante futura (F4+) |

---

## 12. Definition of Done (da iniciativa MVP = F1→F5)

- [ ] Do **mobile**, com o PC desligado: enviar tarefa → agente executa no VPS → resposta e edições aparecem no celular.
- [ ] Nenhuma ação destrutiva executada sem aprovação explícita.
- [ ] Stack do servidor sobe com `docker compose up` + doc de 30 min.
- [ ] Protocolo documentado e versionado; skill versionada no repo.
- [ ] Zero regressão nos modos existentes do plugin (Chat/Q&A/Agent com API key).
- [ ] Métricas da seção 4 medidas em uso real por ≥ 1 semana (usuário 0).

---

## 13. Glossário

| Termo | Significado |
|-------|-------------|
| **Runtime** | Processo que executa o agente (watcher + Claude Code) — no VPS, no PC ou futuro Termux |
| **Thin client** | Plugin AXXA atuando só como UI, sem executar agente localmente |
| **Protocolo `_agent/`** | Convenção de arquivos Markdown no vault usada como fila e canal de comunicação |
| **livesync-bridge** | Ferramenta que replica o CouchDB do LiveSync para um filesystem em servidor |
| **Skill** | Pacote de instruções (`SKILL.md`) que especializa o Claude Code para operar vaults Obsidian |
| **Usuário 0** | O owner do projeto, primeiro usuário real da arquitetura |
