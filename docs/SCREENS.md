# AXXA OS — Mapa de telas para revisão manual (v0.1.239)

Checklist de TODAS as superfícies do plugin, com o caminho pra chegar em cada
uma. Marque conforme revisar. Dica: teste em dark E light, e no mobile também
(navbar, teclado, safe-area).

## A. Primeiro uso
- [ ] **A1. Onboarding** — instale sem nenhuma key e abra a view. CTA "Add my
      first key" (não marca como visto; cancelar as Settings traz de volta) ·
      "Skip for now" (dispensa sem celebração). Composer fica oculto.
- [ ] **A2. Primeiro chat pós-key** — adicione a key de um provider que NÃO é
      o OpenAI (ex.: Gemini) e volte: o chip ativo troca sozinho (Notice) e
      chips sem key mostram "— no key".

## B. Conversa (o coração)
- [ ] **B1. New chat** (gaveta → New chat) — saudação, seletor de provider com
      pílula deslizante no ativo, balões de sugestão, composer pill.
- [ ] **B2. New Q&A** (gaveta → New Q&A) — chip do índice semântico ("ready ·
      N chunks" verde, ou "Build it →" linkando Settings→Vault), sugestões em
      chips, composer card glassy DENTRO do painel.
- [ ] **B3. New Agent** (gaveta → New Agent) — cards de sugestão com fade na
      borda + scroll-snap, composer card.
- [ ] **B4. Chat ativo** — stream com "Pensando…", reasoning colapsável,
      day separators, timestamps, ações da resposta (copiar/salvar/TTS/regen/
      like/dislike), variantes ‹N/M›, day separator, back-to-bottom.
- [ ] **B5. Status row do composer** — chips model/effort/in/out/speed
      (curados em Settings → Appearance → Chips; desmarcar some na hora).
- [ ] **B6. Envio com anexos** — imagem (paste/attach), nota via [[, áudio
      hold-to-record (tap curto mostra dica; envio vira wikilink + aviso
      honesto), envio SÓ com anexo (botão vira send).
- [ ] **B7. Stop** — no meio do stream (resposta parcial ganha "Continuar"),
      no Agent (para entre tools, ações ficam registradas), na geração de
      imagem (descarta + aviso de cobrança).
- [ ] **B8. Erros** — sem key (bolha com "Open Settings"), key inválida,
      rate limit, contexto estourado ("Start new chat"), retry preservando
      anexos. Card nunca renderiza vazio.
- [ ] **B9. Regenerar/Continuar** — chat normal (variantes), vault-qa
      (refaz a busca — ver activity), agent (re-roda o turno com tools),
      modelo de geração (bloqueado com aviso). Regen que falha restaura a
      versão anterior (sem bolha vazia ‹2/2›).
- [ ] **B10. Header** — rename inline do título, busca in-chat (highlight
      visível), menu "..." (teclado: setas/Esc), switcher de modelo
      (aviso de sessão travada), copiar conversa (EN).

## C. Sheets e modais
- [ ] **C1. ModelSheet** (chip do modelo no composer) — favoritos
      (bookmark), efforts, thinking toggle (anuncia estado), aviso "abre
      conversa nova" quando travada.
- [ ] **C2. PlusModal** ("+") — attach, criar imagem, estilos de resposta,
      toggles com estado anunciado, explorar skills.
- [ ] **C3. ImageGenModal** — prompt editável, radiogroup por setas,
      IMG2IMG desmarca em modelo sem edição, preços por imagem.
- [ ] **C4. PersonaModal** ("..." → persona) — Cancelar existe; Clear só
      com persona salva (warning).
- [ ] **C5. RenameChatModal / ChatSearchModal / LinkSafetyModal /
      ConfirmModal** — todos acima do teclado no mobile.
- [ ] **C6. ConfirmationModal do Agent** — diff vermelho/verde, "Aprovar
      todas" (funciona em qualquer config), delete sempre pergunta.

## D. Navegação
- [ ] **D1. Sidebar** (avatar) — scrim escurece, foco preso (Tab circula,
      Esc fecha), New chat/Q&A/Agent, nav, Recents com filtros, emblema
      FOUNDER/Premium, footer conta.
- [ ] **D2. Conversas** (Ver todas) — busca (acha por "Sonnet 4.6"),
      filtros de modo (empty state correto), sort, agrupamento por data,
      menu de item (rename/delete→lixeira), FAB.
- [ ] **D3. Projects** — lista (empty com CTA), editor (cor/ícone com
      seleção visível, Done desabilitado visível, delete com confirmação),
      detail (abas Chats|Sources destacadas), "New chat in this project"
      (abandonar o fluxo não contamina outro chat).
- [ ] **D4. Media** — grid de imagens/áudio/vídeo do vault, filtro só-AXXA.
- [ ] **D5. Statistics** — Spend (billed com data-sharing, "*" pra custos
      desconhecidos), top models com nome bonito, CTA que abre a ABA Usage.
- [ ] **D6. Profile** — avatar visível, plano, providers, chats.
- [ ] **D7. Plans** — comparação Free/Pro, licença ("Pro active" só após
      Apply), nota "sales open soon".
- [ ] **D8. Locked** (free em tela Pro) — badge visível + "See plans".

## E. Modo Voz (gaveta ou composer)
- [ ] **E1. Intro** — 4 features (copy honesto sobre keys), Get started.
- [ ] **E2. Conversa** — orb com estados (pulso ouvindo, respiração
      falando), tap no orb interrompe fala OU geração, mic negado mostra
      erro acionável, tela não apaga (wake lock), Test voice não trava.

## F. Skills (PlusModal → Explore skills)
- [ ] **F1. Lista** — cards, Use/Open note, recarrega ao abrir.
- [ ] **F2. Empty** — CTA "Create example skills" funciona.
- [ ] **F3. Uso** — preserva rascunho digitado; mode inválido avisa;
      sessão travada avisa; /comandos no composer em EN.

## G. Settings (5 tabs)
- [ ] **G1. Connections → Providers** — 6 sub-tabs com logo+nome+ativo,
      key (keychain copy), badges de key, fetch de modelos, filtros EN,
      switch on/off visível, favoritos bookmark ≠ default star.
- [ ] **G2. Connections → Models** — papéis com ★ (fallback dos defaults
      legados; "no default" só no Reasoning), badge "Served by" clicável
      quando 2+ fontes, nome legível no mobile.
- [ ] **G3. Vault** — pastas (autocomplete), skills, RAG (index valida a
      key do provider CERTO, perfis de quantização EN, progresso, stats).
- [ ] **G4. Agent** — permissões (ask/vault/yolo AGEM diferente), toggle
      de diff (muda o preview), Effort levels (5 sub-tabs cabem no mobile,
      default = seu nível, digitação normal nos campos).
- [ ] **G5. Appearance** — Background (16 presets FUNCIONANDO), Chips
      (composer + listas), Interface (densidade/motion/reduce motion —
      desliga animações de verdade/code wrap).
- [ ] **G6. Usage** — cards (com nota de geração não contada), saldo SEM
      inflar com filtro de período, cross-check com aviso de janelas,
      tabelas, export MD/PDF.

## H. Transversais
- [ ] **H1. Dark ↔ light** em todas as acima.
- [ ] **H2. Densidade** compact/normal/large (listas/pills).
- [ ] **H3. Mobile** — navbar não coberta, teclado, safe-area, haptics.
- [ ] **H4. Teclado/leitor de tela** — foco visível, menus por setas,
      stream anunciado, switches com estado.

> Pendências conhecidas (registradas em UX_AUDIT.md): caminho Ollama no
> onboarding (P1-41) e preço/URL de venda do Pro (P1-45) — aguardam decisão
> de produto; custo de geração no Usage (P1-77) — disclosure no lugar.
