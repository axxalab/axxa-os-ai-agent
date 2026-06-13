# Checklist de validação pré-Alpha (#14)

> **Build atual: v0.1.228.** Lado automatizado em dia: `tsc` + `esbuild` limpos
> e **336 testes** passando; auditoria de código (311 achados) 100% resolvida —
> ver [AUDIT.md](AUDIT.md). O que segue exige **chaves reais** e device físico,
> então só você consegue marcar.

Só **você** consegue rodar isto (precisa das chaves reais). Marque cada um antes
de submeter. Recarregue o plugin antes de começar (pega a build mais nova).

## Por provider (chat + stream)

Pra cada um: cole a key, selecione um modelo, mande uma mensagem, confirme que
streama e que o custo aparece no Usage.

- [ ] **OpenAI** — chat streama; tokens/custo contam.
- [ ] **Anthropic (Claude)** — chat streama.
- [ ] **Gemini** — chat streama.
- [ ] **OpenRouter** — chat streama; **cross-check de billing real** funciona
      (Settings → Usage → "Cruzar com a API" → mostra uso + crédito).
- [ ] **Nvidia NIM** — chat responde (pseudo-stream via requestUrl).
- [ ] **Ollama** (se tiver local) — endpoint configurado, modelo responde.

## Fluxos-chave

- [ ] **Vault Q&A:** indexe o vault (Settings → Setup & RAG), pergunte algo →
      resposta cita `[[notas]]` clicáveis.
- [ ] **Agente:** peça pra criar/editar uma nota → aparece o **diff-approval** →
      aprovar grava; negar não grava.
- [ ] **Continuidade do agente:** abra um agente, saia pra outro chat, volte e
      diga "continue" → ele lembra o que fez.
- [ ] **Geração de imagem in-chat:** `+` → Criar imagem → escolhe modelo (preço +
      conectado) → imagem entra na conversa, salva no vault.
- [ ] **IMG2IMG (Nano Banana):** anexe uma imagem → Criar imagem → "editar
      anexada" → resultado editado.
- [ ] **Deletar conversa:** trash no item do Sidebar → vai pra lixeira.
- [ ] **Onboarding:** instale num vault sem key → tela de boas-vindas aparece.
- [ ] **Planos:** modo free (Settings → Plano = Free) → Mídia/Estatísticas
      mostram cadeado → "Ver planos" → cole `AXXA-PRO-TEST-2026` → vira Pro.

## Billing real (se tiver admin key)

- [ ] **OpenAI Admin key** no campo opcional → Usage "Cruzar" mostra gasto real
      (e por **projeto** se setar o Project ID).
- [ ] **Anthropic Admin key** → custos reais (⚠ marcado **experimental** — confirme
      se o número bate com o Console; se vier 0/errado, me avise pra ajustar o
      parser do `cost_report`).

## Plataforma

- [ ] **Desktop** — tudo OK.
- [ ] **Mobile** — composer, drawer, gravação de áudio, Usage responsivo (não
      estoura em tela estreita).

## Saída

Anote qualquer erro real (mensagem + provider + modelo) — esses são os
release-blockers que só aparecem com chave de verdade.
