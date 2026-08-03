# AXXA OS — Auditoria completa de produto (telas · fluxos · user stories)

> Auditoria integral conduzida em 2026-07-19 sobre a branch
> `claude/storybook-ux-review-plugin-fybzg0` (pós-limpeza + redesign das Settings).
> Norte: **qualidade de produto** — publicação é decisão do dono, não meta da
> auditoria. Decisões de produto respeitadas: fullscreen mobile retorna
> (setting reservado); monetização Free/Pro mantida.

## 0. Status do refazer (aplicado nesta branch)

**P0 — 7/7 implementados** (commit \`fix(p0)\`): pele do Modo Voz/editor de
projeto (overlays opacos + orb com estados), switch dos modelos com estado
visual, feature de Background revivida (var consumida), áudio honesto
(wikilink persistido + Notice), nonce global das skills.

**P1 — lote 1 implementado** (este commit):
- Estados invisíveis (CSS): highlight da busca in-chat, pílula do item ativo
  no segmented (provider/modo), scrim da gaveta, emblema Founder/Premium,
  aba ativa do projeto, cor/ícone selecionados no editor, \`Done\` disabled
  visível, avatar/badge do Profile/Locked, reduce-motion agora mata
  \`animation\` (só cobria \`transition\`).
- Integridade de dados: \`upsertChatSummary\` imutável (listas não ficam mais
  stale), flush do auto-save no unmount (fechar a view não perde mais o save
  pendente), abrir conversa antiga não regrava \`date=agora\` (histórico não
  reordena sozinho).
- Becos sem saída: card de erro com fallback por \`errorCode\` (nunca mais
  vazio), skip do onboarding não celebra mais "You're all set!" sem key.

**P1 — execução na ordem do documento (release 0.1.237+)**: **68 dos 93
P1 implementados** em 8 lotes commitados. Destaques por área:
- *Agent*: gate coerente (nível decide SE confirma; diff = preview),
  Stop interrompe tools, steps sobrevivem a abort/erro, superfície EN.
- *Composer*: status row revivida, envio attachment-only, dica do mic,
  aria-label no editor, live region de resposta.
- *Modelos por função*: fallback de leitura dos defaults legados, picker
  de fonte no badge "Served by", nome legível no mobile, busca por
  prettyModelName, bookmark=favorito unificado.
- *Erros*: context-overflow com CTA "Start new chat", retry preserva
  anexos, card nunca vazio, regeneração sem variante-fantasma.
- *Geração*: retry re-gera a imagem (não cai no chat), IMG2IMG honesto,
  Stop com soft-cancel avisando cobrança.
- *Voz*: barge-in no orb, erros de mic acionáveis, wake lock no modo
  inteiro, Test voice sem travar, copy de privacidade honesto.
- *Mobile/a11y*: modais keyboard-aware, menus do header por teclado,
  switches anunciam estado, radiogroup por setas, clearance da navbar
  consumindo a var certa.

**Lotes 9–12 (pós-release 0.1.238)**: P1-19 (composer Q&A absolute no
desktop + navbar no mobile), 45-interim ('sales open soon'), 48
(auto-switch de provider + badge 'no key'), 52→62 (focus trap sidebar),
65–68 (skills completas), 69/71/73 (Usage nav, Spend honesto, cards com
snap+fade), 72 (stop parcial marca truncated), 74 (modais keyboard-aware),
78 (key certa no index), 81–84 (Vault Q&A: citação não cria nota, origem
da busca visível, excerpt por effort, chip do índice na New Q&A),
85–87/89/91–93 (Modo Voz).

**Lote 13 (release 0.1.239)**: 57 (regenerate/continue agora despacham por
modo — agent re-roda o turno com tools, vault-qa refaz a busca híbrida antes
de regenerar, continue leva contexto do vault), 70 (Statistics usa o mesmo
computeBilledUsage do Usage — "Spend (billed)"), 75 (saldo calculado sobre o
agregado TOTAL, sem inflar com filtro de período), 76 (nota de janelas no
cross-check), 77-disclosure (nota honesta de que custos de geração de
imagem/áudio não entram no agregado), 88 (tap no orb durante 'thinking'
interrompe a geração). **Total: 91/93 P1 implementados.**

**P1 pendentes (1 — decisão de produto)**: 45-final (preço + URL da loja do
Pro). Backlog documentado: 77-completo (contabilizar custo de geração no
aggregate — feature L; o disclosure honesto já está no lugar).

**Lote de polimento (release 0.1.247)** — 5 pendências fechadas:
- **NOV-03 / P1-41** ✅ — bloco "Start free, no card" na NewChatScreen (só
  quando NENHUM provider tem key): Gemini free tier · OpenRouter free ·
  Ollama local, cada rota selecionando o provider e abrindo as Settings. As
  chaves i18n órfãs (`freeStartTitle`/`freeStartSub`/`trustLine`) ganharam
  consumidor e o README parou de prometer o que a UI não fazia.
- **CHT-12 (PDF)** 🟡 — *(superado pelo lote 2 / 0.1.248, abaixo)* o anexo continua sem ir pro wire, mas parou de
  enganar: aviso no momento do anexo, aviso no chip e linha persistida na
  mensagem (`> 📄 arquivo.pdf — not sent to the AI yet`), mesmo tratamento
  honesto que o áudio já tinha. O envio real virá num lote próprio.
- **SKL-03** ✅ — watcher do vault com debounce de 600ms recarrega as skills
  ao criar/editar/renomear/apagar `.md` na pasta configurada.
- **CHT-15 (ModelArena)** ✅ — decidido REMOVER: handler órfão
  (`handleArenaConfirm`) e bloco i18n `arena` saíram; docs/FEATURES.md agora
  diz que a arena está no backlog em vez de anunciá-la como entregue.
- **MOB-01 (fullscreen)** ✅ — entregue no 0.1.242→0.1.246 (v3: toggle no menu
  do header, 100vw × 100dvh, escopado ao drawer direito). Status abaixo
  mantido só como histórico da auditoria.

**Lote de polimento 2 (release 0.1.248)** — PDF anexado passa a ser ENVIADO:
- **CHT-12 (PDF)** ✅ — bloco `document` (Anthropic), content part `file`
  (OpenAI e OpenRouter) e plugin file-parser com engine explícito no
  OpenRouter — `native` quando o modelo tem visão, `cloudflare-ai` (grátis)
  no resto, nunca o default `mistral-ocr` cobrado por página. A capability
  `pdf` é derivada (`supportsPdf`) em vez de tabelada, então modelo novo
  entra sozinho. Gemini/NIM/Ollama seguem fora — limitação do transporte, e
  a UI diz isso com o nome do modelo na hora do anexo.
- Rastro na conversa virou de mão dupla: recibo quando o PDF foi enviado,
  aviso honesto quando não foi. Guard de 30MB antes de anexar (o limite de
  request é 32MB no Anthropic e o base64 infla ~33%).
- 27 testes novos cobrindo data URLs, a capability por família de modelo, o
  shape dos 3 wires e a escolha de engine do OpenRouter.

## 1. Método

- **Inventário**: 49 user stories formais (10 personas) com critérios de aceite e
  status verificado no código.
- **12 revisores de tela** — cada um leu o código E screenshots reais do
  storybook (dark/light, mobile/desktop).
- **12 revisores de fluxo** — jornadas completas traçadas de ponta a ponta no código.
- **Verificação adversarial**: cada achado P0/P1 passou por um cético
  independente instruído a REFUTÁ-LO no código antes de valer.
- **Crítico de completude** ao final.
- Harness: `npm run storybook` (17 stories, tema/densidade/viewport).

### Placar

| | Confirmados | Refutados | Sem veredito |
|---|---|---|---|
| P0 (quebra/engana) | 7 | — | — |
| P1 (fricção no caminho principal) | 93 | — | — |
| Total P0+P1 verificados | 100 | 1 | 1 |
| P2/P3 (polish, não verificados adversarialmente) | 176 | | |

## 2. User stories — inventário completo (49)

Status verificado no código (evidência arquivo:linha em cada uma).
Legenda: ✅ ok · 🟡 parcial · ⬜ faltando · 🔴 quebrado

### novato sem key (4/5 ok)

**NOV-01** ✅ — Como novato sem key, quero uma tela de boas-vindas no primeiro uso para entender o que o plugin faz e saber por onde começar.

**NOV-02** ✅ — Como novato, quero que minha API key fique no keychain do SO para não vazar via Obsidian Sync ou backup do vault.

**NOV-03** ✅ *(resolvido em 0.1.247; era 🟡)* — Como novato sem cartão, quero ver destacado o caminho grátis (Gemini free tier, modelos free do OpenRouter, Ollama local) para experimentar sem gastar.
> **Status resolvido:** bloco "Start free, no card" na NewChatScreen (src/components/chat/NewChatScreen.tsx), visível só enquanto NENHUM provider tem credencial. As 3 rotas viraram botões que selecionam o provider e abrem as Settings; as chaves i18n órfãs (freeStartTitle/freeStartSub/trustLine) finalmente têm consumidor.
> - [x] O onboarding/nova conversa destaca explicitamente as 3 rotas grátis
> - [x] Um toque leva à configuração da rota escolhida
> - [x] README ('Start free, no credit card') é cumprido na UI

**NOV-04** ✅ — Como novato, quero um erro acionável ao enviar sem key para saber exatamente como resolver.

**NOV-05** ✅ — Como usuário, quero ser avisado quando o combo modo+modelo é incompatível para não descobrir na base do erro 400.

### usuário diário de chat (14/17 ok)

**CHT-01** ✅ — Como usuário diário, quero respostas em streaming com indicador 'Pensando...' para sentir progresso imediato.

**CHT-02** ✅ — Como usuário diário, quero cada conversa salva como .md no vault (com reactions e passos do agente) para retomar depois e versionar.

**CHT-03** ✅ — Como usuário diário, quero regenerar uma resposta mantendo a anterior como variante para comparar gerações.

**CHT-04** ✅ — Como usuário diário, quero continuar uma resposta cortada no limite de tokens sem criar bolha nova.

**CHT-05** ✅ — Como usuário diário, quero editar minha mensagem (replay) e deletar mensagens para corrigir o rumo da conversa.

**CHT-06** ✅ — Como usuário diário, quero buscar dentro da conversa atual para achar um trecho antigo rapidamente.

**CHT-07** ✅ — Como usuário diário, quero que a 1ª mensagem trave provider/modelo/modo da sessão, e que trocar de modelo no header inicie uma conversa nova, para manter consistência de contexto.

**CHT-08** ✅ — Como usuário diário, quero listar, renomear e deletar conversas (com lixeira) para manter o histórico organizado.

**CHT-09** ✅ — Como usuário diário, quero salvar uma resposta da IA como nota nova no vault e abri-la em seguida.

**CHT-10** ✅ — Como usuário diário, quero uma persona por chat e um estilo de resposta global para moldar o tom das respostas.

**CHT-11** ✅ — Como usuário diário, quero anexar notas do vault (via [[, @ ou picker) para dar contexto ao modelo.

**CHT-12** 🟡 *(PDF resolvido em 0.1.248; áudio segue pendente. Era 🔴)* — Como usuário diário, quero anexar PDF (e áudio) e ter o conteúdo realmente enviado ao modelo.
> **Status do PDF — resolvido:** o arquivo vai pro wire de verdade onde o transporte permite — bloco `document` base64 no Anthropic (Claude 3.5+), content part `file` no Chat Completions da OpenAI (modelos com visão) e no OpenRouter (com o plugin file-parser, engine `native` pra modelo com visão e `cloudflare-ai` — grátis — pro resto; o engine é sempre explícito pra nunca cair no default pago `mistral-ocr`). Gemini/NIM/Ollama ficam de fora por limitação do NOSSO transporte (o chat do Gemini roda no endpoint OpenAI-compat, que não documenta parts de arquivo) — e aí a UI avisa no ato do anexo, com o nome do modelo, e a mensagem guarda a nota honesta. Quando o envio acontece, a mesma linha vira recibo (`> 📄 contrato.pdf — PDF sent to the model`). Guard de 30MB antes de anexar.
> **Status do áudio — pendente:** continua sem transcrição; o wikilink + aviso seguem sendo o rastro honesto.
> - [x] Chip de PDF no composer com preview e remoção
> - [x] O conteúdo do PDF chega ao provider (bloco nativo — Anthropic/OpenAI/OpenRouter)
> - [x] Se o modelo não suporta, o usuário é avisado ao anexar

**CHT-13** ⬜ *(README corrigido em 0.1.247 — a UI em PT-BR continua no roadmap)* — Como usuário PT-BR, quero a UI em português (auto-detectada pelo locale).
> **Status faltando:** src/main.ts:939-940 força language='en-us' e migra quem estava em pt-br ('PT-BR removido (base 1.0)'); src/i18n/ contém apenas en-us.ts + index.ts. README.md:26 e 205 ainda prometem UI bilíngue — ou volta o pt-br ou o README precisa parar de prometer.
> - [ ] Locale pt-BR carrega strings pt-br
> - [ ] Setting de idioma permite alternar PT/EN
> - [x] README condiz com o produto (a promessa de UI bilíngue virou "English UI · PT-BR no roadmap", EN e PT)

**CHT-14** ✅ — Como usuário de modelos reasoning (R1, o-series, extended thinking), quero ver o raciocínio num painel colapsável para auditar a resposta.

**CHT-15** ⬜ *(decidido em 0.1.247: fica no backlog)* — Como usuário diário, quero o seletor ModelArena (character select com stats por modelo) anunciado como diferencial #5.
> **Status decidido:** a decisão pendente foi tomada — REMOVER o resíduo em vez de reintroduzir a tela agora. Saíram o handler órfão handleArenaConfirm e o bloco i18n `arena`; docs/FEATURES.md deixou de anunciar a arena como entregue e passou a listá-la como backlog. A UI de seleção segue no ModelPicker (abas + favoritos + hot + famílias com cor).

**NAV-01** ✅ — Como usuário, quero uma gaveta lateral com módulos de nova conversa por modo, navegação (Conversas/Projects/Media/Statistics/Profile) e badge de plano.

**NAV-02** ✅ — Como usuário, quero abrir o plugin pela ribbon, pela command palette ou automaticamente na sidebar direita ao iniciar o Obsidian.

### pesquisador do vault (Q&A/RAG) (5/5 ok)

**RAG-01** ✅ — Como pesquisador, quero perguntar sobre minhas notas e receber respostas com citações clicáveis para abrir a fonte real.

**RAG-02** ✅ — Como pesquisador sem índice construído, quero que o Q&A caia em busca keyword para funcionar mesmo sem embeddings.

**RAG-03** ✅ — Como pesquisador, quero reindex automático incremental quando edito notas para o índice não ficar velho.

**RAG-04** ✅ — Como pesquisador com vault grande, quero o RAG seguro no mobile para o índice não derrubar o Obsidian por OOM.

**RAG-05** ✅ — Como pesquisador, quero escolher provider/modelo de embedding (incluindo opções grátis) e o perfil de quantização para equilibrar custo, memória e precisão.

### power user do Agent (5/5 ok)

**AGT-01** ✅ — Como power user, quero preview de diff e aprovação antes de cada escrita do agente no vault, com 'Aprovar todas' por rodada.

**AGT-02** ✅ — Como power user, quero níveis de permissão ask/vault/yolo com delete SEMPRE confirmado para calibrar autonomia sem risco irreversível.

**AGT-03** ✅ — Como power user, quero detecção de loop do agente para ele não repetir a mesma tool call infinitamente queimando tokens.

**AGT-04** ✅ — Como power user, quero que os passos do agente sobrevivam ao reload para continuar uma tarefa com o agente 'lembrando' o que já fez.

**AGT-05** ✅ — Como power user, quero que o agente gere imagens via tool generate_image com confirmação de modelo e preço.

### usuário mobile (3/4 ok)

**MOB-01** ✅ *(resolvido em 0.1.242→0.1.246; era ⬜ na auditoria)* — Como usuário mobile, quero o modo fullscreen (drawer 100vw sem chrome do Obsidian) para uma experiência de app imersiva.
> **Status resolvido:** fullscreen v3 entregue — toggle no menu do header, 100vw × 100dvh, escopado ao drawer DIREITO (não vaza pro esquerdo) e escondendo o chrome nativo (view-header + tab-options). Default OFF, opt-in explícito.
> - [x] Toggle mobileFullscreen aplica .axxa-fullscreen no drawer
> - [x] Esconde header do drawer e compensa safe-area
> - [x] Default OFF, opt-in explícito

**MOB-02** ✅ — Como usuário mobile, quero layout que respeite a navbar/teclado e a tela acesa durante a geração para o stream não congelar.

**MOB-03** ✅ — Como usuário mobile, quero reduzir animações (global ou só no mobile) para poupar bateria e evitar enjoo.

**NAV-03** ✅ — Como usuário, quero aparência customizável (16 fundos, densidade, motion, code wrap) aplicada na raiz do app para o plugin ter identidade própria.

### usuário de voz (2/3 ok)

**VOZ-01** ✅ — Como usuário de voz, quero conversa hands-free (ouço→envia→pensa→fala→volta a ouvir) com orb de estado.

**VOZ-02** ✅ — Como usuário de voz, quero ler qualquer resposta em voz alta (e usar TTS de nuvem quando configurado) para consumir respostas sem ler.

**VOZ-03** 🟡 — Como usuário de voz, quero gravar áudio segurando o mic e ter esse áudio transcrito/entendido pelo modelo.
> **Status parcial:** Gravar e salvar funciona (src/components/composer/Composer.tsx:722-814, src/views/AxxaApp.tsx:1004-1030), mas o áudio nunca chega ao modelo: só imagens vão pro wire (src/providers/_shared.ts:74-78) e transcrição não existe ('Not yet supported in AXXA' — src/providers/modelModality.ts:72; pipeline Whisper é 'sprint próprio' — src/rag/indexer.ts:10-11; README.md:171 lista Whisper como 'Next').
> - [ ] Hold-to-record grava via MediaRecorder e salva em recordingsPath
> - [ ] O áudio anexado é transcrito (Whisper) ou enviado a modelo que entende áudio
> - [ ] O chat responde sobre o conteúdo do áudio

### gerador de imagem (2/2 ok)

**IMG-01** ✅ — Como gerador de imagem, quero gerar imagens direto no chat e tê-las salvas no vault com sidecar de metadados.

**IMG-02** ✅ — Como gerador de imagem, quero o fluxo 'Create image' no PlusModal com escolha de modelo/preço e uma galeria das mídias do vault.

### gestor de custos (2/3 ok)

**CST-01** ✅ — Como gestor de custos, quero um dashboard de uso (por provider/modelo/modo/dia) com export e chips de tokens/TPS ao vivo para saber o que estou gastando.

**CST-02** ✅ — Como gestor de custos, quero cruzar minha estimativa local com o gasto REAL das APIs de billing (admin keys) e lançar recargas para ver saldo verdadeiro.

**CST-03** 🟡 — Como comprador do Pro, quero que minha license key seja validada de verdade para o gating Free/Pro significar algo.
> **Status parcial:** Fluxo de UI completo (src/components/screens/Screens.tsx:293-375, LockedScreen 422-446, gating em AxxaApp.tsx:1573-1595), mas a validação é só FORMATO: qualquer AXXA-PRO-XXXX-XXXX passa e o default de accountTier é 'pro' (src/entitlements.ts:32-56 — o próprio comentário avisa 'NÃO-enforced'). Scaffold consciente; validação real é o próximo passo declarado.
> - [ ] Key validada contra servidor (Gumroad/backend) antes de conceder Pro
> - [ ] Telas pagas (Media/Statistics) bloqueadas para free sem key válida
> - [ ] Feedback claro de key válida/inválida na PlansScreen

### autor de skills (2/3 ok)

**SKL-01** ✅ — Como autor de skills, quero escrever uma nota .md com frontmatter (name/description/icon/mode) e usá-la como /comando no composer.

**SKL-02** ✅ — Como autor de skills, quero uma tela pra explorar/usar skills e exemplos semeados para aprender o formato.

**SKL-03** ✅ *(resolvido em 0.1.247; era ⬜)* — Como autor de skills, quero que uma skill recém-criada/editada no vault apareça como /comando sem recarregar o plugin.
> **Status resolvido:** setupSkillsWatcher (src/main.ts) registra modify/create/delete/rename e, quando o .md está dentro de settings.skillsPath (isSkillFilePath, coberto por teste), agenda reloadSkills com debounce de 600ms. O rename também checa o caminho ANTIGO, então tirar uma nota da pasta atualiza a lista. O reload notifica os listeners → a árvore React re-renderiza sozinha.
> - [x] Criar/editar/renomear .md na pasta de skills recarrega a lista automaticamente
> - [x] O /comando reflete o corpo atualizado no próximo uso

### usuário de projects (2/2 ok)

**PRJ-01** ✅ — Como usuário de projects, quero criar projetos com ícone/cor, agrupar conversas neles e manter as referências íntegras.

**PRJ-02** ✅ — Como usuário de projects, quero 'nova conversa neste projeto' com as notas-fonte pinadas já anexadas como contexto.


## 3. Achados P0 confirmados — quebram ou enganam o usuário

#### P0-01 · Áudio gravado nunca chega ao modelo e desaparece da conversa — usuário é enganado

**Área:** Anexo de áudio → modelo · **Tipo:** state · **Esforço:** L

O hold-to-record salva o áudio no vault e cria um chip, mas no envio o attachment de áudio é descartado: o comentário em handleSend admite 'pdf/audio passam como meta (ignorados no wire por enquanto)', e o mapper de providers só converte attachments de imagem em parts. Pior: a mensagem do usuário é salva no store SEM attachments, então após enviar não fica nenhum vestígio do áudio na conversa (nem wikilink, nem chip). O usuário grava uma nota de voz, envia, a IA responde ignorando-a completamente e a UI não dá nenhum aviso — parece que o áudio foi 'ouvido'.

- **Evidência:** src/views/AxxaApp.tsx:637-652 (comentário 'pdf/audio... ignorados no wire' + addMessage sem attachments); src/providers/_shared.ts:74-78 (só ImageAttachment vira content part).
- **Recomendação:** Curto prazo (S): ao anexar áudio, inserir o wikilink no texto e/ou avisar no chip 'salvo no vault — não enviado à IA'. Correto (L): transcrever o áudio (Whisper via a key OpenAI já usada no cloud TTS, ou STT nativo) e enviar a transcrição como conteúdo da mensagem.
- **Nota do verificador:** Confirmado: handleSaveAudio (AxxaApp.tsx:1002-1030) salva o blob no vault e onAddAudio (:1717-1726) só cria o chip pendente — nenhum wikilink entra no texto. No handleSend, o comentário admite 'pdf/audio passam como meta (ignorados no wire por enquanto)' (:640) e addMessage({type:'user', content:text}) (:650) persiste a mensagem SEM attachments — zero vestígio pós-envio. No wire, _shared.ts:74-85 só converte attachments type==='image' em parts; áudio é descartado. O usuário grava, envia, a IA responde ignorando e nada avisa. P0 correto: engana ativamente o usuário.

#### P0-02 · Feature de Background inteira é um no-op: --axxa-bg-img é definida mas nunca consumida

**Área:** Appearance → Background · **Tipo:** bug · **Esforço:** S

Todos os presets .axxa-bg-* (styles/main.css:4477-4750) só definem a variável --axxa-bg-img; não existe NENHUM `var(--axxa-bg-img)` no repo (grep confirma zero ocorrências). Resultado: os 17 swatches do picker renderizam retângulos escuros idênticos (Dawn = Ocean = Aurora = nada) e escolher um fundo não muda absolutamente nada na interface. O usuário clica, o app salva, e nada acontece — uma tab inteira de Settings que engana. É regressão: o CSS original (commit 7bab45b, linha 6921-6922) tinha a regra `background-image: var(--axxa-bg-img) !important`, removida no rewrite d56e353 (strip do tema).

- **Evidência:** styles/main.css:4477-4750 (só definições); `grep 'var(--axxa-bg' ` = 0 matches; screenshot ADHOC-settings-appearance-dark-full.png (todos os swatches iguais); git show 7bab45b:styles/main.css:6921-6922 (regra consumidora que existia)
- **Recomendação:** Reintroduzir o consumidor: uma regra no .axxa-bg-swatch (`background-image: var(--axxa-bg-img)`) para o preview do picker e outra no root do app (.axxa-root/.axxa-settings-root com classe axxa-bg-*) para o fundo real. Reativar também as animações dos presets "live" ou tirar o sufixo "· live" dos labels enquanto não voltam.
- **Nota do verificador:** Confirmado integralmente: grep 'var(--axxa-bg' no repo inteiro = 0 matches; os presets (main.css:4477-4728) só definem a variável; .axxa-bg-swatch (4764-4775) é só sizing/borda, sem background-image. O TS aplica as classes axxa-bg-<id> em .axxa-root, settings root e swatches (AxxaApp.tsx:1531, AxxaSettingsTab.ts:226-229, 2894) — tudo apontando para CSS que não pinta nada. Screenshot ADHOC-settings-appearance-dark-full.png mostra os 17 swatches como retângulos idênticos vazios, incluindo os '· live'. Regressão verificada no git: 7bab45b:styles/main.css:6922 tinha 'background-image: var(--axxa-bg-img) !important', removida no strip d56e353. P0 justo: uma tab inteira de Settings que salva escolhas sem efeito algum.

#### P0-03 · Switch on/off dos modelos é 100% invisível — estado de seleção não tem nenhuma representação visual

**Área:** Connections → Providers/Models · lista de modelos · **Tipo:** bug · **Esforço:** S

O controle principal da lista (ligar/desligar modelo no picker) não renderiza nada: .axxa-model-toggle-switch não tem background no trilho nem no knob (::after), em nenhum tema, e a classe .axxa-model-opt-active aplicada à linha ativa não existe no CSS. Computed style via Playwright: track e knob ambos rgba(0,0,0,0). No screenshot, os 4 modelos OpenAI estão todos ON e são indistinguíveis de OFF; clicar na linha liga/desliga silenciosamente sem feedback. O usuário não tem como saber quais modelos aparecem no composer. O histórico do git mostra que essas regras nunca tiveram background — bug antigo, não regressão da limpeza.

- **Evidência:** styles/main.css:5985-6005 (sem background em .axxa-model-toggle-switch nem ::after; .is-on só faz translateX); grep sem nenhuma regra .axxa-model-opt-active; AxxaSettingsTab.ts:1315-1329 e 2077-2106 aplicam as classes; screenshot ADHOC-conn-openai-modellist-dark.png e -light.png (nenhum switch visível)
- **Recomendação:** Adicionar background ao trilho (var(--background-modifier-border) off / var(--interactive-accent) on) e ao knob (branco), e estilizar .axxa-model-opt-active (borda/fundo accent sutil) para que ON e OFF sejam distinguíveis à primeira vista.
- **Nota do verificador:** Confirmado: styles/main.css:5985-6005 — .axxa-model-toggle-switch e ::after não têm background algum (só sizing/transition); .is-on só faz translateX. Grep em styles/ não encontra nenhuma regra .axxa-model-opt-active, mas AxxaSettingsTab.ts:1315-1329 aplica ambas as classes e faz o toggle silencioso no onclick da linha. Screenshot ADHOC-conn-openai-modellist-dark.png confirma: nenhum switch visível nas linhas (só estrela). P0 defensável: o controle principal da lista é invisível e o clique altera estado sem nenhum feedback — engana o usuário sobre o que aparece no composer. Effort S ok.

#### P0-04 · Editor de projeto é um overlay fixed SEM background — a tela de trás vaza através dele

**Área:** ProjectEditor (overlay) · **Tipo:** bug · **Esforço:** S

.axxa-proj-editor (styles/main.css:2151-2157) tem position:fixed; inset:0; z-index:950 mas nenhuma declaração de background. O conteúdo que estiver atrás (chat, lista de projetos, resto do app) fica visível através do editor inteiro, misturado com o formulário de nome/cores/ícones. O head (.axxa-proj-editor-head, :2158) também não tem fundo. Outras telas fixed (.axxa-skills:2872, .axxa-voice:2998) têm o mesmo padrão, mas no editor de projeto isso foi confirmado visualmente.

- **Evidência:** Screenshot ADHOC-editor-full--dark.png e ADHOC-editor-filled--dark.png: o menu lateral do storybook aparece legível ATRAVÉS do editor (textos 'Settings', 'Telas principais', 'Composer' sobrepostos aos ícones e swatches). styles/main.css:2151-2157 — grep confirma que nenhuma regra dá background a .axxa-proj-editor.
- **Recomendação:** Adicionar background: var(--background-primary) (ou o token de superfície do DS) em .axxa-proj-editor, como as demais telas cheias; conferir .axxa-skills e .axxa-voice pelo mesmo motivo.
- **Nota do verificador:** Confirmado. styles/main.css:2151-2157 (.axxa-proj-editor: fixed, inset:0, z-index:950) e nenhuma das 8 regras .axxa-proj-editor* define background (grep completo no único CSS do repo). Projects.tsx:121 não passa style inline. Screenshots ADHOC-editor-full/filled--dark.png mostram o menu do storybook legível através do formulário — no Obsidian real seria o chat vazando pelo editor. Tela inutilizável visualmente no fluxo principal de criar projeto: P0 justificado. Fix S correto.

#### P0-05 · Skill com `mode` acionada via slash silenciosamente NÃO injeta o corpo (colisão de nonce)

**Área:** skills/slash-command · **Tipo:** bug · **Esforço:** S

O execute do slash-command de skill chama handleStarterMode(s.mode), que faz setComposerInject(undefined) (AxxaApp.tsx:1329), e em seguida handlePromptStarter recalcula o nonce a partir de prev — que agora é undefined — voltando pra 1 (AxxaApp.tsx:417-419). Se o Composer já consumiu um inject com nonce 1 nesse mount (ex.: user tocou uma sugestão da NewChatScreen, ou já usou QUALQUER skill com mode antes), lastInjectNonceRef.current === 1 e o effect descarta a injeção (Composer.tsx:616-618). Como o mode não mudou (as 3 skills de exemplo em modo chat, com defaultMode chat), o key={activeMode} não remonta o Composer e nada acontece: o /comando some do campo e o template nunca aparece. Zero feedback.

- **Evidência:** AxxaApp.tsx:1518-1521 (execute), AxxaApp.tsx:1326-1333 (handleStarterMode limpa o inject), AxxaApp.tsx:417-419 (nonce = (prev?.nonce ?? 0)+1), Composer.tsx:612-626 (guard nonce === lastInjectNonceRef). Repro: novo chat → usar /Resumo TL;DR (funciona) → apagar → usar /Literature note → campo fica vazio.
- **Recomendação:** Nonce global monotônico (useRef no AxxaApp incrementado sempre), ou não zerar composerInject em handleStarterMode quando um novo inject virá em seguida (assinatura injectSkill(mode, body) que faz as duas coisas atomicamente).
- **Nota do verificador:** Confirmado passo a passo: execute chama handleStarterMode(s.mode) → setComposerInject(undefined) (AxxaApp.tsx:1329); no mesmo batch handlePromptStarter recalcula nonce de prev=undefined → 1 (417-419); guard nonce===lastInjectNonceRef descarta (Composer.tsx:616-618); key={activeMode} (1693) não remonta quando o mode não muda; as 3 skills seed têm mode: (skills.ts:96/108/123), então o repro do revisor é o caminho comum. Falha silenciosa (o /comando some e nada acontece) de um comando explicitamente invocado — P0 defensável; no pior caso seria P1 alto, mas dentro do critério 'engana o usuário'.

#### P0-06 · Modo Voz renderiza como overlay transparente — orb, botões e fundo invisíveis

**Área:** VoiceScreen (CSS) · **Tipo:** bug · **Esforço:** M

Nenhuma regra de cor/fundo existe para o Modo Voz: .axxa-voice (fixed inset:0, z-index 960) não tem background; .axxa-voice-orb-core não tem background (é um círculo invisível); .axxa-voice-orb-ring tem opacity:0 permanente e as classes -ring-1/-ring-2 nem existem no CSS; .axxa-voice-mic, .axxa-voice-cta e .axxa-voice-settings também não têm fundo. Não há @keyframes para os estados listening/speaking (só thinking muda opacity do core para 0.7). Resultado: ao abrir o Modo Voz o usuário continua vendo o chat atrás, com um 'Listening…' solto no meio da tela, e o overlay invisível captura todos os toques — o app parece vivo mas nada responde.

- **Evidência:** styles/main.css:2998-3159 e output/styles.css (grep confirma zero 'background' em regras .axxa-voice*); screenshot /tmp/claude-0/-home-user-axxa-os-ai-agent/efc9dc73-f598-5b9f-a54d-dcf48624be7f/scratchpad/shots/ADHOC-voice-injected.png — DOM real do VoiceScreen injetado sobre a story de chat: chat 100% visível atrás, orb e mic invisíveis.
- **Recomendação:** Adicionar fundo opaco ao .axxa-voice (var(--background-primary)), background ao orb-core (accent), animações de pulso/anel por estado (axxa-voice-state-listening/speaking) e estilo aos botões mic/CTA/settings-sheet. É o coração da tela — sem isso o modo é inutilizável.
- **Nota do verificador:** Confirmado: em styles/main.css:2998-3159 nenhuma regra .axxa-voice* declara background (grep: só transitions e border com var --background-modifier-border); .axxa-voice-orb-ring tem opacity:0 fixo e as classes -ring-1/-ring-2 usadas no TSX (VoiceScreen.tsx:276-277) não existem no CSS; nenhum @keyframes de voice; VoiceScreen.tsx não tem estilo inline compensando. O screenshot ADHOC-voice-injected.png mostra exatamente isso: chat 100% visível atrás, só o texto 'Listening…' flutuando, orb/mic invisíveis, overlay fixed capturando toques. A tela é alcançável pelo botão de voz do composer (Composer.tsx:1074-1081, AxxaApp.tsx:1561). P0 correto: feature inteira inutilizável e o app parece travado.

#### P0-07 · Telas de Voz e Skills não têm 'pele' no CSS: overlay transparente, orb invisível e controles sem cor

**Área:** VoiceScreen + SkillsScreen (CSS) · **Tipo:** bug · **Esforço:** M

Nenhuma regra em styles/main.css define background/cor para as superfícies dessas telas. `.axxa-voice` (linha 2998) e `.axxa-skills` (linha 2872) são overlays `position:fixed; inset:0` SEM background — o chat fica visível por trás da tela de voz e atrás dos cards de skills. `.axxa-voice-orb-core` (3109) é um span sem background — o orb central simplesmente não aparece. `.axxa-voice-settings` (3163) é um bottom sheet transparente por cima do palco (conteúdo ilegível). `.axxa-voice-cta` (3063), `.axxa-voice-mic` (3141), `.axxa-skill-card-use` (2938) e `.axxa-voice-slider-bubble` (3192) têm `border:none` mas nenhuma cor — caem no estilo default de button do Obsidian (cinza), fora do design system. Grep por 'voice' cobre 100% das ocorrências no arquivo: não existe bloco de cores em outro lugar, e `git show 2f67534` confirma que o CSS já nasceu sem skin.

- **Evidência:** styles/main.css:2998-3004, 3063-3072, 3109-3113, 3141-3151, 3163-3172, 3192-3201, 2872-2878, 2938-2946; output/styles.css compilado idêntico (sem background); DESIGN_SYSTEM.md:134 menciona animação 'orb' que não existe no CSS
- **Recomendação:** Escrever a camada de skin: background var(--background-primary) nos overlays `.axxa-voice`/`.axxa-skills`, orb-core com gradiente no accent, CTA/mic/use em var(--interactive-accent) com texto on-accent, sheet de ajustes com var(--background-secondary)+sombra, bubble do slider no accent. Validar dark E light.
- **Nota do verificador:** Confirmado por grep exaustivo em styles/main.css: todas as ocorrências de .axxa-voice/.axxa-skills estão no bloco 2872-3215 e nenhuma define background/color. Overlays fixed;inset:0 transparentes (2872, 2998), orb-core sem background (3109), sheet de ajustes transparente (3163), botões border:none sem cor (2938, 3063, 3141, 3192). Background não é herdado em CSS — o chat fica visível atrás e o orb não aparece. Tela funcionalmente quebrada visualmente = P0 ok.

## 4. Achados P1 confirmados — fricção real no caminho principal

#### P1-01 · Campos numéricos do Effort reescrevem o input a cada tecla — impossível digitar valores normalmente

**Área:** Agent → Effort levels · **Tipo:** bug · **Esforço:** S

addEffortNumberField salva no onChange (dispara por keystroke) e faz clamp com `text.setValue(String(clamped))` quando o valor sai do range (AxxaSettingsTab.ts:662-677). Com campos de min alto isso quebra a digitação: em 'Context reserve' (min 10), digitar "25" vira: tecla '2' → clamp 10 → input reescrito para "10" → tecla '5' → "105" → clamp 95 → campo termina em "95". Em 'chars per excerpt' (min 100, step 100), digitar "500" começa com '5' → vira "100". O usuário não consegue inserir o valor que quer sem colar o número pronto.

- **Evidência:** src/components/settings/AxxaSettingsTab.ts:662-677 (onChange + clamp + setValue por keystroke); campos afetados: contextReservePercent min 10 (linha 611-621), vaultExcerptChars min 100 (linha 576-585)
- **Recomendação:** Clampar e refletir o valor só no blur/Enter (registrar onChange para salvar o valor bruto válido, e clamp+setValue num listener de blur). Nunca reescrever o input enquanto o usuário digita.
- **Nota do verificador:** Confirmado em AxxaSettingsTab.ts:662-678: onChange do TextComponent dispara por input event e o clamp `if (clamped !== num) text.setValue(String(clamped))` reescreve o campo no meio da digitação. Com contextReservePercent (min 10, linha 616) digitar '2' vira '10' imediatamente; vaultExcerptChars (min 100, linha 580) idem com '5'→'100'. O comentário v0.1.228 mostra que o clamp-refletido foi adicionado de propósito, mas quebrou a digitação. P1 justo: entrada de dados literalmente não funciona para valores que começam abaixo do min.

#### P1-02 · Sub-tab 'Max' do Effort fica invisível no mobile — overflow com scrollbar escondida e sem affordance

**Área:** Agent → Effort levels · **Tipo:** ux · **Esforço:** S

Em 390px a row de sub-tabs tem clientWidth 364px e scrollWidth 424px (medido via DOM): o botão 'Max' (x=973, fim em 1053) fica 100% fora da viewport. O CSS esconde a scrollbar (scrollbar-width:none, ::-webkit-scrollbar display:none) e não há fade/chevron indicando conteúdo à direita — o screenshot mostra só Low·Med·High·xHigh, como se Max não existisse. O effortIntro até promete 'Max is uncapped by default', mas o usuário mobile nunca encontra a aba.

- **Evidência:** Medição Playwright (row.clientW=364, scrollW=424, Max x=973 w=80); styles/main.css:4329-4343 (overflow-x:auto + scrollbar oculta, min-width:80px por botão); screenshot ADHOC-settings-agent-dark-full.png (Max ausente)
- **Recomendação:** No mobile, deixar os 5 níveis caberem: reduzir min-width/padding dos .axxa-subtab-btn nessa row (5×~72px cabe em 364px) ou adicionar fade-out de borda indicando scroll. Padrão já existe no DS para rows scrolláveis (.axxa-plus-effort-row).
- **Nota do verificador:** CSS confirma a mecânica: .axxa-settings-subtabs tem overflow-x:auto + scrollbar-width:none + ::-webkit-scrollbar display:none (main.css:4329-4343) e .axxa-subtab-btn min-width:80px + flex:0 0 auto + white-space:nowrap (4352-4366). 5×80 + 4×4 gap + 8 padding = 424px, batendo com o scrollWidth medido, contra ~364px úteis em 390px — Max fica 100% fora, sem fade/chevron. Real. P1 é defensável (o effortIntro promete Max e o usuário nunca acha), embora seja borderline P2 já que swipe por toque ainda funciona; mantenho severityOk=true.

#### P1-03 · Toda a superfície viva do Agent está hardcoded em PT-BR dentro de uma UI 100% EN

**Área:** agent/idioma · **Tipo:** consistency · **Esforço:** M

O único locale é EN (i18n/index.ts:18-20), mas exatamente nos momentos mais críticos do agent o usuário vê português: chips de atividade ('Lendo/Criando/Buscando/Deletando…', 'Falhou em', axxaApp.helpers.ts:44-105 e runAgentTurn.ts:507-510), o modal de confirmação inteiro ('Revisar mudança do Agent', 'Negar', 'Aprovar todas', 'Sim, deletar', '⚠️ Ação irreversível' — ConfirmationModal.ts:59-99), chips 'Negado: X' e 'Tool desconhecida: X' (runAgentTurn.ts:388, 425), 'Loop detectado — pedi reconsideração ao agent' (609-611) e o resumo 'N ações do agente' (Messages.tsx:61). As chaves i18n já existentes t.agent.deniedAction e t.agent.needsOpenAI estão órfãs (grep sem uso). Um usuário EN aprova mudanças destrutivas num modal que não consegue ler.

- **Evidência:** src/i18n/index.ts:18-20 (só EN_US); src/views/axxaApp.helpers.ts:44-105; src/agent/ConfirmationModal.ts:59-99; src/views/runAgentTurn.ts:388, 425, 609-611; src/components/chat/Messages.tsx:61; grep confirma needsOpenAI/deniedAction sem referências
- **Recomendação:** Mover todas essas strings para t.agent.* (chips com verbos por tool, botões do modal, chips de negado/tool desconhecida/loop, header do AgentSteps) e usar as chaves órfãs existentes.
- **Nota do verificador:** Confirmado linha a linha: i18n/index.ts:18-20 só devolve EN_US; axxaApp.helpers.ts:44-107 tem todos os verbos de atividade em PT ('Buscando/Lendo/Criando/Deletando/Executando... concluído'); ConfirmationModal.ts:59-99 tem '⚠️ Ação irreversível', 'Revisar mudança do Agent', 'Negar', 'Aprovar todas', 'Sim, deletar'; runAgentTurn.ts:388-389 ('Tool desconhecida:') e :425-426 ('Negado:') idem. Grep confirma t.agent.needsOpenAI e t.agent.deniedAction definidos em en-us.ts:443-445 e sem nenhum uso. Não está na lista do já-resolvido (o item resolvido foi PT/EN em metadados de modelos/providers/settings, não estas strings). Modal de aprovação de ações destrutivas ilegível pro usuário EN justifica P1.

#### P1-04 · 'Aprovar todas' não tem efeito quando o diff approval está desligado (nível ask)

**Área:** agent/permissões · **Tipo:** bug · **Esforço:** S

Em decideToolGate, o approveAll só é considerado no ramo needsDiff (diffApproval ON + destrutivo). Com Settings → 'Approve changes (diff)' OFF e nível 'ask', toda ação destrutiva cai em '!auto → confirm', o modal continua exibindo o botão 'Aprovar todas' (ConfirmationModal não sabe do diffApproval), o usuário clica, agentApproveAllRef vira true… e o próximo write abre modal de novo. O botão vira uma promessa quebrada — erosão direta de confiança na confirmação.

- **Evidência:** src/agent/permissions.ts:70-74 (`if (needsDiff && opts.approveAll ...) return "auto"` — approveAll ignorado quando needsDiff=false); src/agent/ConfirmationModal.ts:83-91 (botão sempre presente em ações reversíveis)
- **Recomendação:** Considerar approveAll também no caminho de permissão pura: `if (opts.approveAll && !tool.irreversible && (needsDiff || !auto)) return "auto"`; ou esconder o botão quando ele não terá efeito.
- **Nota do verificador:** Confirmado. permissions.ts:70-74: `if (needsDiff && opts.approveAll && !tool.irreversible) return "auto"` — com diffApproval OFF, needsDiff=false, e o próximo `if (needsDiff || !auto) return "confirm"` ignora approveAll no nível ask (auto=false pra destrutivo). ConfirmationModal.ts:83-91 mostra o botão 'Aprovar todas' em toda ação reversível, sem saber do diffApproval. Botão que não faz nada nessa config (um toggle fora do default, mas plausível). P1 aceitável — controle quebrado erosiona confiança na confirmação; fix S.

#### P1-05 · Com diff approval ligado (default), os níveis ask/vault/yolo se comportam idêntico — o dropdown 'YOLO — no modals' mente

**Área:** agent/permissões × diff · **Tipo:** ux · **Esforço:** M

decideToolGate: needsDiff = diffApproval && destructive → 'confirm' independente do nível. Como agentDiffApproval default é true (main.ts:291), escolher 'Vault — free read/write' ou 'YOLO — no modals, except delete' não muda nada: todo write continua abrindo modal. O usuário mexe no dropdown, não vê efeito e conclui que o setting está quebrado. As duas opções de Settings interagem e nada na UI explica isso.

- **Evidência:** src/agent/permissions.ts:65-75; src/main.ts:290-291 (defaults ask + diffApproval true); src/i18n/en-us.ts (permissionYolo: 'YOLO — no modals, except delete (irreversible)')
- **Recomendação:** Acoplar os controles: yolo/vault desligam o diff-gate para os writes que o nível libera (mantendo delete), ou tornar o copy dinâmico ('com diff approval ativo, todos os níveis confirmam writes') e mostrar aviso no dropdown quando a escolha não terá efeito.
- **Nota do verificador:** Confirmado. permissions.ts:71-73: needsDiff = diffApproval && destructive → 'confirm' independente de evaluatePermission (yolo/vault retornam autoApprove=true mas needsDiff vence). main.ts:290-291: defaults ask + agentDiffApproval:true. en-us.ts:452-453: 'Vault — free read/write, only delete asks' e 'YOLO — no modals, except delete' — ambos falsos na config default: todo write destrutivo abre modal em qualquer nível. Copy promete comportamento que o código não entrega no default. P1 correto (caminho principal, copy engana).

#### P1-06 · Ações já executadas são perdidas quando o run termina por abort ou erro — o agente 'esquece' o que fez

**Área:** agent/persistência de steps · **Tipo:** state · **Esforço:** M

setAgentSteps(runSteps) só é chamado nos 3 finais felizes: resposta final (linha 257-259), loop abortado (590) e max turns (622). Se o usuário aperta Stop ou o provider dá erro (rate limit, rede) DEPOIS de o agente já ter criado/editado arquivos, os runSteps são descartados: o bloco 'N ações do agente' não aparece, nada é persistido no .md (só ai-response/user são salvos — AxxaApp.tsx:469-482), e o replay do history na próxima mensagem não contém as tool calls executadas. O agente pode recriar a mesma nota ou refazer edições porque não sabe que já as fez, e o usuário perde o registro do que foi tocado no vault.

- **Evidência:** src/views/runAgentTurn.ts:257-259, 585-591, 618-622 (únicos setAgentSteps), 623-655 (catch sem setAgentSteps); src/views/AxxaApp.tsx:469-482 (persistência ignora ai-comment)
- **Recomendação:** No catch/abort, se runSteps.length>0, anexar os steps à mensagem de erro/interrupção (ou a uma ai-response mínima) para que continuidade e registro sobrevivam a qualquer final de run.
- **Nota do verificador:** Confirmado. setAgentSteps aparece exatamente 3 vezes em runAgentTurn.ts: :257-259 (resposta final), :590 (loop abortado) e :622 (max turns). O catch (:623-655) adiciona ai-response de erro SEM steps, e no AbortError não adiciona mensagem nenhuma — runSteps é descartado. A persistência (AxxaApp.tsx:469-482) só grava agentSteps quando anexados a uma ai-response, então nada sobrevive ao reload nem entra no replay do history. Continuidade e registro perdidos após stop/erro pós-execução. P1 correto.

#### P1-07 · Mensagem de 'provider sem tools' hardcoded em PT, com orientação errada e sem estilo de erro _(severidade possivelmente superestimada — ver nota)_

**Área:** agent/pré-flight · **Tipo:** copy · **Esforço:** S

runAgentTurn.ts:115-121 exibe 'O provider "X" não suporta tool calling. Use OpenAI (que tem function calling) pro Agent Mode' — em português, recomendando só OpenAI quando Anthropic, Gemini, OpenRouter, NIM e Ollama também suportam tools (supportsTools=true em openai.ts:41, gemini.ts:99, ollama.ts:46 etc.). A chave correta t.agent.needsOpenAI ('Use OpenAI, Anthropic, Gemini, OpenRouter, Nvidia NIM, or Ollama') já existe e não é usada. A mensagem também não seta isError/errorCode, então não recebe o tratamento visual/ação das bolhas de erro (diferente do pré-flight de no-key logo acima, linhas 102-113).

- **Evidência:** src/views/runAgentTurn.ts:115-121 vs src/i18n/en-us.ts (agent.needsOpenAI); src/providers/{openai,gemini,ollama}.ts supportsTools=true
- **Recomendação:** Trocar por addMessage({..., content: `${t.ai.errorPrefix} ${t.agent.needsOpenAI}`, isError: true, errorCode apropriado}).
- **Nota do verificador:** O código existe exatamente como descrito (runAgentTurn.ts:115-121: PT, recomenda só OpenAI, sem isError/errorCode) e t.agent.needsOpenAI está órfã. PORÉM a severidade P1 está superestimada: TODOS os 6 providers concretos setam supportsTools = true (anthropic.ts:263, openrouter.ts:49, ollama.ts:46, nim.ts:189, gemini.ts:99, openai.ts:41), então activeProvider.supportsTools nunca é falsy e essa branch é código morto hoje — nenhum usuário vê a mensagem. Vale corrigir como higiene (S), mas é P3, não fricção real no caminho principal.

#### P1-08 · Stop não interrompe a execução de tools e termina o run em silêncio nos turnos 2+

**Área:** agent/stop · **Tipo:** state · **Esforço:** M

O AbortController só é passado ao streamChat (runAgentTurn.ts:223-239). O loop de execução de tools (execCall / preparedCalls, linhas 453-557) nunca checa controller.signal.aborted — o usuário aperta Stop enquanto o agent escreve no vault e as escritas aprovadas continuam executando. Depois, o próximo streamChat lança AbortError, mas o marcador 'interrompido' só é renderizado se firstTurn (linhas 624-640); em qualquer turno seguinte o run simplesmente some sem nenhum feedback. Resultado: o usuário acha que parou, arquivos continuam sendo modificados, e não há confirmação visual de que o agente parou.

- **Evidência:** src/views/runAgentTurn.ts:195-197 (controller criado), 223-239 (signal só no streamChat), 453-557 (execCall sem check de abort), 624-641 (interrupted só quando firstTurn); handleStop em src/views/AxxaApp.tsx:1000
- **Recomendação:** Checar controller.signal.aborted antes de cada execCall e entre turnos (sair do while com marcador); ao abortar em qualquer turno, adicionar um chip/mensagem 'Interrompido pelo usuário' e anexar os runSteps executados até ali.
- **Nota do verificador:** Confirmado. runAgentTurn.ts:195-196 cria o controller; :223-239 o signal só vai ao streamChat; execCall e o loop de resultados (:453-575) não checam controller.signal.aborted em nenhum ponto — writes aprovados continuam após o Stop. No catch (:623-642), o marcador 'interrompido' (updateActivity failedText t.ai.interrupted) só roda `if (firstTurn)`; firstTurn vira false no primeiro token/tool-call (:210-212, :265-268), então em turnos 2+ o AbortError cai no branch 'Abort silencioso' (:641-642) sem nenhuma mensagem. P1 correto.

#### P1-09 · pendingProjectIdRef nunca é limpo ao abandonar o fluxo — chat errado é associado ao projeto silenciosamente

**Área:** Associação chat↔projeto · **Tipo:** bug · **Esforço:** S

handleNewChatInProject seta pendingProjectIdRef.current = project.id (AxxaApp.tsx:353); a associação só consome o ref no primeiro send de uma sessão vazia (:624-633). Se o usuário toca em 'New chat in this project', muda de ideia, abre a gaveta e inicia um chat normal (handleNewChat:1100-1105 e handleNewChatWithMode:1109+ NÃO limpam o ref), a primeira mensagem desse chat sem relação nenhuma é adicionada ao projeto — sem nenhum aviso.

- **Evidência:** src/views/AxxaApp.tsx:353 (set), 624-633 (consumo apenas no 1º send), 1100-1105/1109-1117 (novos chats não zeram o ref); grep confirma só 3 usos de pendingProjectIdRef no arquivo.
- **Recomendação:** Zerar pendingProjectIdRef.current = null em handleNewChat, handleNewChatWithMode e handleLoadChat/handleLoadChatFromList (qualquer caminho que troque a sessão fora do fluxo do projeto).
- **Nota do verificador:** Confirmado. AxxaApp.tsx:353 seta o ref; único consumo é em handleSend quando messages.length===0 (:618-626); handleNewChat (:1100-1105) e handleNewChatWithMode (:1109-1118) não zeram o ref — grep confirma só 3 usos no arquivo. O ref sobrevive inclusive a carregar um chat existente (send com messages>0 não consome), então pode contaminar um chat novo iniciado muito depois. Bug real de associação silenciosa de dados: P1 correto.

#### P1-10 · Debounce nunca é flushado — perda real de dados ao fechar a view ou matar o app durante/logo após o stream

**Área:** auto-save debounced · **Tipo:** bug · **Esforço:** M

O effect de auto-save (AxxaApp.tsx:447-518) agenda 500ms e o cleanup só CANCELA o timer — nunca flusha. Como cada token do stream muda `messages` (dep do effect), o timer reseta a cada token: durante um stream com tokens a <500ms de intervalo, NADA é escrito no disco o stream inteiro. Cenários de perda: (1) Obsidian mobile morto pelo SO no meio de uma resposta longa → resposta inteira perdida (só a user-msg + Assistant vazio foram salvos); (2) usuário fecha a view/clica 'Nova conversa' <500ms após o fim do stream → newChat() zera messages, cleanup cancela o timer, o último par pergunta/resposta some para sempre; (3) main.ts:775-790 (onunload) não flusha nenhum save pendente.

- **Evidência:** AxxaApp.tsx:450 (setTimeout 500ms), :504 (cleanup = clearTimeout sem flush), :505 (dep `messages` muda por token via appendToMessage); main.ts:775-790 sem flush
- **Recomendação:** Guardar o snapshot pendente num ref e flushar: (a) no cleanup quando currentChatId muda/desmonta, (b) num handler de visibilitychange/onunload, (c) trocar debounce puro por debounce+maxWait (~2s) para salvar periodicamente durante o stream.
- **Nota do verificador:** Confirmado: AxxaApp.tsx:450 setTimeout(500ms), cleanup em :504 só clearTimeout, e messages está nas deps (:505+); appendToMessage no store cria novo array de messages a cada token, então o timer reseta a cada token e nada persiste durante streams com tokens <500ms de intervalo. main.ts:775-790 (onunload) limpa timers de índice mas não flusha nenhum save de chat pendente. Cenários de perda descritos batem com o código. P1 adequado (não superestimado — dá até pra defender P0 em mobile).

#### P1-11 · Highlight do resultado da busca é invisível — a classe .axxa-msg-highlight não pinta nada _(severidade possivelmente superestimada — ver nota)_

**Área:** Busca in-chat (ChatArea) · **Tipo:** bug · **Esforço:** S

O fluxo de busca termina em scrollIntoView + classList.add('axxa-msg-highlight') por 2.2s (ChatArea.tsx:80-87), mas a regra CSS correspondente só define border-radius: 14px (styles/main.css:293-295) — sem background, outline ou animação. O usuário escolhe um hit no modal e vê apenas um pulo de scroll, sem nenhuma indicação de qual mensagem foi encontrada. Comentários vizinhos no CSS ('bg+blink tinham sumido no strip do CSS', linha ~594) sugerem que o visual do highlight foi perdido na mesma limpeza.

- **Evidência:** styles/main.css:293-295 (única ocorrência de axxa-msg-highlight no CSS, confirmado via grep); src/components/chat/ChatArea.tsx:82-86
- **Recomendação:** Restaurar o visual: ex. animação de flash com background color-mix(in srgb, var(--interactive-accent) 18%, transparent) que faz fade-out em ~2s, casando com o timeout de 2200ms do componente.
- **Nota do verificador:** Confirmado: styles/main.css:293-295 é a ÚNICA regra pra .axxa-msg-highlight e só tem border-radius:14px; ChatArea.tsx:82-86 adiciona/remove a classe por 2200ms. O visual foi perdido no strip-css (header do main.css admite que background/animação foram removidos) e não foi re-adicionado enquanto o resto da UI já foi re-tematizado (screenshots mostram UI com cores). PORÉM a severidade está superestimada: o scrollIntoView com block:'center' centraliza a mensagem escolhida, então o usuário tem indicação parcial de onde caiu — busca in-chat é fluxo secundário com fallback funcional. É P2 (polish que profissionaliza), não P1.

#### P1-12 · upsertChatSummary muta o array in place — Sidebar e ConversationsList ficam stale a sessão inteira

**Área:** cache de summaries → listas (Sidebar/Conversas) · **Tipo:** state · **Esforço:** S

main.ts:509-517 faz `this.chatSummaries[idx] = s`, `.push(s)` e `.sort()` no MESMO array. O sync do AxxaApp (AxxaApp.tsx:429-436) repassa essa mesma referência via setAllChats, e os consumidores memoizam sobre ela: Sidebar.tsx:95 (`useMemo([chats])`) e ConversationsList.tsx:172-184 (`useMemo([chats, ...])`). Referência nunca muda → memos nunca recomputam. Consequências concretas: (a) a primeira conversa salva na sessão NÃO aparece na gaveta lateral até algo trocar a referência (só delete ou reload fazem isso — o reconcile do disco roda apenas no cold start, main.ts:438 retorna cedo com cache quente); (b) renomear pela ConversationsList mostra Notice de sucesso mas a linha continua com o título antigo até o usuário digitar na busca.

- **Evidência:** main.ts:509-517 (mutação in place) + Sidebar.tsx:95 + ConversationsList.tsx:172-184 (memos com dep `chats`) + AxxaApp.tsx:1216-1219 (rename da lista chama upsert e setAllChats com a mesma ref → bailout do React)
- **Recomendação:** Copy-on-write no cache: `this.chatSummaries = [...this.chatSummaries]` (com o item substituído/inserido) em upsertChatSummary, igual já faz removeChatSummary (filter). Fix de 3 linhas que conserta todas as listas de uma vez.
- **Nota do verificador:** Confirmado: main.ts:509-517 faz splice/push/sort no mesmo array e notifyChats; o sync (AxxaApp.tsx:429-436) chama setAllChats(all) com a MESMA referência — useState do React faz bailout com referência idêntica, então nem re-render acontece. Mesmo quando outro estado re-renderiza, Sidebar.tsx (useMemo safeChats com dep [chats]) e ConversationsList.tsx (filtered com dep [chats,...]) devolvem o resultado memoizado antigo. O rename (AxxaApp.tsx:1219) chama setAllChats(await plugin.loadChatSummaries()) que retorna o cache — mesma ref, título antigo persiste. removeChatSummary (filter, nova ref) prova que o padrão copy-on-write já existe ao lado. P1 correto: primeira conversa da sessão some da gaveta.

#### P1-13 · Chegada e conclusão da resposta do assistente não são anunciadas

**Área:** Chat (streaming) · **Tipo:** a11y · **Esforço:** M

Os únicos aria-live do fluxo de chat são o contador de variantes, o status de activity pendente e o indicador de gravação. O texto da resposta que vai chegando e, principalmente, o momento em que a resposta TERMINA não têm nenhuma live region — um usuário de leitor de tela envia a mensagem e fica no silêncio, sem saber que a resposta chegou nem quando parar de esperar.

- **Evidência:** src/components/chat/Messages.tsx:602-603 (aria-live só enquanto isPending); grep de aria-live/role=status em src/ retorna apenas variant-count, activity pendente, recording e IncompatibleBanner
- **Recomendação:** Adicionar uma live region visualmente oculta (aria-live="polite") que anuncie "Resposta concluída" (e opcionalmente o primeiro parágrafo) quando o streaming termina; não fazer live no texto inteiro em streaming (verboso demais).
- **Nota do verificador:** Confirmado por grep completo de aria-live/role=status em src/: só existem allset (AxxaApp.tsx:1971), recording (Composer.tsx:1121), IncompatibleBanner, variant-count (Messages.tsx:371) e activity pendente (Messages.tsx:602-603, que vira undefined quando isPending termina). Nenhuma live region anuncia início nem fim da resposta — usuário de leitor de tela fica no silêncio no fluxo mais central do produto. P1 correto.

#### P1-14 · Strings em português hardcoded ("Você", "IA", "Assistente", "Conversa") vazam para a UI em inglês

**Área:** ChatSearchModal / cópia de conversa · **Tipo:** bug · **Esforço:** S

Os hits do ChatSearchModal recebem role "Você"/"IA" hardcoded, e o copy-conversation gera markdown com "## Você"/"## Assistente" e título fallback "Conversa" — tudo fora do sistema i18n. Um usuário com o app em inglês vê rótulos em português dentro da busca e no texto copiado.

- **Evidência:** src/views/AxxaApp.tsx:1235 (role: m.type === "user" ? "Você" : "IA"), :1253 ("Conversa"), :1257 ("Você"/"Assistente"). Todo o resto da tela usa t.* (ex.: t.chat.searchPlaceholder na linha 1242).
- **Recomendação:** Criar chaves i18n (ex.: t.chat.roleUser/roleAssistant, t.header.conversationFallbackTitle) e usar nos dois pontos.
- **Nota do verificador:** Confirmado em AxxaApp.tsx: role 'Você'/'IA' na linha 1235, fallback 'Conversa' na 1253, '## Você'/'## Assistente' na 1257 — tudo fora do i18n, enquanto o entorno usa t.* (t.chat.searchPlaceholder na 1242, t.header.copyConversationDone na 1263). O texto copiado e a busca exibem PT para usuário EN. P1 consistente com o achado 4.

#### P1-15 · Campo principal de mensagem (CodeMirror) sem nome acessível

**Área:** Composer · **Tipo:** a11y · **Esforço:** S

O editor do composer é um CodeMirror com role="textbox" mas sem aria-label — verificado ao vivo: .cm-content retorna aria-label=null e aria-labelledby=null. Um usuário de leitor de tela chega no campo mais importante do app e ouve só "edit text", sem saber que é o campo de mensagem nem em que modo (chat/vault-qa/agent) está.

- **Evidência:** src/components/composer/Composer.tsx:584 (new EditorView sem EditorView.contentAttributes); inspeção Playwright no story chat: {role:"textbox", ariaLabel:null, labelledby:null}
- **Recomendação:** Adicionar EditorView.contentAttributes.of({ "aria-label": placeholderText }) na criação do editor e reconfigurar via Compartment junto com o placeholder (já existe o mecanismo em Composer.tsx:599-605), assim o nome acompanha o modo.
- **Nota do verificador:** Confirmado: Composer.tsx:584 cria o EditorView sem EditorView.contentAttributes em lugar nenhum (grep: zero ocorrências de contentAttributes ou aria-label no setup do editor); o placeholder do CM6 (compartment em :599-605) não fornece nome acessível. Campo mais importante do app sem nome pra leitor de tela = P1 de a11y legítimo. A recomendação é boa: o Compartment do placeholder já existe, então acoplar o aria-label ao mesmo reconfigure é fix S natural.

#### P1-16 · Impossível enviar mensagem só com anexo — o botão de enviar some

**Área:** Composer / envio com anexos · **Tipo:** flow · **Esforço:** S

handleSendClick exige texto não-vazio, e com o editor vazio o botão da direita vira mic (isMicMode = !streaming && isEmpty). Resultado: usuário anexa uma imagem/nota/PDF, não digita nada, e não existe botão de enviar — precisa inventar um texto pra conseguir mandar o anexo. Padrão dos apps de referência (ChatGPT/Claude) permite enviar attachment-only.

- **Evidência:** Composer.tsx:706-708 (if (!text) return), Composer.tsx:852 (isMicMode ignora pendingAttachments), Composer.tsx:1025-1073 (botão único send/mic/stop).
- **Recomendação:** Incluir pendingAttachments.length > 0 na condição de send: isMicMode = !streaming && isEmpty && pendingAttachments.length === 0; e permitir onSend com texto vazio quando houver anexos.
- **Nota do verificador:** Confirmado: handleSendClick retorna se !text (Composer.tsx:706-707) e isMicMode = !streaming && isEmpty && mode !== 'vault-qa' (linha 852) — pendingAttachments não entra em nenhuma das duas condições, então com editor vazio o botão da direita é mic (hold-to-record, onClick=undefined, linhas 862-865) e não existe caminho de envio attachment-only. Detalhe: a fórmula real do isMicMode difere da citada (inclui exceção vault-qa), mas a essência do achado está correta. P1 justo — fluxo comum (mandar uma imagem sem texto) exige inventar texto.

#### P1-17 · Tap no mic é um no-op totalmente silencioso — gesto de hold não é descobrível

**Área:** Composer / mic hold-to-record · **Tipo:** ux · **Esforço:** S

O guard anti-acidente exige 180ms parado antes de gravar; tap rápido cancela o arm em endMic sem nenhum feedback, e gravação <300ms é descartada em silêncio. O usuário que toca no ícone de mic (o gesto mais natural) não vê nada acontecer — nem gravação, nem dica de que precisa segurar. No mobile não há tooltip; o aria-label "Hold to record audio" só ajuda leitores de tela.

- **Evidência:** Composer.tsx:875-884 (arm de 180ms), Composer.tsx:897-906 (endMic retorna cedo sem feedback), Composer.tsx:774-776 (descarte silencioso <300ms).
- **Recomendação:** No tap curto, mostrar Notice/toast "Hold to record" (padrão WhatsApp/Telegram). Um único if no early-return de endMic resolve a descoberta do gesto.
- **Nota do verificador:** Confirmado no código: Composer.tsx:880-883 arma o hold em 180ms; endMic (897-904) limpa o timer e retorna sem nenhum feedback; onstop descarta gravação <300ms em silêncio (774-777). Nenhuma Notice em nenhum dos caminhos de tap curto. Como o mic é o botão principal do composer quando vazio no mobile, P1 é justo. Fix é de fato um if no early-return (S).

#### P1-18 · Setting "Chips do composer" é morto: a status row nunca é renderizada

**Área:** Composer / status chips · **Tipo:** state · **Esforço:** M

Settings tem um checklist inteiro pra curar os chips do composer (mode/model/effort/context/in/out/total/speed) e o Composer recebe visibleChips, tokensPerSec, contextUsed, providerName e locked — mas o JSX não renderiza NENHUM chip de status. contextTotal e tokensTotal são computados e descartados; InfoChip é importado e não usado. O usuário marca/desmarca chips nas Settings e nada acontece na tela; o doc do componente ainda promete "Status row BELOW pill: model · effort · context · in · out · total".

- **Evidência:** Composer.tsx:916-917 (contextTotal/tokensTotal computados, nunca usados no return das linhas 1118-1201); Composer.tsx:120-122 (prop visibleChips documentada); AxxaSettingsTab.ts:2313-2337 (checklist composerChips); AxxaApp.tsx:1728 passa plugin.settings.composerChips; screenshots composer-idle/streaming--dark.png sem nenhum chip.
- **Recomendação:** Decidir: (a) reimplementar a status line consumindo visibleChips (o design já existiu), ou (b) remover a seção "Chips do composer" das Settings e enxugar as props mortas (visibleChips, tokensPerSec, contextUsed, providerName, locked) — hoje o setting engana o usuário.
- **Nota do verificador:** Confirmado: Composer.tsx recebe e destrutura visibleChips/tokensPerSec/contextUsed (linhas 106-107, 122, 244-251), importa InfoChip (linha 22, usado só em outros componentes), computa contextTotal/tokensTotal (916-917) e o JSX de retorno (1118-1201) não renderiza nenhum chip de status — só attachments, pill/card e botões. AxxaApp.tsx:1728 passa plugin.settings.composerChips e AxxaSettingsTab.ts:2336 expõe o checklist. O usuário mexe no setting e nada muda: setting morto que engana. P1 justo.

#### P1-19 · Composer do Vault Q/A em position:fixed cobre a navbar do Obsidian no mobile e vaza pra janela inteira no desktop

**Área:** Composer Vault Q/A — mobile · **Tipo:** state · **Esforço:** M

O 'fake bottom sheet' do modo vault-qa é fixed, left/right:0, bottom:var(--keyboard-height,0) (main.css:1135-1141) — com teclado fechado ele encosta no fundo REAL do viewport, ou seja, exatamente onde fica a .mobile-navbar (~50px). Ou o sheet esconde a navegação global do Obsidian enquanto o usuário está no modo Q/A (modo persistente, não um modal), ou a navbar desenha por cima do botão de enviar — depende do z-index nativo, não validado em device. No desktop o mesmo fixed atravessa a leaf: o composer se estica pela janela inteira do Obsidian, por cima do file explorer. O sintoma já aparece no harness: no screenshot newchat-qa--dark.png o composer simplesmente não está no frame (fixed escapou do .sb-frame), enquanto newchat-chat--dark.png mostra o composer normal.

- **Evidência:** styles/main.css:1125-1141 (comentário 'encosta no fundo REAL do viewport'); screenshot shots/newchat-qa--dark.png (sem composer) vs shots/newchat-chat--dark.png (com composer)
- **Recomendação:** Escopar o fixed a body.is-mobile e compensar a navbar quando teclado fechado (bottom: calc(var(--navbar-height)…) ou max(keyboard, navbar)); no desktop voltar ao absolute dentro da leaf. Validar no device quem vence o z-index sheet × navbar.
- **Nota do verificador:** Confirmado: main.css:1135-1141 — .axxa-composer[data-mode='vault-qa'] { position: fixed; left:0; right:0; bottom: var(--keyboard-height, 0px) } sem escopo body.is-mobile; o comentário do próprio CSS (:1128-1133) confirma a intenção de encostar no fundo REAL do viewport. Screenshot newchat-qa--dark.png verificado: o composer está ausente do frame (o fixed escapou do .sb-frame), enquanto newchat-chat mostra composer normal — sintoma direto do escape de container. No desktop o fixed atravessa a leaf inteira (por cima do file explorer); no mobile com teclado fechado bottom:0 coincide com a área da .mobile-navbar. P1 correto (no desktop beira P0).

#### P1-20 · Copy promete 'pick the source' mas não existe UI para escolher o provider do modelo deduplicado

**Área:** Connections → Models · dedup cross-provider · **Tipo:** flow · **Esforço:** M

O intro do Models tab diz 'The same model from two providers is merged — pick the source', porém settings.modelProvider é apenas lido (entryProvider), nunca escrito por nenhuma UI — não há nenhum controle para escolher a fonte. Na prática o provider escolhido é provs[0] (ordem de conexão), invisível e imutável para o usuário; o badge 'Served by X' mostra uma decisão que ele não pode alterar.

- **Evidência:** AxxaSettingsTab.ts:936-941 (copy), 886-897 (entryProvider lê modelProvider), grep no src inteiro: modelProvider só aparece na linha 890 (nenhum write)
- **Recomendação:** Ou implementar o picker (clique no badge 'Served by' abre menu com os providers disponíveis e grava modelProvider[norm]), ou cortar a frase do copy até a feature existir.
- **Nota do verificador:** Confirmado: copy em AxxaSettingsTab.ts:940 ('The same model from two providers is merged — pick the source'); grep de modelProvider em todo src/ retorna apenas declaração/init (main.ts:71,262,951) e UMA leitura (AxxaSettingsTab.ts:890 em entryProvider) — zero writes, logo nenhuma UI grava a preferência e o fallback é provs[0]. A promessa do copy é literalmente falsa hoje. P1 borderline (dedup cross-provider afeta principalmente quem usa OpenRouter + provider direto, e a escolha silenciosa impacta billing/routing), mas aceitável; o fix mínimo (cortar a frase) é S, não M — effort superestimado se optar pelo corte, correto se implementar o picker.

#### P1-21 · Papéis mostram 'no default' mesmo quando existe default configurado nos campos legados

**Área:** Connections → Models · header dos papéis · **Tipo:** state · **Esforço:** M

renderRoleSection lê apenas settings.roleModels[role]; o write-through do ★ grava nos campos legados (defaultProvider/defaultModel etc.), mas a leitura não faz fallback. No mock (e em qualquer usuário existente com defaultProvider=openai/defaultModel=gpt-5), os três papéis exibem 'no default' em itálico — o chat funciona com gpt-5, mas a tela afirma que nada está configurado, minando a confiança na tela nova.

- **Evidência:** AxxaSettingsTab.ts:1029-1040 (só roleModels) vs 902-931 (write-through one-way); screenshot ADHOC-conn-models-collapsed-dark.png (Chat/Reasoning/Text embedding todos 'no default' com defaultModel gpt-5 no mock)
- **Recomendação:** Na leitura do ★ do papel, cair para os campos legados (getProviderDefault + defaultProvider para chat, ragEmbeddingModel/Provider para embedding) quando roleModels[role] estiver vazio — ou migrar os legados para roleModels no load do plugin.
- **Nota do verificador:** Confirmado: AxxaSettingsTab.ts:1029-1040 lê apenas settings.roleModels[role] ('no default' quando vazio), enquanto o write-through (902-931) é one-way para os campos legados — não há leitura de fallback. Evidência visual dupla no par de screenshots: ADHOC-conn-models-open-dark.png mostra Chat/Reasoning/Text embedding todos 'no default', enquanto ADHOC-conn-openai-modellist-dark.png mostra gpt-5 com tag DEFAULT no mesmo mock — a UI se contradiz. Afeta qualquer usuário existente que migrar para a tela nova. P1 e effort M justos.

#### P1-22 · Nome do modelo trunca para 'cla...' no mobile — o dado principal da linha fica ilegível

**Área:** Connections → Models · linha de modelo (mobile) · **Tipo:** ux · **Esforço:** M

Na linha do Models tab, o badge de provider (logo+nome), o tag PAID/FREE e os 3 controles à direita são todos flex 0 0 auto; o nome é o único que encolhe (ellipsis). Em 390px o nome 'claude-haiku-...' vira 'cla...', tornando impossível distinguir modelos da mesma família sem tooltip (que não existe em touch).

- **Evidência:** screenshot ADHOC-conn-models-open-dark.png (linha exibe 'cla...' + badge Anthropic + PAID); styles/main.css:5484-5489 (ellipsis no nome), 6356-6367 (provbadge flex 0 0 auto); AxxaSettingsTab.ts:1231-1258
- **Recomendação:** Priorizar o nome: mover o badge de provider para a segunda linha (junto das modality chips) em telas estreitas, ou permitir 2 linhas no nome; garantir largura mínima útil (~12ch) antes de truncar.
- **Nota do verificador:** Confirmado no screenshot ADHOC-conn-models-open-dark.png: a linha do Haiku exibe literalmente 'cla...' + badge Anthropic + PAID em 390px — impossível distinguir claude-haiku de claude-qualquer-coisa. O código da linha (AxxaSettingsTab.ts:1231-1330) monta nome + badge + tag + 3 controles fixos (bookmark, star, switch), sobrando só o nome para encolher. Tooltip não resolve em touch. P1 justo: o dado principal da linha é ilegível no viewport alvo do produto (mobile-first).

#### P1-23 · Busca não encontra pelo nome de modelo que a própria tela exibe

**Área:** conversations/busca · **Tipo:** ux · **Esforço:** S

O filtro compara contra `c.model` cru (id tipo 'claude-sonnet-4-6') em ConversationsList.tsx:179, mas o chip do item mostra `prettyModelName(c.model)` ('Sonnet 4.6', linha 361). O usuário digita o que está vendo e recebe zero resultados: busquei 'sonnet 4.6' na story e deu 0/6 com 'Sonnet 4.6' visível na lista. O placeholder promete 'Search by title, model or provider...' — a promessa falha exatamente no caso mais natural.

- **Evidência:** screenshot ADHOC-conv-search-pretty.png (busca 'sonnet 4.6' → 0/6 + 'No conversations found for that search.') e src/components/chat/ConversationsList.tsx:177-182
- **Recomendação:** Incluir `prettyModelName(c.model).toLowerCase().includes(q)` no predicado de match (e opcionalmente normalizar '-'/'.'/' ').
- **Nota do verificador:** Confirmado: o predicado (ConversationsList.tsx:177-182) compara search contra c.model cru (id tipo 'claude-sonnet-4-6'), enquanto o chip do item exibe prettyModelName(c.model) na linha 361. Digitar 'sonnet 4.6' (com espaço/ponto, como exibido) não casa com o id — zero resultados apesar do nome estar visível na lista. O placeholder promete busca por model. P1 justo: fricção real na feature de busca prometida.

#### P1-24 · Filtro de modo sem resultados mostra 'No saved conversations yet. Send your first message!' — mensagem falsa

**Área:** conversations/empty-state · **Tipo:** state · **Esforço:** S

O empty state só distingue busca vs. geral: `search ? emptySearch : emptyAll` (ConversationsList.tsx:316). Se o usuário tem 30 conversas de chat e filtra por Agent sem ter nenhuma, a tela afirma que ele nunca salvou nada e manda 'enviar a primeira mensagem' — engana e sugere perda de dados. A chave certa já existe no i18n (`emptyFilter: "No conversations in this mode yet."`, en-us.ts:302) e o Sidebar já a usa corretamente (Sidebar.tsx:351). A tela cheia ficou para trás.

- **Evidência:** src/components/chat/ConversationsList.tsx:316 vs src/i18n/en-us.ts:302 e src/components/layout/Sidebar.tsx:351
- **Recomendação:** Trocar por `search ? emptySearch : modeFilter !== "all" ? emptyFilter : emptyAll`, igual ao Sidebar.
- **Nota do verificador:** Confirmado: ConversationsList.tsx:316 usa apenas `search ? emptySearch : emptyAll`, ignorando modeFilter (que existe na linha 175 do filtro). A chave emptyFilter existe no i18n e o Sidebar.tsx:343-352 já faz a distinção correta (safeChats.length===0 ? emptyAll : emptyFilter). Com 30 chats e filtro Agent vazio, a tela cheia afirma que o usuário nunca salvou nada — mensagem factualmente falsa que sugere perda de dados. P1 justo; fix trivial (S).

#### P1-25 · Card de erro renderiza vazio quando content é vazio — sem texto de fallback _(severidade possivelmente superestimada — ver nota)_

**Área:** Erro com CTA (Messages/ErrorMessage) · **Tipo:** state · **Esforço:** S

No screenshot chat-error--dark o card de erro aparece como uma caixa com só o triângulo de alerta e nenhum texto. A fixture usa content: '' (storybook/mock.ts:255), e o ErrorMessage (Messages.tsx:457-477) renderiza o que vier sem fallback — qualquer caminho real que produza erro com mensagem vazia (ou só o prefixo '[Error]') deixa o usuário com um card mudo e dois botões sem contexto. Dupla correção: o componente precisa de fallback genérico, e a story precisa de um texto realista pra revisão visual valer algo.

- **Evidência:** /tmp/.../shots/chat-error--dark.png (card sem texto); src/components/chat/Messages.tsx:461-476; storybook/mock.ts:251-258
- **Recomendação:** No ErrorMessage, se text.trim() vazio usar uma string genérica do i18n (ex. 'Something went wrong while generating the response.'); atualizar mockErrorMessage com um content de invalid-key real.
- **Nota do verificador:** Confirmado no código e no screenshot: mock.ts:251-258 usa content:'' e Messages.tsx:461-476 renderiza text sem fallback — chat-error--dark.png mostra o card só com o triângulo. MAS todos os caminhos reais de produção montam content como `${errorPrefix} ${mensagem-do-i18n}` (useChatEngine.ts:85/306, runAgentTurn.ts:108/651, useGeneration.ts:74/182) com strings sempre não-vazias de en-us.ts; content vazio real exigiria um err.message==='' (teórico). O problema dominante é a FIXTURE do storybook enganar a revisão visual + falta de fallback defensivo — P2, não P1. real, severidade superestimada.

#### P1-26 · Contexto estourado vira "unknown": mensagem crua do provider + retry que falha sempre — beco sem saída

**Área:** flow-errors / contexto estourado · **Tipo:** flow · **Esforço:** M

Um 400 de context-length-exceeded não tem mapeamento: mapHttpError (_shared.ts:212-213) cai no code "unknown" e describeProviderError (helpers:189-191) exibe o texto cru em inglês do provider (JSON truncado em 200 chars). A única ação oferecida é "Try again" — que refaz exatamente a mesma request e falha determinìsticamente, para sempre. Não há CTA "iniciar novo chat", "resumir conversa" nem dica de reduzir anexos/effort. O usuário fica preso num loop de retry inútil.

- **Evidência:** src/providers/_shared.ts:212-213 (fallback unknown); src/providers/base.ts:194-201 (union sem code de contexto); src/views/axxaApp.helpers.ts:189-191; src/components/chat/Messages.tsx:478-514 (só Retry para unknown)
- **Recomendação:** Adicionar code "context-overflow" detectando o padrão no body do 400 (context_length/maximum context/too many tokens), com copy i18n e CTA "Novo chat" (e/ou truncamento automático do histórico antes do retry).
- **Nota do verificador:** Confirmado. _shared.ts:192-213: mapHttpError só trata auth/429/5xx-408-409; qualquer 400 (incl. context-length-exceeded) cai no fallback "unknown" com o texto cru do provider. Grep por context/overflow em base.ts não acha nenhum code na union. describeProviderError (axxaApp.helpers.ts:189-191) repassa a msg crua. Messages.tsx:478-514: pra code unknown a única action é Retry (openSettings só p/ key error, billing só p/ billing) — retry determinístico que refaz a mesma request. Beco sem saída real no caminho de conversas longas. P1 correto.

#### P1-27 · Camada de erro/atividade fala PT num produto cujo único locale é EN-US

**Área:** flow-errors / i18n · **Tipo:** consistency · **Esforço:** M

O i18n hoje só tem EN_US (index.ts:17-20), mas toda a camada de feedback do agent/erros é hardcoded em PT: chips de tool ("Buscando", "Lendo", "Criou pasta" — helpers:44-108), "Negado:", "Tool desconhecida", "Loop detectado" (runAgentTurn.ts:388-425, 609-611), "Gerando imagem..." (useGeneration.ts:88-92), "Buscando até N trechos" (useChatEngine.ts:112) e o ErrorBoundary inteiro ("erro de tela", "Copiar erro"). Na mesma conversa o usuário vê "Thinking..." (EN), depois "Buscando pasta X" (PT), depois "Rate limit reached" (EN). Justo no momento de erro — quando confiança importa — a UI parece quebrada/misturada.

- **Evidência:** src/i18n/index.ts:17-20; src/views/axxaApp.helpers.ts:44-108; src/views/runAgentTurn.ts:388, 425, 596-611; src/views/useGeneration.ts:88-92; src/components/_shared/ErrorBoundary.tsx:43-61
- **Recomendação:** Mover todas as strings de activity/erro/ErrorBoundary pro dicionário i18n (t.agent.activity.*, t.errBoundary.*) — mesmo com um locale só, elimina a mistura e prepara o PT/EN futuro.
- **Nota do verificador:** Confirmado. i18n/index.ts:17-20: EN_US é o único locale ("PT-BR removido"). Grep confirma PT hardcoded na UI: axxaApp.helpers.ts:49/63/99 (Buscando/Lendo/Criou pasta), runAgentTurn.ts:425-426 (Negado:), :609-610 (Loop detectado), useGeneration.ts:89/251 (Gerando/Editando imagem...), useChatEngine.ts:112 (Buscando até N trechos), ErrorBoundary.tsx:57 (Copiar erro). Os chips de activity são o feedback principal do modo agent, então a mistura EN/PT aparece em toda conversa agent, não só em erro raro. Não colide com o item já resolvido na branch (aquele foi PT/EN nos metadados de modelos/providers/settings — superfícies distintas). P1 defensável.

#### P1-28 · "Tentar de novo" descarta silenciosamente os anexos do turno original

**Área:** flow-errors / retryError · **Tipo:** state · **Esforço:** M

handleSend salva a user-msg SEM attachments no store (comentário em AxxaApp.tsx:649-650) e propaga imagens/notas só via parâmetro. retryError (AxxaApp.tsx:963-986) re-dispara com streamReply(userText)/runAgentTurn(userText) sem o segundo argumento — então um erro transitório (rate-limit, rede) numa mensagem com imagem anexada, ao ser retentado, vai pro modelo SEM a imagem. O usuário recebe uma resposta que ignora o anexo e não há nenhum aviso de que ele foi perdido.

- **Evidência:** src/views/AxxaApp.tsx:956 (envio com attachments) vs :983-985 (retry sem attachments); src/views/AxxaApp.tsx:649-651 (store não persiste attachments)
- **Recomendação:** Guardar os attachments do último turno num ref (ou persistir na UserMessage) e repassá-los no retryError; alternativamente avisar na bolha de erro que o retry irá sem anexos.
- **Nota do verificador:** Confirmado. AxxaApp.tsx:649-651: user-msg salva sem attachments no store; :652 limpa pendingAttachments após o envio. retryError (:963-986) reconstrói só userText do store e chama runAgentTurn(userText)/streamReply(userText) sem segundo argumento (:984-985) — os attachments do turno original já não existem em lugar nenhum. Retry de erro transitório com imagem vai sem a imagem, sem aviso. P1 ok (silencioso e engana, mas exige a conjunção erro+anexo; P0 seria exagero).

#### P1-29 · Menus "..." e do switcher de modelo são inalcançáveis por teclado

**Área:** Header (menus) · **Tipo:** a11y · **Esforço:** M

Os dois popovers (mais-opções e HeaderModelSwitcher) são portalados pro fim do <body>: ao abrir com Enter, o foco fica no botão e o próximo Tab pula pro conteúdo do chat — testado ao vivo: Tab foi para .axxa-reasoning-head com o menu ainda aberto. role="menu"/aria-haspopup prometem navegação por setas que não existe. Bônus: por estarem fora de .axxa-root, os itens não recebem o outline global de :focus-visible (styles/main.css:90-93 é escopado a .axxa-root).

- **Evidência:** src/components/layout/Header.tsx:227-292 e 374-411 (createPortal pro body, sem gestão de foco); teste Playwright: após Enter no botão More options + Tab → activeElement=.axxa-reasoning-head, inMenu=false
- **Recomendação:** Ao abrir, focar o primeiro role=menuitem; implementar setas cima/baixo + Home/End e devolver o foco ao botão no fechamento (padrão WAI-ARIA menu button). Alternativa mais barata: usar o Menu nativo do Obsidian (showAtPosition), que já tem teclado, como nos context menus.
- **Nota do verificador:** Confirmado. Header.tsx:227-292 e 374-411: ambos popovers usam createPortal pro body com role="menu"/aria-haspopup, e não há NENHUM .focus() no arquivo (grep vazio) — foco fica no botão e Tab segue a ordem do DOM dentro de .axxa-root, pulando o portal no fim do body. styles/main.css:90-93 confirma que o outline de :focus-visible é escopado a .axxa-root/.axxa-settings-root, então mesmo quem tabular até o portal não vê foco. P1 justo: são os dois menus principais do header e o padrão ARIA prometido (menu) não é entregue.

#### P1-30 · Strings em português hardcoded numa UI toda en-US

**Área:** i18n (ChatArea/Messages/busca) · **Tipo:** consistency · **Esforço:** S

Três strings visíveis fogem do i18n (en-us.ts): (1) o chip colapsável de tool steps mostra '{N} ações do agente' — texto visível no corpo da resposta (Messages.tsx:61); (2) o botão back-to-bottom tem aria-label/title 'Voltar pra base' (ChatArea.tsx:141-142); (3) os hits da busca in-chat rotulam as mensagens como 'Você'/'IA' (AxxaApp.tsx:1235). Numa UI 100% inglesa isso lê como texto esquecido de debug e quebra leitores de tela em EN.

- **Evidência:** src/components/chat/Messages.tsx:61; src/components/chat/ChatArea.tsx:141-142; src/views/AxxaApp.tsx:1235; src/i18n/en-us.ts não tem essas chaves
- **Recomendação:** Criar chaves t.chat.agentSteps (com plural), t.chat.backToBottom, t.chat.searchRoleUser/searchRoleAI e consumir via useT como o resto do arquivo.
- **Nota do verificador:** As três confirmadas lendo o código: Messages.tsx:61 renderiza `{steps.length} ações do agente` (texto visível no corpo de TODA resposta do Agent com tools), ChatArea.tsx:141-142 tem aria-label/title 'Voltar pra base', AxxaApp.tsx:1235 rotula hits como 'Você'/'IA'. Nenhuma dessas chaves existe em en-us.ts. Bônus que corrobora o padrão: runAgentTurn.ts:118 também tem string PT hardcoded ('O provider ... não suporta tool calling'). P1 justo — texto PT no corpo das respostas do Agent é caminho principal e parece debug esquecido numa UI 100% EN.

#### P1-31 · 'Try again' num erro de geração via modal manda o prompt pro modelo de CHAT em vez de re-gerar a imagem

**Área:** imagegen/erro+retry · **Tipo:** flow · **Esforço:** M

O caminho do modal gera com choice.providerId/choice.model, mas a sessão fica travada no modelo de chat ativo (useGeneration.ts:341 lockSession com activeProviderId/activeModel). Quando a geração falha (rate-limit, billing), a bolha de erro mostra 'Try again' (Messages.tsx:506-513) → retryError re-despacha pela capability do MODELO ATIVO (AxxaApp.tsx:982-985): como o ativo é chat, cai em streamReply e o GPT-4o responde texto sobre '🖼️ um gato voando'. O mesmo vale pra editar a mensagem do usuário (AxxaApp.tsx:936-956). O usuário pediu retry de uma imagem e recebe um parágrafo — beco confuso sem caminho de volta pro modal.

- **Evidência:** useGeneration.ts:336-343 (lockSession no modelo de chat, user msg '🖼️ prompt'); AxxaApp.tsx:963-986 (retryError roteia por caps do modelo ativo); Messages.tsx:506-513 (CTA Try again em toda bolha de erro).
- **Recomendação:** Marcar o turno como image-gen (ex.: metadata na user msg com providerId/model escolhidos) e fazer retryError/edit re-invocar runImageGeneration com a mesma escolha — ou reabrir o ImageGenModal pré-preenchido.
- **Nota do verificador:** CONFIRMADO. useGeneration.ts:341: lockSession(activeProviderId, activeModel, activeMode) — trava no modelo de CHAT ativo, e a user msg vira '🖼️ prompt' (343) sem metadata da escolha do modal. retryError (AxxaApp.tsx:963-986) roteia por getModelCapabilities(activeProviderId, activeModel) (982): modelo ativo de chat → cai no streamReply (985), que responde texto sobre o prompt de imagem. Mesmo problema no handleEditMessage (926-957). O CTA 'Try again' aparece em toda bolha de erro (Messages.tsx:506-513, actions.retryError). Beco real: não há caminho de volta pro runImageGeneration com a escolha original. P1 correto.

#### P1-32 · Checkbox 'Edit the attached image' marcado + modelo sem suporte a edição → imagem anexada é ignorada em silêncio

**Área:** imagegen/img2img · **Tipo:** ux · **Esforço:** S

No ImageGenModal, com imagem anexada o título vira 'Edit image' e o checkbox IMG2IMG fica marcado (ImageGenModal.ts:79, 101-104). Se o usuário então seleciona um modelo sem supportsEdit (gpt-image-1, dall-e-3), o CTA continua habilitado e no Generate o useInputImage é forçado a false (linhas 191-194) — roda text2img puro, descartando a foto do usuário sem nenhum aviso. A notinha 'editing only on Nano Banana' aparece no meta da opção (linha 228-230), mas o título segue dizendo 'Edit image' e o checkbox segue marcado: o usuário paga por uma imagem aleatória achando que editou a dele.

- **Evidência:** ImageGenModal.ts:79, 101-104, 147-149, 186-195, 228-230; consumo em useGeneration.ts:344-354 (choice.useInputImage ? inputImage : undefined).
- **Recomendação:** Ao selecionar modelo sem supportsEdit com IMG2IMG marcado: desmarcar/desabilitar o checkbox e voltar o título pra 'Generate image', ou bloquear o CTA com aviso explícito ('este modelo não edita — a imagem anexada será ignorada').
- **Nota do verificador:** CONFIRMADO. ImageGenModal.ts: select() (238-242) só re-renderiza opções e syncGenerate — não desmarca useInputImage nem atualiza o título; o título só muda no onchange do checkbox (144-152). syncGenerate (255-261) não considera supportsEdit, então o CTA fica habilitado. No Generate (185-197) useInputImage é forçado a false quando !this.selected.supportsEdit — text2img puro, imagem do usuário descartada. A nota editOnlyNano (228-230) aparece no meta, mas título 'Edit image' + checkbox marcado seguem mentindo. Ressalva: o default (linha 79) só marca o checkbox se o modelo pré-selecionado edita, então o cenário exige trocar de modelo depois — mas isso é exatamente o fluxo comum de comparar preços no modal. P1 aceitável: descarta a intenção do usuário em silêncio numa ação paga.

#### P1-33 · Botão Stop não faz nada durante a geração de imagem — a geração (paga) continua

**Área:** imagegen/stop · **Tipo:** bug · **Esforço:** M

runGenerationTurn cria um AbortController e seta abortRef (useGeneration.ts:61-62), mas o signal nunca é passado a provider.generateImage — a assinatura do provider nem aceita signal (openai.ts:147-150). Pior: no caminho do modal (handleCreateImage → runImageGeneration, useGeneration.ts:215-357) o abortRef nem é setado, então handleStop (AxxaApp.tsx:1000) é um no-op total. Como store.setLoading(true) é chamado, o composer mostra o botão Stop (streaming={isLoading}, AxxaApp.tsx:1705) — um controle ativo que não controla nada. O usuário clica Stop numa geração de $0.04+, nada acontece, e a imagem aparece segundos depois mesmo assim.

- **Evidência:** useGeneration.ts:61-62 e 105-107 (controller criado, signal não passado); useGeneration.ts:244-317 (nenhum AbortController); openai.ts:147-197 (generateImage sem signal); AxxaApp.tsx:1000 (handleStop = abortRef.current?.abort()).
- **Recomendação:** Passar AbortSignal até o requestUrl dos providers de imagem (ou, no mínimo, esconder o Stop e mostrar um estado 'gerando… não cancelável' durante generation turns). No caminho do modal, setar abortRef com o mesmo controller.
- **Nota do verificador:** CONFIRMADO nos dois caminhos. (1) runGenerationTurn: useGeneration.ts:61-62 cria AbortController e seta abortRef, mas provider.generateImage é chamado (105-108) sem signal — a assinatura nem aceita (base.ts:170-173: generateImage?(request, apiKey); openai.ts:147-150 idem). (2) Caminho do modal: handleCreateImage/runImageGeneration (215-358) nunca tocam em abortRef, mas store.setLoading(true) é chamado (347), então o composer mostra Stop e handleStop (AxxaApp.tsx:1000: abortRef.current?.abort()) é no-op. Controle ativo que não controla nada numa ação paga — P1 correto.

#### P1-34 · Radiogroup de modelos é inacessível por teclado: não há navegação por setas e linhas não selecionadas têm tabindex=-1

**Área:** ImageGenModal · **Tipo:** a11y · **Esforço:** M

O grupo declara role=radiogroup/radio com roving tabindex (selecionada=0, demais=-1), mas o único handler de teclado é Enter/Space na linha já focada — não existe ArrowUp/ArrowDown. Resultado: usuário de teclado/leitor de tela consegue focar apenas o modelo já selecionado e nunca trocar a seleção. Agrava: renderOptions() faz listEl.empty() e recria os nós a cada seleção, destruindo o elemento focado (foco cai para o body).

- **Evidência:** src/generation/ImageGenModal.ts:215 (tabindex selected?0:-1), :245-250 (só Enter/Space), :203 (listEl.empty() no re-render). CSS :focus-visible existe (styles/main.css:7093) mas nunca é alcançável nas linhas não selecionadas.
- **Recomendação:** Implementar o padrão WAI-ARIA radiogroup completo: ArrowUp/Down movem seleção+foco; após re-render, restaurar o foco na linha selecionada (row.focus()). Alternativa simples: usar <input type=radio> nativos estilizados.
- **Nota do verificador:** Confirmado em ImageGenModal.ts: role=radiogroup na linha 159, tabindex selected?0:-1 na 215, onkeydown só trata Enter/Space (245-250) — nenhum ArrowUp/Down. Com roving tabindex sem setas, só a linha selecionada é focável e a seleção nunca muda via teclado. Agravante confirmado: renderOptions faz listEl.empty() (203) e recria tudo a cada select, destruindo o nó focado. P1 ok: a11y quebrada de verdade (o padrão foi declarado mas não implementado), não é polish.

#### P1-35 · Só ABRIR uma conversa antiga reescreve o arquivo com date=agora — histórico reordena sozinho

**Área:** load + auto-save · **Tipo:** state · **Esforço:** M

handleLoadChat (AxxaApp.tsx:1396-1447) faz setMessages/setCurrentChatId; o effect de auto-save não tem dirty-flag e roda 500ms depois salvando com `date: new Date().toISOString()` (AxxaApp.tsx:461). Efeitos: a conversa de 3 semanas atrás que o usuário só abriu para LER pula pro topo da lista e agrupa em 'Hoje' (a ordenação e os grupos Hoje/Ontem da ConversationsList usam esse date); o campo date deixa de significar qualquer coisa estável; todo open gera write no vault (ruído de mtime pro Obsidian Sync/iCloud e conflitos entre devices).

- **Evidência:** AxxaApp.tsx:447-461 (save incondicional com date=now após qualquer mudança em messages) + :1429 (setMessages no load dispara o effect); ConversationsList.tsx:219-238 (agrupamento Hoje/Ontem por esse date)
- **Recomendação:** Marcar dirty apenas em mudanças reais (send/edit/reaction/rename) e pular o primeiro ciclo pós-load; preservar o date original do arquivo quando nada mudou (ou separar created_at de updated_at no frontmatter).
- **Nota do verificador:** Confirmado: handleLoadChat (AxxaApp.tsx:1396-1447) chama setMessages(restored) → o effect de auto-save (deps incluem messages) dispara 500ms depois e salva incondicionalmente com date: new Date().toISOString() (:461) — não há dirty-flag nem skip do primeiro ciclo pós-load. O upsertChatSummary subsequente re-ordena por date (main.ts:514), jogando a conversa lida pro topo, e cada open gera write no vault (ruído de sync). P1 justo: corrompe silenciosamente a semântica de data do histórico no caminho principal (abrir conversas).

#### P1-36 · ModelSheet não sabe do session lock: tocar noutro modelo no meio da conversa descarta a tela sem aviso nem confirmação

**Área:** ModelSheet (chip de modelo do composer) · **Tipo:** ux · **Esforço:** S

O ModelSheet (aberto pelo chip de modelo do composer — o caminho principal no mobile) chama onSelectModel → handleHeaderModelSelect, que com sessão locked faz abort + newChat() imediatamente (AxxaApp.tsx:1379-1392). A conversa atual some da tela na hora (fica salva, mas o usuário não sabe disso). A dica 'Choosing another model opens a new conversation' existe SÓ no dropdown do header (Header.tsx:382-385, i18n en-us.ts:204); o ModelSheet não recebe nenhuma prop locked nem mostra hint — o mesmo gesto tem consequência invisível dependendo de onde é feito. É exatamente a pergunta 'trocar modelo exige nova conversa — isso é claro?': no header sim, no sheet não.

- **Evidência:** ModelSheet.tsx:105-131 (props sem locked), 228-236 (seleção direta sem hint); AxxaApp.tsx:1886-1903 (ModelSheet não recebe isLocked); Header.tsx:370 e 382-385 (cadeado + hint só no header)
- **Recomendação:** Passar locked ao ModelSheet e exibir o mesmo hint/cadeado do header; após a troca com lock, mostrar um Notice tipo 'Nova conversa com <modelo> — a anterior está salva na gaveta' pra fechar o loop de feedback.
- **Nota do verificador:** Confirmado: ModelSheet (src/components/composer/ModelSheet.tsx) não tem nenhuma referência a lock (grep vazio); AxxaApp.tsx:1886-1903 não passa isLocked; handleHeaderModelSelect (:1379-1392) com isLocked faz abort + newChat imediato. O hint/cadeado existe só no Header.tsx (:370, :382). A conversa fica salva, mas o usuário não é avisado — mesma ação, consequência invisível dependendo do lugar. P1 aceitável por ser o caminho principal no mobile.

#### P1-37 · Clearance da navbar é medida e publicada como --axxa-status-bar-clearance, mas o CSS consome --copilot-status-bar-clearance _(severidade possivelmente superestimada — ver nota)_

**Área:** Navbar padding / clearance · **Tipo:** bug · **Esforço:** S

setupStatusBarClearance() mede a .mobile-navbar em todo layout-change/resize e seta --axxa-status-bar-clearance no <html> (main.ts:811-828). Só que o único consumidor no CSS lê var(--copilot-status-bar-clearance, 0px) (main.css:12) — a variável do plugin Copilot, de outro produto. Resultado: a medição própria é 100% código morto, e o padding-bottom da view só compensa barra inferior se o usuário por acaso tiver o Copilot instalado (acoplamento acidental e invisível). O comentário do main.ts:805 afirma que 'o CSS usa essa variável' — não usa.

- **Evidência:** src/main.ts:811-828 (seta --axxa-status-bar-clearance), styles/main.css:10-14 (lê --copilot-status-bar-clearance); grep confirma zero leituras da var axxa no CSS
- **Recomendação:** Trocar main.css:12 para var(--axxa-status-bar-clearance, 0px). Avaliar se essa regra e a regra :has da navbar (main.css:26-38) não estão dobrando a mesma compensação — hoje uma mede via JS e a outra chuta var(--navbar-height, 50px).
- **Nota do verificador:** Fato confirmado: main.ts:817-820 seta --axxa-status-bar-clearance; o único consumidor no CSS é var(--copilot-status-bar-clearance, 0px) em main.css:12; grep confirma zero leituras da var axxa. Comentário main.ts:805 realmente mente. PORÉM o impacto user-facing é menor que P1: (1) setupStatusBarClearance retorna cedo no desktop (main.ts:812), e no mobile a regra da linha 16-20 sobrescreve o padding-bottom pra var(--size-4-1) e a regra :has da navbar (main.css:24-38) faz a compensação real via --navbar-height — ou seja, a regra com a var copilot praticamente nunca decide o layout no mobile; (2) no desktop o fallback 0px é o valor correto. Efeito real: código morto (medição JS inútil) + padding extra acidental se o usuário tiver o plugin Copilot. É dívida/higiene → P2, não P1. A recomendação de checar dupla compensação antes de 'consertar' está certa.

#### P1-38 · Composer ativo por baixo do onboarding: enviar mata o onboarding sem marcá-lo como concluído, e ele volta a cada nova conversa

**Área:** Onboarding (AxxaApp render condicional) · **Tipo:** state · **Esforço:** S

O OnboardingScreen substitui só o miolo da tela; o Composer renderiza para qualquer `view === "chat"` sem excluir o estado de onboarding, e o Header idem. O novato vê um campo 'Message AXXA…' convidando a digitar; ao enviar, `messages.length > 0` derruba `isEmpty` e o onboarding some no meio do fluxo SEM `onboardingDone = true` — em seguida aparece a bolha de erro no-key. Se ele iniciar nova conversa, o onboarding REAPARECE (condição `!onboardingDone && !hasAnyKey && isEmpty`), num loop de 'boas-vindas' repetidas que parece bug.

- **Evidência:** src/views/AxxaApp.tsx:1652-1659 (branch do onboarding exige isEmpty), :1691 (`{view === "chat" && (<Composer …/>)}` sem excluir onboarding), :168-176 (hasAnyKey), :189-198 (finishOnboarding é o único lugar que seta onboardingDone). Story 'onboarding' renderiza a tela isolada (storybook/stories.tsx:278-284), por isso o screenshot não mostra o composer — mas no app real ele está lá.
- **Recomendação:** Não renderizar o Composer (e simplificar o Header) enquanto o onboarding está visível; alternativamente, marcar `onboardingDone = true` no primeiro send. O onboarding deve ter exatamente duas saídas: CTA ou skip.
- **Nota do verificador:** Confirmado em AxxaApp.tsx: branch do onboarding exige view==='chat' && isEmpty && !onboardingDone && !hasAnyKey (1652-1655); o Composer renderiza para qualquer view==='chat' sem excluir onboarding (1691-1693); finishOnboarding (189-198) é o único lugar que seta onboardingDone, e não é chamado no send. Sequência descrita procede: send → messages>0 → isEmpty false → onboarding some sem done; nova conversa → isEmpty true → onboarding reaparece (hasAnyKey ainda false, 169-176). P1 ok: primeiro contato do usuário novo com aparência de bug.

#### P1-39 · Celebração invertida: 'You're all set!' aparece ao PULAR o onboarding sem nenhuma key — e o caminho que realmente adiciona a key não ganha confirmação nenhuma

**Área:** Onboarding → skip (finishOnboarding) · **Tipo:** copy · **Esforço:** S

`finishOnboarding(false)` (skip) dispara o overlay 'You're all set! / You're ready to get started.' — factualmente falso: zero providers configurados, e o primeiro envio vai falhar com erro de key. Já `finishOnboarding(true)` (CTA 'Add my first key') abre as Settings e, ao voltar com a key colada, não há feedback algum de sucesso. O usuário que fez a coisa certa não recebe o 'tudo certo'; o que pulou recebe uma promessa que quebra na primeira mensagem.

- **Evidência:** src/views/AxxaApp.tsx:189-198 (setShowAllSet(true) só no branch !openSettings), :1970-1978 (overlay). Copy em src/i18n/en-us.ts:65-68 ('You're all set!' / 'You're ready to get started.').
- **Recomendação:** No skip, usar copy honesto ('Você pode conectar um provider depois em Settings'). Mover o 'All set!' para quando `hasAnyKey` vira true pela primeira vez após o onboarding (detectável no onSettingsChange).
- **Nota do verificador:** Confirmado em AxxaApp.tsx:189-198 — setShowAllSet(true) só no branch else (skip); openSettings=true só chama handleOpenSettings sem nenhum feedback posterior (onSettingsChange em :115 só forceRender). Copy 'You're all set! / You're ready to get started.' em en-us.ts:65-68. Sem key, o 1º envio cai no pre-flight noKey (useChatEngine.ts:79-90), então a promessa quebra mesmo. P1 justo: é o primeiro minuto do produto e a mensagem é factualmente falsa.

#### P1-40 · CTA "Add my first key" grava onboardingDone=true antes de existir qualquer chave — cancelou o Settings, perdeu o welcome para sempre

**Área:** onboarding/cta · **Tipo:** flow · **Esforço:** S

finishOnboarding(true) persiste onboardingDone=true e SÓ DEPOIS abre o modal de Settings. Se o usuário fechar o modal sem colar a chave (caminho comum: não tem a chave à mão), volta para o NewChatScreen sem nenhuma chave e o welcome nunca mais aparece — a condição de exibição exige !onboardingDone (AxxaApp.tsx:1654). O NewChatScreen não tem nenhum affordance de "sem chave" (grep por key em NewChatScreen.tsx: zero ocorrências), então a única pista que resta é a mensagem de erro ao tentar enviar.

- **Evidência:** src/views/AxxaApp.tsx:189-193 (persiste antes de abrir Settings) e 1652-1655 (condição de exibição); src/components/chat/NewChatScreen.tsx (sem tratamento de ausência de chave)
- **Recomendação:** No caminho CTA, não persistir onboardingDone — a condição !hasAnyKey já esconde a tela automaticamente assim que a chave for salva. Persistir onboardingDone apenas no Skip explícito.
- **Nota do verificador:** Confirmado: AxxaApp.tsx:189-193 persiste onboardingDone=true e saveSettings ANTES de handleOpenSettings; a condição de exibição em 1652-1655 exige !onboardingDone && !hasAnyKey, então fechar o modal sem colar chave mata o welcome permanentemente. Grep por key/Key em NewChatScreen.tsx: zero ocorrências — nenhum affordance de 'sem chave' resta. A recomendação é sólida: com !hasAnyKey na condição, não persistir no caminho CTA faz o welcome reaparecer até a chave existir. P1/S corretos — é o cold-start, o momento de maior abandono.

#### P1-41 · Copy promove Ollama ("runs local, no key") mas não existe caminho Ollama — e para quem usa só Ollama o welcome reaparece em todo novo chat

**Área:** onboarding/ollama · **Tipo:** flow · **Esforço:** M

A nota diz "Got Ollama? runs local, no key", mas os únicos caminhos são "Add my first key" (irrelevante para Ollama) e Skip. Pior: hasAnyKey só olha as 5 chaves de API (AxxaApp.tsx:169-176) e Ollama nunca tem chave (main.ts:557-558 — só endpoint, com default), então para um usuário Ollama-only a condição isEmpty && !onboardingDone && !hasAnyKey volta a ser verdadeira em CADA novo chat até ele clicar Skip. O caminho local-first que o produto anuncia é o único sem botão.

- **Evidência:** src/i18n/en-us.ts:591; src/views/AxxaApp.tsx:169-176 e 1652-1655; src/main.ts:557-558 (ollamaEndpoint, sem key)
- **Recomendação:** Adicionar um terceiro caminho "Use Ollama (local)" que seleciona o provider ollama e marca onboardingDone; ou tratar provider ativo = ollama como "configurado" na condição de exibição.
- **Nota do verificador:** Confirmado no código: en-us.ts:591 tem o byoNote 'Got Ollama? runs local, no key' e os únicos CTAs são cta/skip (592-593). hasAnyKey (AxxaApp.tsx:169-176) só soma as 5 API keys — ollamaEndpoint (main.ts:557-558) nunca entra. A condição de exibição (AxxaApp.tsx:1652-1655) é isEmpty && !onboardingDone && !hasAnyKey, então usuário Ollama-only revê o onboarding em cada chat vazio até clicar Skip. P1 justo: o caminho local-first anunciado no próprio copy é o único sem botão.

#### P1-42 · "You're all set!" aparece depois do Skip com zero chaves — confirma um setup que não aconteceu

**Área:** onboarding/skip · **Tipo:** state · **Esforço:** S

O caminho onDismiss (Skip for now) chama finishOnboarding(false), que mostra o overlay allSet: "You're all set! / You're ready to get started." Mas o usuário acabou de PULAR a configuração: tem zero providers com chave, e a primeira mensagem que mandar vai falhar com "No API key for X. Add your key in Settings to get started." (en-us.ts:516). O overlay de sucesso celebra um estado que é factualmente falso e prepara o usuário para uma frustração imediata.

- **Evidência:** src/views/AxxaApp.tsx:189-198 (finishOnboarding → setShowAllSet(true) no caminho skip); src/i18n/en-us.ts:65-68 (allSet); src/i18n/en-us.ts:516 (erro de chave ausente que o usuário vai ver em seguida)
- **Recomendação:** No caminho skip, trocar o overlay por uma mensagem honesta e acionável (ex.: "You can add a key anytime in Settings → Connections") ou só exibir o allSet quando hasAnyKey === true. Manter o allSet para o caminho em que a chave foi de fato adicionada.
- **Nota do verificador:** Confirmado: AxxaApp.tsx:1658 onDismiss→finishOnboarding(false), que em 189-198 seta showAllSet(true) incondicionalmente; en-us.ts:65-68 é 'You're all set! / You're ready to get started.'; a primeira mensagem sem chave cai em en-us.ts:515-516 ('No API key for X...'). hasAnyKey já existe no escopo (AxxaApp.tsx:175-176), então gatear o overlay é trivial. O overlay auto-dispensa em 1.7s (linha 185), mas confirmar factualmente errado no primeiro contato do usuário, seguido de erro imediato, justifica P1. Recomendação coerente.

#### P1-43 · Sem botão Cancelar; "Clear" ocupa a posição do Cancel e apaga a persona salva sem confirmação

**Área:** PersonaModal · **Tipo:** ux · **Esforço:** S

O rodapé tem apenas [Clear] [Save]. "Clear" está exatamente onde todos os outros modais do produto colocam "Cancel" (Rename, Confirm, ImageGen, LinkSafety) e submete "" imediatamente — remove a persona persistida no .md do chat. Usuário que só quer sair do modal clica ali por hábito e destrói a persona; a única saída não-destrutiva é Esc/X, sem affordance visível.

- **Evidência:** src/components/chat/PersonaModal.ts:63-72 (Setting com clear→submit("") e save; nenhum cancel). Compare RenameChatModal.ts:60-65 e ConfirmModal.ts:40-45, que têm Cancel explícito na mesma posição.
- **Recomendação:** Adicionar botão Cancel (fecha sem submeter), mover "Clear" para a esquerda com estilo de warning, e só mostrá-lo quando já existe persona salva.
- **Nota do verificador:** Confirmado em PersonaModal.ts:63-72: Setting com apenas [clear→submit("")] e [save], nenhum cancel; submit fecha o modal imediatamente. RenameChatModal.ts:60-65 confirmado com cancelBtn explícito na mesma posição do rodapé — a inconsistência de padrão é real. Clicar 'Clear' por hábito destrói a persona persistida sem confirmação nem undo. P1 justo: ação destrutiva silenciosa na posição do Cancel.

#### P1-44 · Status da licença afirma "Pro active" antes do Apply e com validação só de formato _(severidade possivelmente superestimada — ver nota)_

**Área:** PlansScreen · **Tipo:** copy · **Esforço:** S

O status é calculado sobre o valor DIGITADO (valid = isLicensePro(key)): basta o texto casar o regex AXXA-PRO-XXXX-XXXX para aparecer "✓ Valid key — Pro active." — antes de clicar Apply e sem nenhuma validação real (o próprio entitlements.ts avisa que qualquer string nesse formato passa). O usuário lê "Pro active" com a licença ainda não aplicada. E o botão Apply continua habilitado para chaves de formato inválido, permitindo salvar lixo.

- **Evidência:** src/components/screens/Screens.tsx:305-306 (valid sobre o estado key do input) e 360-371 (mensagem licenseValid exibida pré-Apply); src/i18n/en-us.ts:576 ("✓ Valid key — Pro active."); src/entitlements.ts:36-44 (comentário: é só checa-formato, não autorização).
- **Recomendação:** Separar os estados: pré-Apply mostrar "Formato válido — clique Apply para ativar"; só após onSetLicense confirmar "Pro active". Desabilitar Apply quando o formato é inválido (ou avisar que salvará mesmo assim).
- **Nota do verificador:** Real: Screens.tsx:305-306 calcula valid sobre o key digitado e :360-371 exibe t.plans.licenseValid ("✓ Valid key — Pro active.", en-us.ts:576) antes do Apply; Apply (:354) só desabilita quando key===license, então formato inválido pode ser salvo. Mas severidade superestimada: entitlements.ts:49-54 mostra que o tier default é "pro" enquanto não há billing real, então o dano prático de fechar sem aplicar é quase nulo hoje; e a validação ser só de formato é decisão documentada de scaffold (comentário :36-40), não regressão. É copy enganoso numa tela secundária: P2, não P1.

#### P1-45 · Funil de upgrade sem saída: Plans não tem preço nem onde comprar a licença

**Área:** PlansScreen / LockedScreen · **Tipo:** flow · **Esforço:** S

O caminho LockedScreen → "See plans" → Plans termina num beco: o card Pro lista features mas não mostra preço, e a única ação da tela é colar uma license key que o usuário não tem como obter (nenhum link/CTA de compra). O upsell convida ("Upgrade to unlock") para uma compra que não existe na UI — fricção máxima exatamente no momento de conversão e sensação de produto inacabado.

- **Evidência:** Screenshot plans--dark.png e plans--light.png (card Pro sem preço, sem botão de compra; só input de chave); src/components/screens/Screens.tsx:293-375 (nenhum handler/link de aquisição, só onSetLicense); locked--dark.png ("Upgrade to unlock" + "See plans").
- **Recomendação:** Adicionar no card Pro o preço e um CTA "Get Pro" (link para a página de compra, ex.: Gumroad). Enquanto o billing não existir, dizer honestamente "Vendas em breve — já tem uma chave? cole abaixo".
- **Nota do verificador:** Confirmado em src/components/screens/Screens.tsx:293-375 — a tela só tem os dois cards e o input de license key (onSetLicense); nenhum link/CTA de compra. i18n (src/i18n/en-us.ts:556-577) também não menciona preço nem onde obter a chave: licenseHint = 'Paste your license to unlock Pro.'. Screenshot locked--dark.png confirma o CTA 'See plans' que desemboca nesse beco. Não conflita com a regra do dono (não é sobre publicação, é qualidade do fluxo). P1 justo: fricção máxima no ponto de conversão; effort S ok.

#### P1-46 · Strings PT-BR hardcoded vazando na UI (app é EN-only, só existe en-us.ts)

**Área:** PlusModal / banner / effort · **Tipo:** copy · **Esforço:** S

Três vazamentos no fluxo do composer: (1) o picker de nota do PlusModal mostra placeholder "Buscar nota pra anexar..."; (2) tocar em "Switch to" no banner com sessão locked dispara Notice "Pra trocar pra ${m}, comece uma Nova conversa (botão \"+\" no topo)."; (3) os tooltips dos pills de Effort no PlusModal usam EFFORT_DESCRIPTIONS em PT ("Rápido e econômico (≤512 tok · 5 turns)"). O repositório só tem src/i18n/en-us.ts — essas strings aparecem em português no meio de uma UI inglesa.

- **Evidência:** PlusModal.tsx:627 (setPlaceholder("Buscar nota pra anexar...")); AxxaApp.tsx:1680-1682 (Notice PT); effort.ts:33-39 (EFFORT_DESCRIPTIONS PT) usado em PlusModal.tsx:450 via title.
- **Recomendação:** Mover as três pro dicionário i18n (t.plus.pickNotePlaceholder, t.composer.compatLockedNotice, t.effort.descriptions) em inglês, mantendo a estrutura pronta pro PT futuro.
- **Nota do verificador:** Confirmado nos três pontos: PlusModal.tsx:627 setPlaceholder('Buscar nota pra anexar...'); AxxaApp.tsx:1680-1682 Notice 'Pra trocar pra ${m}, comece uma Nova conversa...'; effort.ts:33-39 EFFORT_DESCRIPTIONS em PT usadas como title em PlusModal.tsx:450. src/i18n só tem en-us.ts. Não está na lista de itens já resolvidos nesta branch (que cobriu PT/EN só nos metadados de modelos/providers/settings). P1 aceitável: o placeholder do note-picker fica visível no fluxo principal do composer e a mistura de idiomas mina a credibilidade do produto.

#### P1-47 · Toggles (Web search, Extended thinking, Thinking) não anunciam estado on/off

**Área:** PlusModal / ModelSheet · **Tipo:** a11y · **Esforço:** S

PlusToggleRow e a linha Thinking do ModelSheet são rows com role="button" focável, e o role="switch" + aria-checked fica num <span> interno NÃO focável. O leitor de tela foca a row e anuncia "Web search, button" — sem estado ligado/desligado, e ao ativar não há feedback de mudança. É interativo aninhado dentro de interativo (mesmo problema estrutural do favRow do ModelSheet: <button> da estrela dentro de row role=button).

- **Evidência:** src/components/composer/PlusModal.tsx:493-527 (role=button na row, role=switch no span aria-hidden pro foco); src/components/composer/ModelSheet.tsx:421-449 (linha Thinking idem); ModelSheet.tsx:187-222 (button dentro de role=button)
- **Recomendação:** Mover role="switch" e aria-checked pra própria row focável e rebaixar o span visual pra aria-hidden. No favRow, trocar a row pra <div> não-interativa com dois botões irmãos, ou dar aria-label composto no botão da estrela.
- **Nota do verificador:** Confirmado. PlusModal.tsx:492-527: row focável com role="button" (linha 498-499) e role="switch"+aria-checked num <span> interno não focável (515-522). ModelSheet.tsx:421-448: linha Thinking com a mesma estrutura. ModelSheet.tsx:187-221: favRow é div role="button" com <button> da estrela aninhado (interativo dentro de interativo). O elemento que recebe foco não carrega estado — leitor de tela anuncia só "button". Detalhe menor: o span do switch não é aria-hidden como o revisor disse, mas isso não muda o problema (o estado não está no elemento focado). Fix é S mesmo.

#### P1-48 · Armadilha do provider errado: adicionou key do Gemini/Claude mas o chip ativo continua OpenAI (sem key, sem indicação) — 1º envio falha com 'add your key in Settings' logo depois de o usuário ter adicionado uma

**Área:** Primeiro chat após adicionar key (NewChatScreen) · **Tipo:** flow · **Esforço:** M

`defaultProvider` nasce 'openai'. Se o novato adiciona a key de outro provider (Connections abre na sub-tab OpenAI, mas Gemini tem free tier — caso comum), volta pro NewChatScreen com o chip OpenAI ainda ATIVO: o código força o provider atual na lista mesmo não-configurado, sem nenhum badge de 'sem key'. O envio falha com 'No API key for OpenAI. Add your key in Settings to get started.' — instrução que o usuário acabou de cumprir. Loop de confusão clássico de first-run.

- **Evidência:** src/components/chat/NewChatScreen.tsx:72-75 (prepend do provider atual não-configurado sem distinção visual), src/main.ts:212 (defaultProvider: 'openai'), src/i18n/en-us.ts:515-516 (copy do noKey não menciona trocar de provider), src/components/_shared/providersMeta.ts:18-28.
- **Recomendação:** Ao fechar Settings, se o provider ativo não tem key mas outro tem, auto-trocar `defaultProvider` para o primeiro configurado (com Notice discreto). Complemento: badge 'no key' no chip não-configurado e copy do erro sugerindo 'ou troque o provider abaixo'.
- **Nota do verificador:** Confirmado: NewChatScreen.tsx:72-78 prepende o provider atual não-configurado ao segmented sem nenhuma marca visual (mesmo shape dos configurados); main.ts:212 defaultProvider:'openai'; não existe nenhum auto-switch ao fechar Settings (onSettingsChange em AxxaApp.tsx:115 só re-renderiza) e o copy noKey (en-us.ts:515-516) manda de volta pra Settings sem mencionar trocar o chip. Loop de confusão real no first-run; P1 correto.

#### P1-49 · Sessão trava e chat fantasma é persistido ANTES do pre-flight de key: fica um chat só com a pergunta nos Recents, e reabri-lo depois não mostra erro nem explicação

**Área:** Primeiro envio sem key (handleSend + pre-flight) · **Tipo:** state · **Esforço:** M

`handleSend` cria chatId, gera título e chama `lockSession` incondicionalmente na 1ª mensagem; só DEPOIS o pre-flight no-key (em streamReply/runAgentTurn/runGenerationTurn) aborta. Consequências: (1) o auto-save persiste um .md com 1 mensagem de usuário e zero respostas (erros não são persistidos por design) — aparece nos Recent chats como conversa 'normal'; (2) reaberto via loadChat, mostra a pergunta sem resposta e sem pista do que houve; (3) o header exibe o cadeado de modelo travado numa sessão que nunca começou. O novato que falhou no 1º envio acumula lixo no vault logo no primeiro minuto.

- **Evidência:** src/views/AxxaApp.tsx:618-635 (lock/persist antes do dispatch), :447-503 (auto-save filtra isError mas salva com 1 user msg — `userOrAi.length === 0` só barra chats vazios); pre-flight tardio em src/views/useChatEngine.ts:79-90, src/views/runAgentTurn.ts:103-111, src/views/useGeneration.ts:224-231.
- **Recomendação:** Mover o pre-flight de key para o topo do `handleSend`, antes de `lockSession`/`setCurrentChatId` (a bolha de erro pode existir sem sessão travada). Alternativa mais ampla: só persistir o chat quando houver a primeira ai-response válida.
- **Nota do verificador:** Confirmado: handleSend (AxxaApp.tsx:613-635) faz setCurrentChatId + lockSession incondicionalmente antes de qualquer dispatch; o pre-flight noKey só roda dentro de streamReply (useChatEngine.ts:79-90). O auto-save (AxxaApp.tsx:447-503) filtra isError mas persiste com userOrAi.length===1 (só a user msg) e faz upsertChatSummary — o chat fantasma entra nos Recents. Erro é isError, não persistido, então reabrir não explica nada. P1 ok: lixo no vault + estado enganoso no primeiro minuto.

#### P1-50 · Avatar, pill PRO/FREE e badge do cadeado renderizam sem background (círculos invisíveis)

**Área:** ProfileScreen / LockedScreen · **Tipo:** bug · **Esforço:** S

A camada de tema colore por padrões de classe ([class*="-cta"], [class*="-card"], [class*="-pill"]...), mas .axxa-profile-avatar2, .axxa-profile-tier e .axxa-locked-badge não casam nenhum padrão e não têm regra de cor própria — computed background é transparent nos 3 (verificado via getComputedStyle no Storybook). O hero do Profile mostra "RA" como texto solto sem círculo, o "PRO" é texto nu sem pill, e o Locked mostra só o ícone de cadeado sem o círculo de 56px. Agrava: a pill tem align-self:flex-start dentro do hero centralizado, então "PRO" fica colado na borda esquerda sob o e-mail centralizado; e as classes modificadoras axxa-profile-tier-pro/-free geradas no TSX não existem no CSS.

- **Evidência:** styles/main.css:2413-2422 (avatar2 sem background), 2471-2477 (tier sem background + align-self:flex-start), 2486-2494 (locked-badge sem background); main.css:776 (camada de cor só cobre -btn-primary/-cta/-gear-primary); src/components/screens/Screens.tsx:254 (classes -tier-pro/-free sem CSS); screenshots profile--dark.png, profile--light.png e locked--dark.png confirmam visualmente; getComputedStyle retornou rgba(0,0,0,0) nos três elementos.
- **Recomendação:** Dar background aos três (avatar: accent em color-mix ~15%; tier pill: cores distintas para pro/free; locked-badge: superfície sutil) e trocar align-self:flex-start por center na .axxa-profile-tier.
- **Nota do verificador:** Confirmado: styles/main.css:2413-2422 (.axxa-profile-avatar2 sem background), 2471-2477 (.axxa-profile-tier sem background e com align-self:flex-start), 2486-2494 (.axxa-locked-badge sem background). A camada de padrões (main.css:761-804) cobre -btn-primary/-cta/-gear-primary/-chip/-pill/-card/-tile — nenhum casa com 'avatar2', 'tier' ou 'locked-badge'. Grep confirma que axxa-profile-tier-pro/-free não existem no CSS (Screens.tsx:254 gera as classes). Screenshots profile--dark.png ('RA' solto, 'PRO' colado à esquerda sob o e-mail centralizado) e locked--dark.png (cadeado sem círculo) confirmam visualmente. P1 justo: três elementos quebrados em telas principais.

#### P1-51 · Aba ativa Chats|Sources é indistinguível — classe .axxa-proj-tab-active não existe no CSS

**Área:** ProjectDetailScreen (abas) · **Tipo:** state · **Esforço:** S

Projects.tsx:279/286 aplica a classe axxa-proj-tab-active, mas styles/main.css só define .axxa-proj-tab (layout, :2073-2081) — não há NENHUMA regra para o estado ativo (grep por 'proj-tab-active' retorna zero). O usuário não tem como saber em qual aba está; ao alternar, nada muda visualmente além do conteúdo.

- **Evidência:** Screenshot ADHOC-project-detail--dark.png: 'Chats' (ativa) e 'Sources' renderizam idênticas — mesmo peso, mesma cor, sem pill/underline. styles/main.css: única ocorrência é .axxa-proj-tab:2073.
- **Recomendação:** Criar .axxa-proj-tab-active com fundo pill (ex.: var(--axxa-pill-bg-strong)) e cor de texto forte, e rebaixar a inativa para --text-muted; adicionar aria-selected/role=tab para acessibilidade.
- **Nota do verificador:** Confirmado. Projects.tsx:279/286 aplica axxa-proj-tab-active; grep em styles/main.css não encontra nenhuma regra para ela (só .axxa-proj-tab:2073). Screenshot ADHOC-project-detail--dark.png: 'Chats' e 'Sources' renderizam idênticas. Também faltam role=tab/aria-selected. P1 e effort S corretos.

#### P1-52 · 'Delete project' apaga o projeto num único toque, sem confirmação e sem undo

**Área:** ProjectEditor (delete) · **Tipo:** flow · **Esforço:** M

handleDeleteProject (useProjectActions.ts:62-69) filtra o projeto e persiste imediatamente; o botão em Projects.tsx:205-214 chama onDelete direto. Um toque acidental (o botão fica logo abaixo da grade de ícones rolável) destrói a curadoria de fontes e a associação de chats do projeto sem volta. Contrasta com a filosofia do próprio produto: o Agent 'Delete SEMPRE pede confirmação independente do nível' (src/agent/types.ts:36).

- **Evidência:** src/views/useProjectActions.ts:62-69 (nenhum confirm); src/components/screens/Projects.tsx:205-214; src/agent/types.ts:36 (padrão de segurança do produto que a tela viola).
- **Recomendação:** Confirmar antes (modal nativo ou estado 'tocar de novo para confirmar' no botão) e deixar claro no copy que as conversas NÃO são apagadas, só desagrupadas.
- **Nota do verificador:** Confirmado. useProjectActions.ts:62-69 filtra e persiste direto, sem confirm; Projects.tsx:205-214 chama onDelete no onClick sem intermediário. Perde curadoria de sources e associações de chats (chats em si sobrevivem, só desagrupam — o copy sugerido acerta nisso). Botão fica logo abaixo da grade rolável de ícones, propenso a toque acidental. P1/M razoáveis.

#### P1-53 · Botão 'Done' desabilitado é visualmente idêntico ao habilitado — toque sem nome não dá nenhum feedback

**Área:** ProjectEditor (header) · **Tipo:** ux · **Esforço:** S

Com o nome vazio, canSave=false desabilita o Done (Projects.tsx:136), mas o CSS só muda o cursor (.axxa-proj-editor-done:disabled { cursor: default } — main.css:2178-2180): mesma cor e peso do Cancel. No mobile (sem cursor) o usuário toca 'Done', nada acontece e não há nenhuma pista de que falta preencher o nome.

- **Evidência:** styles/main.css:2178-2180; screenshot ADHOC-editor-full--dark.png (nome vazio): 'Done' no canto direito com a mesma aparência de 'Cancel'.
- **Recomendação:** Adicionar opacity/cor muted ao :disabled e, idealmente, cor de accent ao habilitado; alternativa mais forte: manter habilitado e focar o input com mensagem de validação ao tocar.
- **Nota do verificador:** Confirmado. main.css:2178-2180: :disabled só muda cursor; .axxa-proj-editor-done (:2170-2177) não define color, e o screenshot ADHOC-editor-full--dark.png (nome vazio) mostra 'Done' com o mesmo branco/peso do 'Cancel' — nenhuma pista de que está desabilitado. No mobile, toque mudo sem feedback no fluxo de criar projeto: P1 defensável (limite com P2, mas é caminho principal). Effort S correto.

#### P1-54 · Swatch de cor e ícone selecionados não têm indicação visual — classes -active sem regra CSS

**Área:** ProjectEditor (seleção de cor/ícone) · **Tipo:** state · **Esforço:** S

Projects.tsx:178 aplica axxa-proj-swatch-active e :194 axxa-proj-iconcell-active, mas o CSS não define nenhuma das duas (grep zero em styles/main.css). O swatch base tem border:2px solid transparent (:2225) que nunca vira visível. O ícone selecionado só recebe color inline = projectColor(color) (:198), que para color='default' é var(--text-normal) — idêntico aos demais. Resultado: no editor não dá para saber qual cor/ícone está escolhido; a única pista é o preview no topo, que fica fora do campo de visão ao rolar a grade.

- **Evidência:** Screenshot ADHOC-editor-filled--dark.png: swatch verde selecionado (preview verde confirma) sem anel/borda, idêntico aos outros; ADHOC-editor-full--dark.png: com cor default, o ícone 'folder' selecionado é branco igual a todos. styles/main.css:2221-2255 sem regras -active.
- **Recomendação:** Adicionar .axxa-proj-swatch-active { border-color: var(--text-normal); outline } (anel) e .axxa-proj-iconcell-active { border-color + background tintado }; expor aria-pressed/aria-checked no iconcell.
- **Nota do verificador:** Confirmado. Projects.tsx:178 e :194 aplicam axxa-proj-swatch-active/axxa-proj-iconcell-active; zero ocorrências no CSS. .axxa-proj-swatch tem border 2px transparent (:2225) que nunca muda; ícone selecionado só ganha color inline (:198), invisível com color='default'. Screenshot ADHOC-editor-filled--dark.png confirma: swatch verde selecionado sem anel. Detalhe: o swatch já tem role=radio + aria-checked (:175-176), então a parte a11y da recomendação vale só pro iconcell. P1/S corretos.

#### P1-55 · pendingProjectIdRef nunca é limpo fora do send — conversa aleatória entra silenciosamente no projeto

**Área:** projetos ↔ chats · **Tipo:** bug · **Esforço:** S

'Nova conversa neste projeto' seta pendingProjectIdRef (AxxaApp.tsx:353) e a associação só acontece no primeiro send (AxxaApp.tsx:624-626). Se o usuário mudar de ideia — apertar '+' no header (handleNewChat, :1100-1105), 'New chat/Q&A/Agent' na gaveta (handleNewChatWithMode, :1109-1118) ou carregar outra conversa e depois abrir uma nova — o ref continua vivo, e a PRÓXIMA conversa que ele iniciar (sobre qualquer assunto) é vinculada ao projeto sem nenhum feedback. O usuário descobre dias depois um chat estranho dentro do projeto.

- **Evidência:** AxxaApp.tsx:286, :353 (set), :624-626 (único clear) — handleNewChat/:1100 e handleNewChatWithMode/:1109 não zeram o ref
- **Recomendação:** Zerar pendingProjectIdRef em handleNewChat, handleNewChatWithMode e handleLoadChat. Bônus de UX: enquanto pendente, mostrar um chip 'no projeto X' no composer para o vínculo ser visível antes do send.
- **Nota do verificador:** Confirmado: o ref é setado em handleNewChatInProject (AxxaApp.tsx:~353) e o ÚNICO clear está dentro do bloco messages.length===0 do handleSend (:624-631). handleNewChat (:1100-1105), handleNewChatWithMode (:1109-1118) e handleLoadChat (:1396+) não tocam no ref — todos chamam newChat()/setMessages sem zerar. A próxima conversa nova iniciada depois de desistir é vinculada ao projeto sem feedback. P1 aceitável (bug silencioso de associação de dados; borderline P1/P2 pela frequência, mas não claramente superestimado).

#### P1-56 · "Reduce motion" não desliga nenhuma animation de keyframe — só transitions

**Área:** Reduced motion (mobile e global) · **Tipo:** bug · **Esforço:** S

A regra global de reduce-motion zera apenas transition-duration/delay e scroll-behavior (main.css:734-740). Todas as animations continuam rodando infinitamente: caret piscando (main.css:605-607), shimmer do skeleton (632-634), fade axxa-chat-in (330-332), staggers (1388-1394). O copy promete o oposto: 'Turns off ALL app animations' (en-us.ts:813-815) e a variante mobile vende 'saves battery, avoids motion sickness' (en-us.ts:816-818) — shimmer e caret infinitos são exatamente o que gasta bateria e enjoa. O próprio CSS tem comentário morto: 'caret… Off em reduce-motion (fica estático e visível)' (main.css:595) — a regra prometida não existe.

- **Evidência:** styles/main.css:734-740 (só transition), :595 vs :605-607 (caret sem gate), :632-634 (shimmer), :330-332, :1388-1394; src/i18n/en-us.ts:813-818; src/main.ts:796-801 (classe é a única fonte da verdade)
- **Recomendação:** Adicionar ao bloco body.axxa-reduce-motion: animation-duration: 0.01ms !important; animation-iteration-count: 1 !important (caret e shimmer ficam estáticos, chat-in vira corte seco). Se a decisão de design da linha 329 ('motion básico sempre toca') for mantida, alinhar o copy do toggle — hoje ele mente.
- **Nota do verificador:** Confirmado no núcleo: main.css:734-740 só zera transition-duration/delay e scroll-behavior — nenhuma regra de animation-*. Caret (:606 e :973, 1s infinite), shimmer (:633, 1.4s infinite), rec-pulse (:1328, infinite) e axxa-chat-in (:331, 0.28s fixo) continuam rodando; comentário :595 promete gate que não existe; :329 admite 'sem gate por decisão de design'. Copy contradiz: 'Turns off ALL app animations' (en-us.ts:813-815) e a variante mobile vende economia de bateria (816-818). main.ts:796-801 confirma a classe como única fonte da verdade. Uma correção ao detalhe: os staggers 1388-1394 usam var(--axxa-motion-dur), que É zerada em reduce-motion (main.css:728-733) — essa parte do achado está errada, mas não muda a conclusão. P1 defensável: toggle de a11y que promete X e entrega parcial, com shimmer/caret infinitos (o pior tipo de motion pra quem enjoa).

#### P1-57 · Regenerar e Continuar ignoram o modo da sessão: Vault Q&A perde o contexto do vault, Agent perde as tools, modelo de geração quebra

**Área:** Regenerate (handleRegenerate) / Continue (continueReply) · **Tipo:** bug · **Esforço:** M

handleRegenerate e continueReply sempre chamam activeProvider.streamChat com system prompt SEM vaultSuffix/vaultBlock e sem tools. Numa conversa Vault Q&A, a resposta original foi gerada com trechos das notas injetados no system prompt (useChatEngine.ts:200-207); a regeneração refaz a pergunta sem busca nenhuma no vault — a nova variante responde 'de cabeça' e o usuário não é avisado de que a qualidade caiu. Em modo Agent, regenerar produz um completion puro sem tools. Se o modelo ativo é de geração (imagem/áudio), regenerar chama streamChat num modelo que não conversa. O retryError já faz o dispatch correto por modo/caps (AxxaApp.tsx:982-985); regenerate e continue não.

- **Evidência:** AxxaApp.tsx:728-737 (buildChatSystemPrompt sem vaultBlock/vaultSuffix) e 753 (streamChat direto), 828-843 (continueReply idem), vs retryError em AxxaApp.tsx:982-985 que roteia por isGenerationModel/agent; busca do vault só existe em useChatEngine.ts:100-160
- **Recomendação:** Extrair o dispatch por modo (generation → runGenerationTurn, agent → runAgentTurn, vault-qa → refazer hybridSearch, chat → streamChat) pra uma função única e usá-la em handleSend, handleEditMessage, retryError, handleRegenerate e continueReply. No mínimo, em vault-qa, refazer a busca antes de regenerar.
- **Nota do verificador:** Confirmado: handleRegenerate (AxxaApp.tsx:728-767) e continueReply (:828-883) montam buildChatSystemPrompt sem vaultContextBlock e chamam activeProvider.streamChat direto, sem roteamento por modo — enquanto retryError (:982-985) roteia por isGenerationModel/agent/streamReply. A busca do vault só existe em useChatEngine.ts:100-160. Degradação silenciosa de qualidade em vault-qa e agent; P1 correto.

#### P1-58 · Regeneração que falha deixa uma variante VAZIA como versão ativa da resposta — bolha em branco '2/2'

**Área:** Regenerate com falha (variantes) · **Tipo:** state · **Esforço:** M

beginVariant arquiva o conteúdo atual e zera content pra '' (store/chat.ts:306-321). Se o streamChat falhar (rede, key inválida, rate limit), o catch só faz syncVariant + Notice (AxxaApp.tsx:770-776) — a variante vazia fica gravada e exibida: o usuário vê a resposta anterior sumir e virar uma bolha em branco com ‹2/2›, e o erro é um Notice efêmero. Ele precisa descobrir sozinho que a seta ‹ recupera a versão antiga. Agrava: handleRegenerate não tem o pre-flight de API key que streamReply (useChatEngine.ts:79-90) e continueReply (AxxaApp.tsx:799-805) têm — sem key, o fluxo esvazia a bolha antes de falhar.

- **Evidência:** AxxaApp.tsx:740-782 (beginVariant antes do stream, catch só com syncVariant+Notice, sem pre-flight de key); store/chat.ts:306-331
- **Recomendação:** Pre-flight de key antes do beginVariant; no catch, se a variante nova ficou vazia, descartá-la e restaurar variantIndex/content da versão anterior (rollback), mostrando o erro como bolha de erro acionável (retryError) em vez de Notice.
- **Nota do verificador:** Confirmado: beginVariant (store/chat.ts:306-321) arquiva o content e zera pra '' com variantIndex apontando pra nova; no catch de handleRegenerate (AxxaApp.tsx:770-776) só syncVariant + Notice — a variante vazia fica ativa. E handleRegenerate (:698-707) de fato não tem o pre-flight de key que continueReply tem (:799-805): sem key, esvazia a bolha e falha. P1 ok — parece perda de conteúdo pro usuário.

#### P1-59 · Indicador de provider ativo é invisível — .axxa-seg-ind não tem background em lugar nenhum

**Área:** Seletor de provider (SegmentedRow) · **Tipo:** bug · **Esforço:** S

O SegmentedRow desenha uma pílula deslizante (.axxa-seg-ind) para marcar o item ativo, mas a regra base (styles/main.css:5335-5346) só define posição/raio/transform — nenhum background. Nenhuma outra regra do arquivo (nem as variantes .axxa-sidebar-seg/.axxa-sheet-seg) dá cor ao indicador, e o build final confirma: em output/styles.css a regra compilada é `axxa-seg-ind{position:absolute;top:4px;...;pointer-events:none}` sem background. O único cue de ativo que sobra é a opacidade do ícone (0.8→1, main.css:5376/5382), imperceptível. Nos 3 screenshots de newchat (e na sidebar Recents), OpenAI e Anthropic parecem idênticos; o usuário só descobre o ativo pelo microtexto 'PROVIDER · OpenAI' de 9.5px. Toda a mecânica de slide/WAAPI do SegmentedRow.tsx anima uma pílula que ninguém vê. Provável baixa do strip-css.mjs (o header do main.css diz que backgrounds foram removidos 'p/ re-tematizar') que nunca foi re-adicionada.

- **Evidência:** styles/main.css:5335-5346 (sem background); output/styles.css (regra compilada sem background); screenshots newchat-chat--dark.png, newchat-qa--dark.png, newchat-agent--light.png (nenhum destaque no provider ativo); SegmentedRow.tsx:108-120 (WAAPI animando o indicador invisível)
- **Recomendação:** Adicionar background ao .axxa-seg-ind base (ex.: var(--background-modifier-hover) ou color-mix com --interactive-accent, coerente com os tokens [DS:*]) + talvez sombra leve. Um S de esforço devolve o feedback de seleção em TODAS as telas que usam SegmentedRow (newchat, starter, sidebar, filtros).
- **Nota do verificador:** Confirmado exaustivamente: main.css:5335-5346 (base) só tem posição/raio/transform; as variantes 1816-1819, 6800-6805 e 6831-6851 (inclusive os ::before/::after do labeled, que só têm inset/padding sem cor) também não dão background. styles/ só tem main.css. Screenshots newchat-chat/qa/agent confirmam: OpenAI e Anthropic idênticos, único cue é o microtexto 'PROVIDER · OpenAI'. DESIGN_SYSTEM.md:195-198 documenta que o ind DEVERIA ter visual (glow/shimmer) — perdido no strip-css e não restaurado enquanto o resto foi re-tematizado. P1 correto: feedback de seleção sumiu de todas as telas com SegmentedRow. Effort S ok.

#### P1-60 · Números do Usage tab congelam na primeira abertura — cache nunca invalidado por novas conversas

**Área:** Settings → Usage (cache) · **Tipo:** state · **Esforço:** S

`cachedUsage` (AxxaSettingsTab.ts:204) é preenchido na primeira renderização (linha 2982) e só é limpo ao clicar num pill de período (linha 2953). `hide()` (linhas 682-694) não o limpa, e o reconcile em background de `loadChatSummaries` (main.ts:437-464) notifica subscribers mas o Settings tab só assina saveSettings. Resultado: o usuário conversa, gasta dinheiro, reabre Settings → Usage e vê exatamente os números antigos até recarregar o plugin ou trocar o filtro — sem nenhum indicador de 'desatualizado'.

- **Evidência:** src/components/settings/AxxaSettingsTab.ts:204, 2976-2982, 2953, 682-694; src/main.ts:437-464
- **Recomendação:** Limpar `this.cachedUsage = null` em `hide()` (ou em `display()` quando activeTopTab==='usage'), e/ou assinar o notifyChats do plugin para invalidar o cache quando summaries mudarem.
- **Nota do verificador:** CONFIRMADO. cachedUsage (AxxaSettingsTab.ts:204) tem exatamente 4 ocorrências no arquivo: declaração, limpeza no clique do pill de período (2953), leitura com ?? (2977) e escrita (2982). hide() (682-694) não o limpa, e a instância do SettingTab vive pela vida do plugin — reabrir Settings → Usage reusa o aggregate da primeira abertura, ignorando conversas/gastos novos até trocar o filtro de período ou recarregar o plugin. Sem indicador de staleness. P1 defensável: são números de dinheiro que ficam errados silenciosamente (beira o 'engana o usuário'), e o fix é 1 linha no hide().

#### P1-61 · Estrela = favorito no composer, mas = default nas Settings; favorito nas Settings é bookmark

**Área:** Settings ↔ Composer · ícones de favorito/default · **Tipo:** consistency · **Esforço:** S

O ModelSheet do composer usa ícone star para favoritar (axxa-sheet-star, title Favorite/Unfavorite), gravando em favoriteModels. Nas Settings o MESMO conceito favoriteModels usa ícone bookmark, e o ícone star significa outra coisa (default do papel/provider, com write-through global). Usuário que aprendeu 'estrela = favorito' no composer vai estrelar um modelo nas Settings e sem querer trocar o modelo default do chat inteiro.

- **Evidência:** src/components/composer/ModelSheet.tsx:210-219 (star = favorite); AxxaSettingsTab.ts:1280 (setIcon(fav, 'bookmark')), 1293-1312 e 2072-2092 (star = default); screenshot ADHOC-conn-models-open-dark.png
- **Recomendação:** Unificar: favorito = mesmo ícone nos dois lugares (ex.: heart ou bookmark também no ModelSheet), e manter star exclusivo para 'default'. Alternativa: trocar o default para um radio/pin com label.
- **Nota do verificador:** Confirmado: src/components/composer/ModelSheet.tsx:208-220 usa Icon 'star' com aria-label/title Favorite/Unfavorite gravando favoriteModels; AxxaSettingsTab.ts:1280 usa setIcon(fav,'bookmark') para o MESMO conceito favoriteModels, e 1293-1312 usa 'star' para default do papel com write-through global (applyRoleSideEffects muda defaultProvider/modelo do chat inteiro). O trap descrito é real: estrela aprendida como 'favorito' no composer vira 'trocar default global' nas Settings, sem confirmação. P1 razoável dado o efeito colateral global de um mis-tap; effort S ok.

#### P1-62 · Sidebar declara role=dialog aria-modal mas não move nem prende o foco

**Área:** Sidebar · **Tipo:** a11y · **Esforço:** S

A gaveta anuncia aria-modal="true" (leitor de tela assume que o resto está inerte), mas ao abrir o foco fica no botão hambúrguer e o Tab continua navegando pelo app ATRÁS do scrim — o conteúdo de trás não fica inert (só a própria sidebar fica inert quando FECHADA). Usuário de teclado abre a gaveta e o Tab interage com elementos invisíveis sob o overlay; usuário de SR recebe semântica de modal que não corresponde ao comportamento.

- **Evidência:** src/components/layout/Sidebar.tsx:232-243 (role=dialog + aria-modal + inert só no aside) e 201-208 (só Escape, sem useFocusTrap); teste Playwright no story sidebar: activeElement fora da gaveta após abrir
- **Recomendação:** Reusar o useFocusTrap existente (src/components/_shared/useFocusTrap.ts) no aside quando open=true — ele já move o foco pra dentro, cicla o Tab e devolve o foco ao fechar. É o mesmo padrão já aplicado nos sheets do composer.
- **Nota do verificador:** Confirmado: Sidebar.tsx:232-243 — aside com role='dialog' aria-modal='true' e inert só no próprio aside quando FECHADO (ref: el.inert = !open); o conteúdo atrás nunca fica inert com a gaveta aberta. O único handler é Escape (201-208), sem useFocusTrap — grep confirma que useFocusTrap existe (src/components/_shared/useFocusTrap.ts) e é usado em ModelSheet, SuggestionsSheet, CameraModal e PlusModal, mas não na Sidebar. Semântica de modal sem comportamento de modal: Tab navega atrás do scrim. P1 de a11y correto; fix S reusando padrão já existente.

#### P1-63 · Emblema Founder/Premium/Free renderiza sem estilo nenhum (pill não existe) _(severidade possivelmente superestimada — ver nota)_

**Área:** sidebar/footer badge · **Tipo:** bug · **Esforço:** S

O componente aplica .axxa-sidebar-badge-{founder|premium|free} (Sidebar.tsx:433), mas no CSS a classe base .axxa-sidebar-badge (main.css:6987) não tem background, cor nem borda — só padding e tipografia. .axxa-sidebar-badge-founder (main.css:6997-7001) apenas DEFINE as vars --axxa-founder-1/2/ink e nada no arquivo as consome (grep confirma: única ocorrência é a definição). .axxa-sidebar-badge-premium e -free não têm regra alguma. Resultado: o emblema — sinal de status/monetização — vira um texto cinza 10px solto ao lado do nome, idêntico para os 3 planos.

- **Evidência:** styles/main.css:6987-7001 (sem background/cor; vars órfãs); screenshots sidebar--dark.png e sidebar--light.png: 'FOUNDER' aparece como texto plano, sem pill dourada
- **Recomendação:** Criar o visual das 3 variantes: founder com gradiente linear-gradient(var(--axxa-founder-1), var(--axxa-founder-2)) + color var(--axxa-founder-ink); premium com accent; free com surface neutra + borda. Provável regressão de uma limpeza de CSS — as vars já estão prontas.
- **Nota do verificador:** Confirmado: main.css:6987-6996 (.axxa-sidebar-badge) só tem padding/radius/tipografia, sem background/cor/borda; .axxa-sidebar-badge-founder (6997-7001) só define as vars --axxa-founder-* e o grep confirma que nada as consome (docs/AUDIT.md referencia uma linha 11388 que não existe mais — regressão de limpeza de CSS). Não há regra alguma para -premium/-free. Screenshot sidebar--light.png mostra 'FOUNDER' como texto plano cinza. Porém é P2, não P1: nada quebra nem gera fricção no caminho principal — é polish visual (importante, mas cosmético) no rodapé da sidebar.

#### P1-64 · Scrim da gaveta é 100% transparente — abrir a sidebar não escurece o conteúdo atrás _(severidade possivelmente superestimada — ver nota)_

**Área:** sidebar/scrim · **Tipo:** bug · **Esforço:** S

.axxa-sidebar-scrim (main.css:6584-6595) só define position/opacity/visibility/transition — não há background em nenhum lugar do arquivo (grep por 'scrim' só acha esse bloco e a lista de overlays da linha 807, que não inclui a sidebar). A transição de opacity 0.28s anima um elemento invisível. Sem dimming: zero hierarquia de profundidade entre drawer e conteúdo, e a área de 'tocar fora pra fechar' não tem nenhuma affordance visual.

- **Evidência:** styles/main.css:6584-6595 (nenhuma declaração de background); sidebar--light.png mostra a área à direita da gaveta totalmente branca, sem véu
- **Recomendação:** Dar background ao scrim (ex.: color-mix(in srgb, black 35%, transparent) ou o token de backdrop já usado pelos overlays da linha 807-811) — a transição de opacity existente passa a funcionar de graça.
- **Nota do verificador:** Confirmado: main.css:6584-6595 não declara background no scrim, e o bloco de overlays com backdrop (linhas 807-812) não inclui .axxa-sidebar-scrim; grep por 'scrim' no CSS só acha essas ocorrências. A transição de opacity anima um elemento invisível. Porém o elemento continua no DOM interceptando o tap-fora-pra-fechar — a funcionalidade está intacta, falta só o véu visual. É P2 (polish que profissionaliza), não P1: sem quebra nem fricção real, apenas hierarquia de profundidade ausente.

#### P1-65 · Empty state da SkillsScreen é beco sem saída: o botão "Create examples" existe, mas só em Settings→Vault _(severidade possivelmente superestimada — ver nota)_

**Área:** skills/empty-state · **Tipo:** flow · **Esforço:** S

Quem abre "+ → Apps & Skills" pela primeira vez vê "404 / No skills yet" e uma instrução de criar .md à mão — sem CTA. O seedExampleSkills (que resolveria em 1 toque) só é alcançável por Settings→Vault→"Create examples" (AxxaSettingsTab.ts:2226-2232), um caminho que o usuário não tem como adivinhar a partir da tela. Bônus: o copy do empty state hardcoda "axxa-ai/skills" (en-us.ts:62), errado se o usuário mudou skillsPath.

- **Evidência:** SkillsScreen.tsx:45-51 (empty sem ação); en-us.ts:60-62; AxxaSettingsTab.ts:2221-2243 (único ponto de seed).
- **Recomendação:** Botão primário "Criar 3 skills de exemplo" no empty state (chama plugin.seedExampleSkills e re-renderiza) + interpolar o skillsPath real no copy.
- **Nota do verificador:** Confirmado: SkillsScreen.tsx:45-51 renderiza só 404 + emptyTitle/emptySub, zero CTA; seedExampleSkills só é alcançável via AxxaSettingsTab.ts:2229 (Settings→Vault); en-us.ts:62 hardcoda '(axxa-ai/skills)' sem interpolar settings.skillsPath. Porém a severidade está superestimada: o empty state NÃO é beco sem saída — o copy explica como criar skills manualmente ('Create .md notes in the skills folder'), e Skills é um fluxo secundário, não o caminho principal (chat). É gap de descoberta no first-run de uma feature opcional → P2 (polish que profissionaliza), não P1. Fix continua valendo (S, alto retorno).

#### P1-66 · `mode` do frontmatter: sem validação, ignorado em silêncio quando locked, e sobrescreve defaultMode como efeito colateral

**Área:** skills/modo · **Tipo:** ux · **Esforço:** S

Três problemas no mesmo campo: (1) qualquer string passa (skills.ts:47) — "qa", "Vault-QA" viram mode inválido que cai silenciosamente em streamReply/chat (AxxaApp.tsx:954-956) e ainda é PERSISTIDO em settings.defaultMode (AxxaApp.tsx:1331); (2) com sessão locked, o slash pula a troca de modo sem avisar (AxxaApp.tsx:1519) — usar "Construir MOC" (vault-qa) no meio de um chat roda o prompt "usando minhas notas" SEM RAG, resultado enganoso; (3) o caminho da SkillsScreen (AxxaApp.tsx:1957-1959) nem checa isLocked e muda o defaultMode do usuário permanentemente ao usar qualquer skill.

- **Evidência:** skills.ts:47; AxxaApp.tsx:1519 vs 1957-1959 (guards divergentes); AxxaApp.tsx:1326-1333 (persiste defaultMode); AxxaApp.tsx:221-223 (coerção só no boot).
- **Recomendação:** Validar mode contra chat|vault-qa|agent no parse (descartar inválido); quando locked, mostrar Notice "essa skill roda em Vault Q&A — comece uma nova conversa"; e não persistir defaultMode quando a troca vem de skill.
- **Nota do verificador:** Confirmado nos três pontos. skills.ts:47 aceita qualquer string (`fm.mode ? String(fm.mode) : undefined`), sem validação contra chat|vault-qa|agent. AxxaApp.tsx:1519: no slash command, `if (s.mode && !isLocked) handleStarterMode(s.mode)` pula a troca em silêncio mas `handlePromptStarter(s.body)` roda mesmo assim — o prompt 'usando minhas notas' executa no modo atual sem RAG, sem aviso. AxxaApp.tsx:1957-1959 (SkillsScreen): sem checagem de isLocked; como activeMode = sessionMode ?? mode (linha 262), com sessão locked o setMode não muda a sessão atual, mas handleStarterMode (1326-1333) PERSISTE settings.defaultMode — inclusive strings inválidas, que só são coagidas pra chat no próximo boot (221-222, que aliás também engole 'agent'). P1 justo: resultado enganoso (resposta sem RAG apresentada como baseada nas notas) + mutação silenciosa de setting do usuário.

#### P1-67 · Skills ficam stale: editar/criar nota na pasta não recarrega — e a própria SkillsScreen convida a editar

**Área:** skills/reload · **Tipo:** state · **Esforço:** M

plugin.skills só é carregado no onload (main.ts:705), na troca de skillsPath e no botão manual "Reload skills" enterrado em Settings→Vault (AxxaSettingsTab.ts:2234-2243). Não há listener de vault (create/modify/delete) na pasta de skills. O fluxo quebrado: SkillsScreen tem botão "Open note" (SkillsScreen.tsx:79-87) que abre a nota pra edição; o usuário edita o template, volta, toca "Use" — e o corpo ANTIGO é injetado. Nota nova criada na pasta também não aparece até restart/reload manual, sem nenhuma pista do porquê.

- **Evidência:** main.ts:623-632 (call sites de reloadSkills: só onload/settings); SkillsScreen.tsx:79-87 (onOpenNote); ausência de registerEvent pra vault em main.ts.
- **Recomendação:** Registrar vault.on('create'|'modify'|'delete'|'rename') com filtro pelo prefixo da pasta + debounce, ou no mínimo recarregar ao abrir a SkillsScreen e ao focar o composer com "/".
- **Nota do verificador:** Confirmado: reloadSkills só é chamado no onload (main.ts:705), na troca de skillsPath (637) e nos botões das Settings (AxxaSettingsTab.ts:2214/2239). Os vault.on de main.ts:853-856 são exclusivos do auto-reindex do RAG (setupAutoReindex, gated por ragAutoReindex) — não tocam skills. SkillsScreen.tsx:82 tem 'Open note' que abre a nota pra edição, e o 'Use' injeta o corpo cacheado antigo. Fluxo edit→use quebrado sem pista = P1 razoável (secundário, mas convite da própria UI).

#### P1-68 · Usar uma skill apaga o texto que o usuário já tinha digitado no composer

**Área:** skills/slash-command · **Tipo:** bug · **Esforço:** M

O apply do /comando remove só o trecho "/cmd" (completions.ts:227-231), mas o execute da skill chama handlePromptStarter(s.body), e a injeção substitui o documento INTEIRO (changes: {from: 0, to: doc.length}) em Composer.tsx:620-623. O trigger aceita "/" após espaço (regex em completions.ts:198), então o caso "Contexto: reunião de ontem /resumo" é natural — e o contexto digitado é destruído sem aviso. Os corpos das skills de exemplo terminam em "Tema: " convidando a completar, o que agrava a perda.

- **Evidência:** completions.ts:198 e 227-231; Composer.tsx:620-623; AxxaApp.tsx:1520.
- **Recomendação:** Pra skills acionadas com texto pré-existente, inserir o corpo na posição do /cmd (ou prefixar o corpo preservando o rascunho), em vez de substituir o doc inteiro.
- **Nota do verificador:** Confirmado: apply remove só o trecho do /cmd (completions.ts:227-231), mas a injeção subsequente substitui o doc INTEIRO (changes {from:0, to:doc.length}, Composer.tsx:620-623); o trigger aceita '/' após espaço (regex na linha 198), então digitar contexto antes do /comando é fluxo suportado pela própria UI — e o texto é destruído sem aviso. Perda de dados digitados = P1 correto.

#### P1-69 · CTA 'See details in Settings → Usage' não abre a aba Usage — larga o usuário em Connections

**Área:** Statistics → Usage (navegação) · **Tipo:** flow · **Esforço:** S

O botão da tela Statistics promete levar ao Usage, mas `onOpenUsage={handleOpenSettings}` (AxxaApp.tsx:1590) só chama `app.setting.open()` + `openTabById('axxa-os-ai-agent')` (AxxaApp.tsx:1087-1098). O `activeTopTab` do settings tab permanece no default 'connections' (AxxaSettingsTab.ts:180) ou na última aba visitada. O usuário clica esperando os detalhes de custo e cai numa tela de API keys — quebra a promessa do botão no exato fluxo que a tela Statistics existe pra alimentar.

- **Evidência:** src/views/AxxaApp.tsx:1087-1098 e 1590; src/components/settings/AxxaSettingsTab.ts:180; screenshot statistics--dark.png (CTA visível)
- **Recomendação:** Expor um método público no AxxaSettingsTab (ex.: `openTopTab('usage')`) e chamá-lo no handleOpenSettings quando vindo do Statistics; padrão já usado por outros plugins via referência ao settingTab.
- **Nota do verificador:** Confirmado no código: handleOpenSettings (AxxaApp.tsx:1087-1098) só chama app.setting.open()+openTabById, sem selecionar top-tab; activeTopTab é privado, default 'connections' (AxxaSettingsTab.ts:180) e só muda por clique (linha 709). Nenhum método público pra abrir Usage existe. P1 correto: o botão promete uma tela e entrega outra, no fluxo que a Statistics existe pra alimentar. Effort S plausível.

#### P1-70 · 'Spend' diverge entre as três superfícies: Statistics mostra gross, Usage tab mostra billed, export mostra gross

**Área:** Statistics vs Usage vs Export · **Tipo:** consistency · **Esforço:** M

Com data-sharing ligado, o card headline do Usage tab vira `billed.billedCost` com label 'Billed (data-sharing)' (AxxaSettingsTab.ts:3405-3418), mas a tela Statistics soma o gross sem desconto (Screens.tsx:185) e os exports MD/PDF também usam `agg.total.cost` gross (export.ts:86, 308). O mesmo usuário vê três valores diferentes de 'quanto gastei'. Agravante: a Statistics omite o asterisco de `hasUnknownCost` — apresenta custo parcial como se fosse total (Screens.tsx:185 usa formatUsd puro; a Usage tab adiciona '*' na linha 3418).

- **Evidência:** src/components/screens/Screens.tsx:185; src/components/settings/AxxaSettingsTab.ts:3405-3418; src/usage/export.ts:86 e 308
- **Recomendação:** Definir UMA fonte de verdade do headline (sugestão: gross com nota 'billed: $X' quando data-sharing on) e aplicá-la nas três superfícies; propagar o asterisco de pricing desconhecido à Statistics.
- **Nota do verificador:** Confirmado: Screens.tsx:185 usa agg.total.cost sem asterisco; Usage tab usa billed.billedCost com '*' (AxxaSettingsTab.ts:3411-3418); export usa gross com '*' (export.ts:86/308). Detalhe: o export NÃO omite o asterisco (o revisor não afirmou isso, só a Statistics — correto). A divergência billed/gross só aparece com data-sharing ligado, mas a omissão do '*' na Statistics vale pra todos com pricing desconhecido, e a Statistics linka direto pra Usage via CTA — o usuário vê os dois números em sequência. P1 defensável.

#### P1-71 · Card "Spend" ignora custos desconhecidos e apresenta gasto subestimado como total

**Área:** StatisticsScreen · **Tipo:** state · **Esforço:** S

O agregador marca hasUnknownCost quando um chat usa modelo sem pricing (o custo vira null e NÃO entra na soma), mas a StatisticsScreen nunca lê essa flag: mostra formatUsd(agg.total.cost) seco. Um usuário com chats em claude-fable-5 (pricing null por design em pricing.ts:67) vê um Spend menor que o real, sem nenhum aviso. Pior: na lista Top models, um modelo 100% sem pricing aparece com "$0.00" — indistinguível de modelo gratuito.

- **Evidência:** src/components/screens/Screens.tsx:185 e 198 (formatUsd direto, sem checar flag); src/usage/aggregate.ts:77-81 (cost null vira hasUnknownCost=true e fica fora da soma); src/usage/pricing.ts:67 (claude-fable-5 com inputPerMillion null); screenshot statistics--dark.png (Spend $0.481 sem qualquer qualificador).
- **Recomendação:** Quando agg.total.hasUnknownCost, prefixar o valor com "≥" e adicionar uma nota curta ("alguns modelos sem preço conhecido"); nas rows de modelo com hasUnknownCost e cost 0, mostrar "—" em vez de $0.00.
- **Nota do verificador:** Confirmado. aggregate.ts:73-82: cost null seta hasUnknownCost=true e fica fora da soma; Screens.tsx:185 e :198 chamam formatUsd direto sem ler a flag — grep confirma que hasUnknownCost não é lido em nenhum componente de tela. pricing.ts:67: claude-fable-5 com inputPerMillion/outputPerMillion null por design, então o cenário é o caso comum, não edge case. Número financeiro subestimado apresentado como total, e modelo sem pricing indistinguível de gratuito ($0.00): P1 correto, fix S.

#### P1-72 · Parar a geração no meio não deixa rastro: resposta parcial fica idêntica a uma completa e não há como continuar

**Área:** Stop durante o stream · **Tipo:** state · **Esforço:** M

Em streamReply, o AbortError só é tratado quando NENHUM token chegou (marca 'Pensando…' como Interrupted); com resposta parcial, nada acontece (useChatEngine.ts:283-290) — o footer normal aparece e a mensagem cortada parece completa, sem chip 'interrompida' e sem botão Continuar (truncated nunca é setado no abort). Pior: em continueReply, setTruncated(false) roda no início (AxxaApp.tsx:819) e o AbortError não o restaura (só erro não-abort restaura, linha 895) — abortar uma continuação faz o botão Continuar sumir de vez, um beco sem saída para retomar a resposta.

- **Evidência:** useChatEngine.ts:283-290 (abort com responseId != null cai no vazio); AxxaApp.tsx:819 (setTruncated(false)), 889-896 (truncated só restaurado em erro não-abort)
- **Recomendação:** No abort com resposta parcial, marcar a mensagem (ex.: setTruncated(true) ou um badge 'Geração interrompida') pra habilitar o Continuar; no continueReply, restaurar truncated também no caminho de AbortError.
- **Nota do verificador:** Confirmado: useChatEngine.ts:283-290 — AbortError com responseId!==null não faz nada (truncated nunca setado; heurística de :270-276 só pega corte por maxTokens). E continueReply: setTruncated(false) em AxxaApp.tsx:819, restaurado só no branch não-abort (:890-896) — abortar uma continuação mata o botão Continuar permanentemente. A metade 'stop parece completo' sozinha seria P2 (o usuário parou de propósito), mas o beco sem saída do continue+abort é bug de estado real; P1 sustentável no conjunto.

#### P1-73 · No mobile, o 3º card do Agent corta no meio da palavra e o 'See more' fica 100% fora da tela _(severidade possivelmente superestimada — ver nota)_

**Área:** Sugestões do Agent (cards horizontais) · **Tipo:** ux · **Esforço:** M

No newchat-agent mobile o scroller horizontal (.axxa-suggest-cards) mostra 'Create a note', 'Organize a folder' e um terceiro card serrado no meio do label ('List to-'), com o botão 'See more' totalmente fora do viewport. A scrollbar é escondida de propósito (scrollbar-width:none + ::-webkit-scrollbar display:none, main.css:1459-1466), não há fade/gradiente de borda nem scroll-snap — o corte cru do texto é a única pista de que há mais conteúdo, e a porta de entrada para as outras 9 sugestões (o sheet) fica invisível justamente no modo mais 'vendável' do produto. Nos outros dois modos o 'See more' está sempre visível; só o Agent esconde o dele.

- **Evidência:** screenshot newchat-agent--dark.png e --light.png (card 'List to-' serrado, sem See more); styles/main.css:1452-1466 (overflow-x:auto com scrollbar suprimida, sem mask/snap); ComposerSuggestions.tsx:131-143 (See more é o último item do scroller)
- **Recomendação:** Tirar o 'See more' de dentro do scroller (fixo à direita com fade por trás, ou como linha abaixo dos cards) e desenhar o peek: dimensionar os cards (ex.: flex-basis calc((100% - gap)/2.4)) para o 3º aparecer ~40-60% cortado de forma intencional, + scroll-snap-type:x proximity e uma máscara de fade na borda direita.
- **Nota do verificador:** Confirmado no screenshot newchat-agent--dark.png: 'List to-' serrado no meio do label e See more invisível; main.css:1459-1466 suprime a scrollbar e não há mask/snap; nos modos chat e qa o See more aparece (screenshots). Real. Mas P1 superestima: o caminho principal da tela é o composer (totalmente visível e funcional), sugestões são auxiliares, e o card cortado — ainda que feio — É um affordance de scroll que leva ao See more. É inconsistência + polish de scroller (P2), não fricção bloqueante no caminho principal.

#### P1-74 · Modais com campo de texto ficam atrás do teclado: só o ConfirmationModal tem a classe keyboard-aware

**Área:** Teclado mobile — modais · **Tipo:** bug · **Esforço:** S

O AxxaView marca o body com .axxa-keyboard-open exatamente 'pra modais poderem se reposicionar quando o teclado virtual abre' (AxxaView.tsx:101-104), mas o CSS que reposiciona exige .axxa-modal-keyboard-aware dentro do .modal-container (main.css:5147) — e essa classe só é adicionada no ConfirmationModal (ConfirmationModal.ts:55). RenameChatModal (input de texto que recebe focus() e abre o teclado, RenameChatModal.ts:39-49,74-77), PersonaModal (textarea) e ImageGenModal não têm a classe: no mobile o modal continua centralizado verticalmente e a metade de baixo (botões Salvar/Cancelar) fica atrás do teclado. Renomear uma conversa no celular — ação do caminho principal — vira beco sem saída visual.

- **Evidência:** src/components/agent/… → src/agent/ConfirmationModal.ts:55 (único addClass), styles/main.css:5147-5157, src/components/chat/RenameChatModal.ts:39-49, src/views/AxxaView.tsx:101-104 (comentário admite o problema que a classe resolve)
- **Recomendação:** Adicionar .axxa-modal-keyboard-aware em todo modal que contém input/textarea (Rename, Persona, ImageGen, ChatSearch) — ou inverter a lógica: aplicar o reposicionamento a qualquer .modal-container quando body.axxa-keyboard-open, e usar a classe só como opt-out.
- **Nota do verificador:** Confirmado: grep mostra que .axxa-modal-keyboard-aware só é adicionada em ConfirmationModal.ts:55; o CSS de reposicionamento (main.css:5147-5157) exige a classe dentro do .modal-container via :has. RenameChatModal.ts, PersonaModal.ts e ImageGenModal.ts adicionam só suas classes próprias (rename:35, persona:38, imggen:99) — nenhuma keyboard-aware. AxxaView.tsx:100-104 seta body.axxa-keyboard-open exatamente pra esse fim. Nota: o fallback @supports not(:has) (main.css:5158-5163) cobriria TODOS os modais, mas webviews do Obsidian mobile suportam :has, então o caminho principal exige a classe. ChatSearchModal é SuggestModal (posicionamento próprio do Obsidian) — caso mais fraco, mas Rename/Persona/ImageGen são reais. P1 ok: renomear conversa é caminho principal no mobile e o próprio produto já reconheceu o problema ao criar a infra.

#### P1-75 · Saldo estimado infla quando um filtro de período está ativo

**Área:** Usage → Balance · **Tipo:** bug · **Esforço:** S

`renderBalancePanel` calcula `spentSinceFromRows(agg.chats, p, earliest)` (AxxaSettingsTab.ts:3044), mas `agg.chats` já vem filtrado pelo período dos pills (aggregateFromSummaries com usagePeriodDays, linha 2978-2981). Com 'Last 7 days' selecionado, o gasto desde a recarga mais antiga ignora tudo anterior a 7 dias → saldo = recargas − gasto parcial, mostrando mais dinheiro do que o usuário tem. Saldo é conceito absoluto e não deveria responder ao filtro de visualização.

- **Evidência:** src/components/settings/AxxaSettingsTab.ts:2978-2981, 3034-3050; src/usage/balance.ts:28-40
- **Recomendação:** Passar ao painel de saldo as rows SEM filtro de período (agregar uma vez sem filtro e derivar a visão filtrada só para tabelas/heatmap).
- **Nota do verificador:** Confirmado: agg vem de aggregateFromSummaries(summaries, this.usagePeriodDays) (AxxaSettingsTab.ts:2978-2981) e agg.chats já passou por filterByPeriod (aggregate.ts:126-133, 161); renderBalancePanel usa agg.chats em spentSinceFromRows (3044), que só corta por data mínima (balance.ts:34-38). Com 'Last 7 days', gasto anterior a 7 dias desaparece do débito → saldo mostrado maior que o real. P1 correto: número de dinheiro errado dependendo de um filtro de visualização.

#### P1-76 · Cross-check compara janelas de tempo diferentes sem avisar — 'Estimated' vs 'Real' não são comparáveis

**Área:** Usage → Real billing cross-check · **Tipo:** bug · **Esforço:** M

A coluna 'Estimated' usa o período selecionado nos pills (inclusive All time), mas o fetch do 'Real' força `periodDays > 0 ? periodDays : 30` (AxxaSettingsTab.ts:3279-3282) — com 'All time' selecionado, compara estimativa vitalícia contra custo real de 30 dias. Pior: o 'Real' do OpenRouter é `b.usageUsd` do /auth/key, que é o gasto VITALÍCIO da key (providerBilling.ts:64-65, 3292), independente do período — mesmo com 'Last 7 days' o real é lifetime. A tabela põe os dois lado a lado como se fossem o mesmo recorte, induzindo o usuário a achar que a estimativa está errada.

- **Evidência:** src/components/settings/AxxaSettingsTab.ts:3279-3282, 3292; src/usage/providerBilling.ts:63-65
- **Recomendação:** Anotar a janela real usada em cada célula (ex.: 'últimos 30d' / 'lifetime da key') ou alinhar: quando All time, usar a data do chat mais antigo como start_time; para OpenRouter, deixar explícito que é total da key.
- **Nota do verificador:** Confirmado: AxxaSettingsTab.ts:3279 força periodDays=30 quando usagePeriodDays<=0 (All time); OpenRouter usa usageUsd do /auth/key que é o gasto vitalício da key (providerBilling.ts:64-65, 81), exibido sem qualificação (3292) independente do período. Nenhuma célula anota a janela usada. P1 correto: a feature existe pra validar a estimativa e induz conclusão errada.

#### P1-77 · Custo de geração de imagem/TTS nunca entra no Usage — usuário que gera imagens vê $0.00

**Área:** usage/aggregate + geração de imagem · **Tipo:** bug · **Esforço:** L

A tabela de preços tem `imagePerCall`/`charPerMillion` (pricing.ts:214-216) e a UI de geração até mostra `pricePerImage` (useGeneration.ts:204), mas o frontmatter dos chats só persiste tokens_in/tokens_out (chatPersistence.ts:139-140) e `summaryToRow` chama `calculateCost(pricing, tokensIn, tokensOut)` sem imageCount (aggregate.ts:105). Chats do modo generation aparecem com custo ~$0 nas tabelas 'By mode' e no Spend total — o número que o produto vende como 'quanto você gastou' subconta silenciosamente exatamente o modo mais caro por chamada.

- **Evidência:** src/usage/aggregate.ts:105; src/usage/pricing.ts:214-216; src/components/_shared/chatPersistence.ts:139-140; src/views/useGeneration.ts:204
- **Recomendação:** Persistir `images_count` (e chars de TTS) no frontmatter do chat de geração e passar ao calculateCost no aggregate; até lá, marcar buckets do modo generation com o mesmo '*' de custo parcial.
- **Nota do verificador:** Confirmado o núcleo: calculateCost aceita imageCount/charCount (pricing.ts:214-221), a UI de geração mostra pricePerImage (useGeneration.ts:204), mas o frontmatter só persiste tokens_in/tokens_out (chatPersistence.ts:139-140) e summaryToRow chama calculateCost só com tokens (aggregate.ts:105) — custo de imagem/TTS jamais entra no Spend. Nuance menor: o detalhe sobre bucket 'By mode' de generation depende de como o chat de geração é persistido, mas não muda a subcontagem. P1 e effort L razoáveis.

#### P1-78 · Index vault valida a API key errada para embeddings Gemini e NIM

**Área:** Vault → RAG (indexação) · **Tipo:** bug · **Esforço:** S

runIndex só tem dois ramos de validação: provider 'openrouter' exige openrouterApiKey, e QUALQUER outro exige openaiApiKey (AxxaSettingsTab.ts:2728-2742). Mas o dropdown de provider de embedding oferece 4 opções, incluindo Gemini e Nvidia NIM (linhas 2411-2417). Um usuário só-Gemini que escolhe embedding do Gemini e clica 'Index vault' recebe o erro enganoso 'OpenAI API key not configured' e trava — mesmo tendo tudo que precisa (indexVault já recebe geminiApiKey/nimApiKey, linha 2807-2808).

- **Evidência:** src/components/settings/AxxaSettingsTab.ts:2728-2742 (validação binária openrouter/openai) vs 2411-2417 (4 providers no dropdown) e 2804-2808 (indexVault aceita as 4 keys)
- **Recomendação:** Validar a key do provider do modelo escolhido (mapa provider→key), com mensagem apontando a aba certa: 'Gemini API key not configured — Settings → Connections → Gemini'.
- **Nota do verificador:** Confirmado: runIndex (AxxaSettingsTab.ts:2732-2742) só tem os ramos openrouter→openrouterApiKey e else→openaiApiKey, enquanto o dropdown oferece 4 providers (2411-2417, ORDER inclui gemini e nim) e indexVault já recebe geminiApiKey/nimApiKey (2807-2808). Usuário só-Gemini recebe 'OpenAI API key not configured' e fica bloqueado com mensagem enganosa. P1 correto (beira P0 por enganar, mas P1 aceitável pois é fluxo secundário).

#### P1-79 · Strings em português hardcoded vazam na UI em inglês (Vault e Usage)

**Área:** Vault + Usage (copy) · **Tipo:** copy · **Esforço:** S

Fora do i18n, sobraram strings PT que aparecem na UI EN: (1) dropdown de embedding mostra 'OpenAI (texto)' (EMB_PROVIDER_LABEL hardcoded, linha 2412 — visível no screenshot da tab Vault); (2) Notices do RAG 'Índice removido.' e 'Falha: …' (linhas 2658-2661); (3) tabela Real billing exibe 'Custos reais exigem uma Admin key (sk-admin-…)' (providerBilling.ts:32 e 37 — visível no screenshot do Usage); (4) tooltip/aria do heatmap usa 'conversa/conversas' (linha 3497); (5) células de erro mostram 'erro' (linhas 3149, 3295, 3317, 3334). Nota: distinto do item PT/EN de metadados de modelos/providers já resolvido — estes são pontos remanescentes.

- **Evidência:** AxxaSettingsTab.ts:2412, 2658-2661, 3497, 3149; src/usage/providerBilling.ts:32,37; screenshots ADHOC-settings-vault-dark.png ('OpenAI (texto)') e ADHOC-settings-usage-dark-full.png ('Custos reais exigem uma Admin key')
- **Recomendação:** Mover essas 5 strings para o i18n (t.settings.*) com versão EN: 'OpenAI (text)', 'Index deleted.', 'Failed: …', 'Real costs require an Admin key (sk-admin-…)', 'chat/chats', 'error'.
- **Nota do verificador:** Todos os 5 pontos confirmados: 'OpenAI (texto)' (AxxaSettingsTab.ts:2412), Notices 'Índice removido.'/'Falha: …'/'Erro' (2658-2661, também 2831), notas de billing PT em providerBilling.ts:28,32,37,42,47 (mais que as 2 citadas), 'conversa/conversas' no aria do heatmap (3497) e 'erro' nas células (3149, 3295, 3317, 3334). Distinto do item de metadados já resolvido — estas strings continuam hardcoded. P1 ok: PT vazando em UI EN nas telas principais de Settings quebra a percepção de qualidade.

#### P1-80 · Strings da busca do vault hardcoded em português num produto 100% inglês

**Área:** vault-qa/busca (activity no chat) · **Tipo:** copy · **Esforço:** S

O activity de busca mostra "Buscando até ${topK} trechos (híbrido)", "Busca concluída" e "N trecho(s) encontrado(s)" — tudo PT hardcoded. O produto só tem i18n en-us, e as chaves corretas JÁ EXISTEM (t.vault.searching, t.vault.foundContext) mas não são usadas; só t.vault.notFound é usada. Usuário EN vê PT no meio do fluxo principal, e ainda com jargão interno ("trechos", "híbrido", número de topK).

- **Evidência:** src/views/useChatEngine.ts:112 (pendingText: `Buscando até ${topK} trechos (híbrido)`), :114 e :143 (doneText PT); src/i18n/en-us.ts:497-504 define vault.searching/foundContext; grep confirma que só notFound é referenciado (useChatEngine.ts:149).
- **Recomendação:** Trocar pelas chaves i18n existentes (t.vault.searching / t.vault.foundContext) e alinhar a unidade ("notes" vs "trechos") — decidir se o copy fala em notas ou passages e usar o mesmo termo nos dois estados.
- **Nota do verificador:** Confirmado: useChatEngine.ts:112 ('Buscando até ${topK} trechos (híbrido)'), :113 ('Busca concluída') e :143 ('N trecho(s) encontrado(s)') — PT hardcoded; en-us.ts:497-505 define vault.searching(topK,effort) e vault.foundContext(count) prontas e não usadas (só notFound em :149). PT visível no fluxo principal de um produto EN; P1 correto, effort S mesmo.

#### P1-81 · Clicar numa citação não resolvida cria silenciosamente uma nota vazia no vault

**Área:** vault-qa/citações [[wikilink]] · **Tipo:** bug · **Esforço:** S

enhanceInternalLinks chama app.workspace.openLinkText(href, "") sem checar se o link resolve. Se a IA alucinar um [[Título]] fora da lista, errar maiúscula/acento, ou a nota tiver sido renomeada desde a busca, o tap na citação — a ação central do modo — CRIA uma nota vazia no vault do usuário sem aviso. Num produto cujo pitch é "clickable note citations", isso transforma o erro do modelo em poluição real do vault.

- **Evidência:** src/components/_shared/Markdown.tsx:114-131 (openLinkText incondicional, sourcePath ""); comportamento padrão do Obsidian para openLinkText não resolvido é criar a nota; system prompt tenta mitigar ("Do not invent notes", en-us.ts:633-640) mas não elimina.
- **Recomendação:** Antes de abrir, resolver com app.metadataCache.getFirstLinkpathDest(href, ""); se null, mostrar Notice "Note not found: X" (chave pickNoteNotFound já existe em en-us.ts:482) em vez de criar.
- **Nota do verificador:** Confirmado. src/components/_shared/Markdown.tsx:114-131: enhanceInternalLinks chama app.workspace.openLinkText(href, "", newLeaf) incondicionalmente, sem getFirstLinkpathDest antes. Comportamento padrão do Obsidian para link não resolvido via openLinkText é criar a nota. Como as citações são geradas pelo modelo (podem alucinar/errar case), o clique — ação central do modo — pode poluir o vault sem aviso. A chave pickNoteNotFound existe pra reaproveitar. P1/S corretos (dá pra argumentar P0, mas P1 não está superestimado).

#### P1-82 · Degradação semântica→keyword é invisível: label sempre diz "híbrido"

**Área:** vault-qa/degradação RAG · **Tipo:** state · **Esforço:** M

Sem índice (vectorIndex null/vazio) ou quando embedQuery falha (key removida, rate limit), hybridSearch cai silenciosamente pra keyword-only — o único registro é console.warn. A UI sempre anuncia "(híbrido)" no pendingText, e o campo `via` de cada hit ("semantic"/"keyword"/"semantic+keyword") é calculado e descartado. O usuário que indexou o vault (gastando tokens) não tem como saber que uma busca degradou; o que não indexou acha que tem busca semântica. Resposta direta à pergunta da tarefa: NÃO, a degradação não é comunicada.

- **Evidência:** src/rag/hybrid.ts:58 (if index && size>0), :74-78 (catch só com console.warn), :89 (via montado); src/views/useChatEngine.ts:112 (label fixo "híbrido"), :132-144 (via nunca chega à UI). Nenhum uso de vectorIndex/semantic/keyword em src/components/chat/*.
- **Recomendação:** No doneText do activity, refletir a origem real: "N notes (semantic + keyword)" quando houve semantic, "N notes (keyword only — no semantic index)" no fallback; quando o embed falhar com índice presente, marcar o activity com aviso ("semantic search failed, used keyword") em vez de console.warn.
- **Nota do verificador:** Confirmado no código. src/rag/hybrid.ts:58 só entra no braço semântico se index && size>0; :74-78 o catch de embedQuery é só console.warn e segue keyword-only; :85-90 monta `via` por hit. src/views/useChatEngine.ts:112 fixa pendingText 'Buscando até N trechos (híbrido)' e :141-143 o doneText é só contagem — `via` nunca chega à UI (grep em src/components/chat não acha vectorIndex/semantic/keyword). O usuário não tem como saber se a busca foi semântica ou degradou. P1 justo: fricção/engano no caminho principal do modo Vault Q&A.

#### P1-83 · Setting "chars per excerpt" (por effort) é ignorado — hybrid fixa 500

**Área:** vault-qa/effort → excerpt · **Tipo:** bug · **Esforço:** S

O effort promete escalar topK E excerptChars (low=300…max=2000; sliders em Settings: "Vault Q&A: chars per excerpt"). Mas useChatEngine só destrutura topK, e hybrid.ts hardcoda 500 tanto no chunk semântico (slice(0,500)) quanto na chamada searchVault(…, 500). O usuário ajusta o slider/effort e nada muda no contexto injetado — setting morto que engana.

- **Evidência:** src/views/useChatEngine.ts:102 (const { topK } = effortToVaultLookup(...)); src/rag/hybrid.ts:72 (r.entry.text.slice(0, 500)) e :82 (searchVault(app, query, topK*3, 500)); src/components/_shared/effort.ts:213-225 e en-us.ts:688-689 prometem o comportamento.
- **Recomendação:** Passar excerptChars pra hybridSearch (novo campo em HybridOptions) e usar nos dois braços; ou remover o slider/documentação até implementar.
- **Nota do verificador:** Confirmado. src/views/useChatEngine.ts:102 destrutura só { topK } de effortToVaultLookup (que retorna topK E excerptChars — effort.ts:225); src/rag/hybrid.ts:72 hardcoda slice(0,500) e :82 searchVault(app, query, topK*3, 500). HybridOptions (hybrid.ts:32-40) nem tem campo excerptChars. O slider existe na UI (en-us.ts:688 'Vault Q&A: chars per excerpt') e o comentário em useChatEngine.ts:97 até promete 'low=3×300 ... max=12×2000'. Setting morto de verdade. P1/S corretos.

#### P1-84 · Nenhum caminho da superfície Vault Q&A leva ao indexador RAG

**Área:** vault-qa/onboarding do índice · **Tipo:** flow · **Esforço:** M

O onboarding vende "Vault Q&A with local RAG" (en-us.ts:585), mas a tela New Q&A só mostra picker de provider (screenshot) — zero status do índice. Sem índice, tudo "funciona" via keyword sem aviso, e o CTA "Index vault" existe apenas enterrado em Settings→Vault. Usuário nunca descobre que está usando a versão degradada do feature principal do modo, nem o que fazer pra melhorar.

- **Evidência:** Screenshot newchat-qa--dark.png/--light.png (só PROVIDER row + suggestions); src/components/chat/NewChatScreen.tsx:16-23; CTA só em Settings (en-us.ts:884 ragIndexBtn, :889 ragStatsEmpty); grep: vectorIndex não aparece em nenhum componente de chat.
- **Recomendação:** Chip de status na tela New Q&A ("Semantic index: 1.2k notes · last indexed X" / "No semantic index — using keyword search. Build index →" linkando pra Settings→Vault). Um estado, um link — resolve descoberta e comunicação de degradação de uma vez.
- **Nota do verificador:** Confirmado. src/components/chat/NewChatScreen.tsx renderiza só head (ícone/título/sub), SegmentedRow de provider e sugestões — zero referência ao índice. Grep por vectorIndex/ragIndex em src/components só bate em settings/AxxaSettingsTab.ts (:2631 botão Index, :2669 stats). Combinado com o achado 1 (fallback silencioso), o usuário sem índice usa a versão degradada do feature sem nunca descobrir. P1 ok.

#### P1-85 · 'Test voice' apertado durante 'Speaking…' trava o modo voz permanentemente nesse estado

**Área:** VoiceScreen (ajustes) · **Tipo:** bug · **Esforço:** S

O botão de ajustes fica habilitado em qualquer estado, e 'Test voice' chama `speak()` direto (VoiceScreen.tsx:344-346) sem `claimSpeaker` e sem callbacks. `speak()` desconecta os handlers do utterance anterior antes do cancel (speech.ts:163-168) — ou seja, o `onEnd` da resposta que estava tocando NUNCA dispara, `setState("idle")`/`startListening()` nunca rodam, e o estado fica preso em 'speaking' com o mic desabilitado (`disabled={... state === "speaking"}`, linha 290). Única saída é fechar e reabrir o modo voz.

- **Evidência:** src/components/chat/VoiceScreen.tsx:341-350 (speak sem claim/onEnd) + 290 (mic disabled em speaking); src/components/_shared/speech.ts:163-168 (handlers do lastUtter anulados)
- **Recomendação:** No 'Test voice', fazer `claimSpeaker(voiceResetRef.current)` antes de falar (o reset devolve pra idle), ou desabilitar o botão enquanto state === 'speaking'/'thinking'.
- **Nota do verificador:** Confirmado: VoiceScreen.tsx:344-346 chama speak() sem claimSpeaker e sem onEnd; speech.ts:163-166 anula onend/onerror do utterance anterior antes do cancel (e stopCloudAudio:84-88 faz o mesmo no caminho cloud TTS), então o onEnd da resposta que tocava nunca dispara, o state fica preso em speaking com mic disabled (linha 290). Única saída é fechar/reabrir. Cenário plausível (ajustar voz enquanto a resposta toca é exatamente quando o usuário abre os ajustes); travamento permanente justifica P1.

#### P1-86 · Erros de reconhecimento são engolidos — permissão de mic negada vira silêncio total

**Área:** VoiceScreen (erros de STT) · **Tipo:** state · **Esforço:** M

`onError: () => setState("idle")` (VoiceScreen.tsx:108) e `startDictation` descarta o objeto de erro (`rec.onerror = () => handlers.onError?.()`, speech.ts:252), então 'not-allowed' (sem permissão de microfone), 'network', 'no-speech' e 'audio-capture' são indistinguíveis e invisíveis. Caso concreto: usuário nega a permissão do mic → toca no mic → status volta a 'Tap the mic to talk' em ~1s sem nenhuma mensagem → toca de novo → mesmo nada. Parece que o app está quebrado, e o caminho de correção (dar permissão nas configurações do SO) nunca é comunicado.

- **Evidência:** src/components/chat/VoiceScreen.tsx:108; src/components/_shared/speech.ts:252 (evento de erro descartado)
- **Recomendação:** Propagar `e.error` no onError do startDictation e mapear pra microcopy no status: 'Microphone permission denied — enable it in system settings', 'No internet for speech recognition', etc. Estado visual de erro no orb (cor de aviso).
- **Nota do verificador:** Confirmado: VoiceScreen.tsx:108 (onError: () => setState("idle")) e speech.ts:252 (rec.onerror = () => handlers.onError?.() — o evento com e.error é descartado). not-allowed/network/no-speech são indistinguíveis e nada é mostrado ao usuário. Permissão negada é cenário de primeira utilização, no caminho principal do modo voz; P1 correto.

#### P1-87 · Permissão de mic negada ou STT quebrado falham em silêncio — usuário toca, nada acontece, nenhuma explicação

**Área:** VoiceScreen (erros de STT) · **Tipo:** ux · **Esforço:** M

speech.ts descarta o código do erro do SpeechRecognition (rec.onerror = () => handlers.onError?.()), então o VoiceScreen não distingue 'not-allowed' (permissão negada), 'network' (Electron desktop: o ctor existe mas o serviço de speech do Chromium falha sempre — sttOk é true e nunca funciona) e 'no-speech' (silêncio normal). O onError só faz setState('idle'): o usuário toca no mic, vê 'Listening…' por um instante e volta para 'Tap the mic to talk', em loop, sem nenhuma mensagem. O Composer, em contraste, mostra Notice de micDenied — o Modo Voz não mostra nada.

- **Evidência:** src/components/_shared/speech.ts:252 (erro descartado); src/components/chat/VoiceScreen.tsx:108 (onError → idle silencioso); contraste com Composer.tsx:737 (Notice micDenied).
- **Recomendação:** Propagar o error.code no onError; em 'not-allowed'/'audio-capture'/'network' mostrar mensagem persistente na área de status ('Microfone sem permissão — habilite nas configurações do sistema') e desabilitar o mic com o motivo; 'no-speech' segue silencioso.
- **Nota do verificador:** CONFIRMADO. speech.ts:252 (rec.onerror = () => handlers.onError?.()) descarta o código do erro, e VoiceScreen.tsx:108 (onError: () => setState('idle')) só volta pra idle sem nenhuma mensagem — 'not-allowed', 'network' e 'no-speech' são indistinguíveis e todos silenciosos. O contraste com o Composer existe (Composer.tsx:737 mostra Notice micDenied no getUserMedia — pipeline diferente, MediaRecorder, mas o ponto de UX vale). sttOk (linha 57) só checa a existência do ctor, então o caso Electron/network fica true e falha sempre em loop mudo. P1 justo: caminho principal do Modo Voz falha sem explicação.

#### P1-88 · Impossível interromper: mic desabilitado em thinking/speaking e nenhum botão de 'parar'

**Área:** VoiceScreen (fluxo) · **Tipo:** ux · **Esforço:** M

Durante 'Speaking…' e 'Thinking…' o único controle da tela (mic) fica `disabled` (VoiceScreen.tsx:290) e não existe botão de stop/skip. Uma resposta longa é lida até o fim sem escapatória — não dá pra cortar a fala e emendar ('barge-in', padrão das referências ChatGPT/Grok citadas no header do arquivo) nem cancelar uma geração demorada (o botão de stop do composer fica escondido atrás do overlay). A única saída é fechar o modo voz inteiro.

- **Evidência:** src/components/chat/VoiceScreen.tsx:282-296 (único controle, disabled em thinking/speaking); nenhum handler de interrupção no componente
- **Recomendação:** Em 'speaking': mic vira 'tocar para interromper' (cancelSpeech + startListening). Em 'thinking': mostrar botão de cancelar que aborta o stream (abortRef já existe no AxxaApp).
- **Nota do verificador:** Confirmado: VoiceScreen.tsx:282-296 é o único controle da tela e fica disabled={!sttOk || state==="thinking" || state==="speaking"}; nenhum handler de barge-in ou de cancelar geração existe no componente. Resposta longa é lida até o fim; única saída é fechar o modo. Barge-in é padrão nas referências citadas no próprio header do arquivo. P1 correto.

#### P1-89 · Não dá para interromper a fala da IA — mic desabilitado durante 'speaking' e 'thinking'

**Área:** VoiceScreen (loop de conversa) · **Tipo:** flow · **Esforço:** S

Durante a leitura da resposta o botão de mic fica disabled, e não há nenhum outro controle de 'parar de falar'. Se a IA lê uma resposta longa (pior em velocidade 0.5x), o usuário é refém do áudio: a única saída é fechar o Modo Voz inteiro, perdendo o fluxo. Todos os concorrentes de referência (ChatGPT/Grok, citados no próprio header do arquivo) permitem barge-in: tocar para cortar a fala e voltar a ouvir.

- **Evidência:** src/components/chat/VoiceScreen.tsx:290 (disabled={!sttOk || state === 'thinking' || state === 'speaking'}).
- **Recomendação:** Em 'speaking', transformar o botão em 'parar' (cancelSpeech() → startListening()); tocar no orb com o mesmo efeito. Em 'thinking', permitir cancelar via onStop.
- **Nota do verificador:** CONFIRMADO. VoiceScreen.tsx:290: disabled={!sttOk || state === 'thinking' || state === 'speaking'}. Não há nenhum outro controle de parada na tela (orb é aria-hidden e sem onClick, linhas 273-280); a única saída durante 'speaking' é handleClose (fecha o modo inteiro, linha 184-188). toggleMic (122-129) só age em listening/idle. Sem barge-in mesmo. P1 correto — em rate 0.5x com resposta longa o usuário fica refém do áudio.

#### P1-90 · Orb sem nenhuma animação/diferenciação de estado — feedback de escuta é só texto

**Área:** VoiceScreen (orb/estados) · **Tipo:** state · **Esforço:** M

O comentário do componente promete 'orb animado por estado' (VoiceScreen.tsx:4) e o TSX renderiza dois rings (linhas 276-277), mas o CSS deixa `.axxa-voice-orb-ring` com `opacity:0` permanente (main.css:3122) e NÃO existe nenhum `@keyframes` para o orb (os únicos keyframes do arquivo são chat-in/caret/shimmer/rec-pulse/suggest-in, linhas 333-1396). Também não há regra alguma para `.axxa-voice-state-listening` ou `-speaking` — só `-thinking` muda opacity do core (3124). Resultado: ouvindo, falando e idle são visualmente idênticos; num modo voz, onde o usuário não está lendo a tela de perto, a distinção visual de 'estou te ouvindo' é o feedback principal.

- **Evidência:** src/components/chat/VoiceScreen.tsx:274-278 e 251 (classe axxa-voice-state-*); styles/main.css:3114-3126 (rings opacity:0, só state-thinking existe); grep @keyframes em main.css sem nenhum de orb
- **Recomendação:** Adicionar keyframes: rings pulsando em `-state-listening`, core respirando em `-state-speaking`, shimmer/rotação em `-state-thinking`. Consumir os tokens [DS:motion] para o reduce-motion global já cobrir.
- **Nota do verificador:** Confirmado: rings com opacity:0 permanente (main.css:3114-3123), só -state-thinking tem regra (3124-3126), e os únicos @keyframes do arquivo são chat-in/caret/shimmer/rec-pulse/suggest-in (linhas 333-1396) — nenhum de orb. O TSX (VoiceScreen.tsx:274-278) renderiza os rings e o comentário da linha 4 promete orb animado. Em modo voz (uso eyes-off) a distinção visual de estado é feedback primário; P1 defensável.

#### P1-91 · Wake lock só cobre o streaming — no loop hands-free a tela apaga e mata a conversa de voz

**Área:** VoiceScreen (wake lock) · **Tipo:** state · **Esforço:** S

`useWakeLock(isLoading)` (AxxaApp.tsx:160) mantém a tela acesa apenas enquanto a IA gera. No modo voz o ciclo é ouvir → pensar → falar → ouvir: durante 'listening' e 'speaking' (a maior parte do tempo) não há lock, então no mobile a tela apaga por inatividade em ~30s e o WebView congela o JS (limitação documentada no próprio hook, useWakeLock.ts:4-6) — o reconhecimento morre no meio da fala do usuário e o loop hands-free quebra silenciosamente. É exatamente o cenário 'largou o celular pra conversar por voz'.

- **Evidência:** src/views/AxxaApp.tsx:160 (useWakeLock(isLoading)) vs 304/1922 (voiceOpen não participa); src/components/_shared/useWakeLock.ts:2-13
- **Recomendação:** Trocar para `useWakeLock(isLoading || voiceOpen)` — enquanto a tela de voz estiver aberta o lock fica ativo.
- **Nota do verificador:** Confirmado: AxxaApp.tsx:160 usa useWakeLock(isLoading); voiceOpen (linha 304, render em 1922) não entra no lock. useWakeLock.ts:2-13 documenta exatamente a consequência (tela apaga → WebView congela o JS). Durante listening/speaking não há lock, então o loop hands-free morre. Fix S como proposto (isLoading || voiceOpen). P1 correto.

#### P1-92 · Promessa 'Local and private — processed on your device' é falsa com cloud TTS e com o STT do Chromium

**Área:** VoiceScreen intro (copy) · **Tipo:** copy · **Esforço:** S

O card 4 da intro afirma 'Local and private / Voice and speech processed on your device' (en-us.ts:79-80). Mas: (1) quando o usuário seta o ★ TTS de Connections → Models, `speak()` envia o texto integral das respostas para a API da OpenAI (speech.ts:59-78, 116-117 e 144-145 — cloud tem prioridade sobre o nativo); (2) o STT usa webkitSpeechRecognition (speech.ts:198-204), que no Chromium/Electron processa o áudio em servidor do Google, não no dispositivo. Uma alegação de privacidade incorreta numa tela de onboarding é o tipo de coisa que mina a confiança no produto inteiro quando descoberta.

- **Evidência:** src/i18n/en-us.ts:79-80; src/components/_shared/speech.ts:59-78 (CloudTtsConfig OpenAI), 143-145 (prioridade cloud), 198-204 (webkitSpeechRecognition)
- **Recomendação:** Reformular: 'Private by default — uses your device's voices; cloud voices only if you enable them in Settings'. Se possível, variar o texto quando isCloudTtsActive() for true.
- **Nota do verificador:** Confirmado: en-us.ts:79-80 afirma 'Local and private / Voice and speech processed on your device'. speech.ts:144-145 dá prioridade ao cloud TTS (OpenAI, texto integral enviado via generateAudio, 116-117) quando configurado, e o STT usa webkitSpeechRecognition (198-204), que no Chromium processa áudio em servidor. Alegação de privacidade incorreta em onboarding; P1 adequado (P0 seria defensável, não superestimado).

#### P1-93 · Wake lock não cobre o Modo Voz — tela apaga no meio da conversa hands-free

**Área:** Wake lock / mobile · **Tipo:** state · **Esforço:** S

useWakeLock(isLoading) só segura a tela enquanto a IA gera. No Modo Voz, os estados 'listening' e 'speaking' acontecem com isLoading=false: numa conversa hands-free (o caso de uso da tela — celular na mesa), a tela apaga por inatividade em ~30s, o WebView congela e o loop ouvir→falar morre em silêncio. Exatamente o cenário que o próprio comentário do useWakeLock diz querer resolver.

- **Evidência:** src/views/AxxaApp.tsx:160 (useWakeLock(isLoading)); src/components/chat/VoiceScreen.tsx não usa wake lock; src/components/_shared/useWakeLock.ts:3-7 (racional).
- **Recomendação:** useWakeLock(isLoading || voiceOpen) no AxxaApp — uma linha, resolve o caso hands-free inteiro.
- **Nota do verificador:** CONFIRMADO. AxxaApp.tsx:160: useWakeLock(isLoading) — único uso no app (grep confirma). voiceOpen existe como state na linha 304 e VoiceScreen (renderizado na 1922-1935) não usa wake lock nenhum. Nos estados 'listening' e 'speaking' isLoading é false, então o lock é solto exatamente no loop hands-free que a tela promete ('Loop hands-free: ouve → envia → IA responde → lê em voz → volta a ouvir', header do arquivo). Fix de uma linha como sugerido. P1 justo.

## 5. P2/P3 — polish (triagem, sem verificação adversarial)

| Sev | Área | Achado | Esforço |
|---|---|---|---|
| P2 | Ações da resposta (footer) | **Seis botões de ação com alvo de toque de ~28px e gap de 2px no mobile** — Os .axxa-footer-btn têm ícone de 16px + padding 6px = ~28px de alvo (main.css:3431-3440, 4416-4419), com gap: 2px entre eles (main.css:2763-2768). São 6 ações lado a lado (copy/sav | S |
| P2 | Ações de mensagem durante streaming | **Durante o stream, regen/edit/continue viram no-ops silenciosos e delete NÃO é bloqueado — dá pra apagar a bolha que está sendo streamada** — handleRegenerate/continueReply/handleEditMessage/retryError checam isLoading e retornam sem qualquer feedback (AxxaApp.tsx:699, 790, 927, 964) — os botões do footer das mensagens a | M |
| P2 | agent/consciência de risco | **Nível de permissão ativo é invisível durante a conversa — YOLO escreve no vault sem nenhum indicador no chat** — O nível (ask/vault/yolo) e o diff approval vivem enterrados em Settings (AxxaSettingsTab.ts:2287-2304) e nada na tela do agent — header, composer ou starter 'New Agent' (screenshot | S |
| P2 | agent/feedback entre turnos | **Dead air nos turnos 2+: nenhum indicador de 'pensando' entre o fim das tools e o primeiro token do próximo stream** — O chip '🤖 Agent thinking...' é criado uma única vez no início do run (commentId, linhas 126-136) e vira 'done' no primeiro token do primeiro turno. Nos turnos seguintes, depois qu | S |
| P2 | agent/limites | **Fim por max turns / loop abortado é beco sem saída: o copy manda 'reformular' quando o caminho natural é continuar** — Ao estourar MAX_TURNS o usuário recebe 'Agent hit the limit of N turns without finishing. Try rephrasing the task.' e o loopAborted diz 'Try rephrasing the task or giving more cont | M |
| P2 | agent/modal de confirmação | **Modal de aprovação lidera com jargão de máquina e trunca o preview sem opção de ver tudo** — O headline visível é o título genérico 'Revisar mudança do Agent' seguido do nome cru da tool em monospace ('vault_edit', ConfirmationModal.ts:63-66) — a informação que o usuário r | M |
| P2 | agent/modal de confirmação | **No modal só existe Negar/Aprovar — não há como parar o run inteiro no momento da decisão** — Quando o modal está aberto o run está pausado no await (runAgentTurn.ts:408-415). Se o usuário percebe que o agente está indo na direção errada, a única saída é 'Negar' (ou Esc, qu | M |
| P2 | Ajustes de voz + cloud TTS | **Com cloud TTS ativo, a voz escolhida nos ajustes é ignorada (e cfg.voice nunca é setado)** — O painel de ajustes do Modo Voz lista as vozes NATIVAS do sistema (listVoices), mas quando o ★ TTS OpenAI está ativo o speakViaProvider ignora voiceURI por completo e usa a voz def | M |
| P2 | Appearance → sub-tabs | **Sub-tabs de Appearance são icon-only sem estado ativo perceptível — padrão que o próprio repo já abandonou nos providers** — As 3 sub-tabs (Background/Chips/Interface) são só ícones cinza (palette/tags/sliders); nos screenshots dark é impossível dizer qual está ativa — os 3 ícones parecem idênticos. O co | S |
| P2 | busca | **Não existe busca global por CONTEÚDO — quem lembra a frase mas não o título não tem caminho** — A lupa do header (ChatSearchModal) só busca dentro da conversa ABERTA (AxxaApp.tsx:1229-1246 monta hits do store atual) e nem abre com o chat vazio (return silencioso em :1238 — bo | L |
| P2 | Busca in-chat (Header) | **searchActive hardcoded false (prop morta) e tap na lupa sem resultado é no-op silencioso** — O Header recebe searchActive={false} fixo (AxxaApp.tsx:1550) — o estado 'busca aberta destaca o ícone' documentado no próprio Header.tsx:28 nunca acontece. E handleOpenSearch retor | S |
| P2 | Cards do Agent / pills do Q&A | **Sombras hardcoded e desiguais: rgba(0,0,0,.3) nos cards do Agent vs .1 nas pills — pesado no tema light** — Os cards do Agent usam box-shadow 0 2px 8px rgba(0,0,0,0.3) (main.css:1483) enquanto as pills do Q&A usam 0.1 (main.css:1553) e o grid do sheet 0.08 (main.css:1618). No dark os 30% | S |
| P2 | Composer (descoberta do mic) | **Tap curto no botão de mic é um no-op silencioso — ninguém ensina o 'segure para gravar'** — O guard anti-acidente exige 180ms parado; se o usuário der um tap (o gesto mais natural num botão), endMic cancela o timer e retorna sem nenhum feedback — nem toast, nem hint. O us | S |
| P2 | Composer (gravação) | **Não existe como cancelar uma gravação — todo release salva no vault e o arquivo vira órfão** — stopRecording(cancel) tem caminho de cancelamento completo (cancelRecordingRef + Notice t.recording.cancelled), mas stopRecording(true) não tem NENHUM caller — é código morto. Qual | M |
| P2 | Composer / anexos no Vault Q/A | **Pill de anexos do Vault Q/A remove TODOS os anexos do tipo num tap, sem parecer botão** — No modo vault-qa os anexos viram um pill agregado ("Note · ícone · ×3") cujo clique remove todos os anexos daquele tipo de uma vez, sem confirmação e sem como remover um item indiv | M |
| P2 | Composer / botões do pill (chat) | **Dois botões de áudio adjacentes e o destaque accent muda de função por estado** — No pill do chat vazio há mic flat cinza (hold-to-record) colado num círculo roxo com waveform (Voice mode) — dois glifos de áudio sem rótulo, e a ação mais proeminente (accent) é a | M |
| P2 | Composer / gravação | **Não existe caminho pra cancelar uma gravação — código de cancel é inalcançável** — cancelRecordingRef e o Notice t.recording.cancelled existem, mas stopRecording só é chamado com cancel=false (release do botão, mouseup/touchend do document, unmount). O comentário | M |
| P2 | ComposerSuggestions + SuggestionsSheet | **36 sugestões, 'See more', títulos do sheet e aria-label 'Close' hardcoded fora do i18n** — Toda a tela usa useT (t.newChatScreen.*, t.starter.providerLabel, t.dashboard.providerAdd), mas o conteúdo mais denso em texto ignora o sistema: SUGGESTIONS com 36 labels + 36 hint | M |
| P2 | Connections → Models · acessibilidade | **Favoritar e definir default são spans clicáveis dentro de um button — inacessíveis por teclado; acordeões sem aria-expanded** — Na linha de modelo, fav (bookmark) e star (default) são <span> com onclick aninhados no <button> da linha: sem tabindex/role, não recebem foco — usuário de teclado só consegue o to | M |
| P2 | Connections → Models · profundidade dos acordeões | **Três níveis de acordeão (papel→vendor→família) para chegar a 1 modelo, com filtro All/Selected/Not selected até em família de item único** — Com o catálogo típico (poucas dezenas de modelos), cada família tem 1-3 modelos, mas o usuário precisa de 3 cliques para ver qualquer linha, e cada família de 1 modelo ainda render | M |
| P2 | Connections → Providers · chips de filtro | **Contadores dos chips de filtro ficam obsoletos após Fetch from API ou Add** — Os chips (All 4 · Vision 4 · ...) são construídos uma única vez com const all = allModels() na montagem; o handler do Fetch e o doAdd chamam apenas renderRows(). Depois de buscar 4 | S |
| P2 | Connections → Providers · fluxo de popular modelos | **Fetch from API (caminho principal) é o último elemento da tela e fica habilitado sem API key** — O empty state diz 'No active models. Add below.' e o que vem 'below' é o input de add manual (caso raro) com o botão Fetch por último — a hierarquia sugere que digitar IDs de model | M |
| P2 | Connections → Providers · lista filtrada | **Mensagem 'No active models. Add below.' aparece também quando é o filtro que zerou a lista** — renderRows usa o mesmo texto de vazio para dois estados diferentes: nenhum modelo conhecido vs. filtro ativo sem matches (ex.: clicar em Free · 0). No segundo caso a mensagem mente | S |
| P2 | Connections → Providers · placeholders e i18n | **Placeholders com português hardcoded na UI inglesa e Models tab inteiro fora do i18n** — Na UI em inglês os placeholders exibem 'sk-... ou sk-admin-...', 'sk-admin-... (opcional)', 'proj_... (opcional)', 'wrkspc_... (opcional)' — mistura PT/EN visível no primeiro campo | S |
| P2 | Connections → Providers · segmented de providers (mobile) | **Segmented de 6 providers corta 'Ope...' no mobile sem nenhuma affordance de scroll — NIM e Ollama ficam escondidos** — Em 390px só OpenAI/Anthropic/Gemini cabem; 'OpenRouter' aparece cortado como 'Ope' e NIM/Ollama ficam fora da viewport. O container rola horizontalmente mas com scrollbar totalment | S |
| P2 | Continue (nudge enviado ao modelo) | **O nudge de continuação é enviado ao LLM em português — numa conversa em inglês a continuação pode voltar em PT** — continueReply injeta como última user-msg: 'Continue EXATAMENTE de onde você parou, sem repetir nem reintroduzir o que já escreveu.' (AxxaApp.tsx:840-842), independente do idioma d | S |
| P2 | conversations/chips | **Chips de status com fonte de 9px e cores pastel — legibilidade e contraste no limite, pior no light** — `.axxa-recent-status` força `font-size: 9px` (main.css:6522) e a data usa 10px (main.css:6451). As cores vêm de CHIP_COLORS com fallbacks tipo #a370f7/#f472b6 (ConversationsList.ts | M |
| P2 | conversations/datas | **Data relativa do item duplica o cabeçalho do grupo em vez de agregar informação** — Com sort por data (o default), cada grupo já diz o dia ('TODAY', 'YESTERDAY', 'JUL 11'), mas o chip do item repete a mesma coisa: grupo 'YESTERDAY' → item '1d'; grupo 'JUL 11' → it | M |
| P2 | conversations/fab | **FAB 'New chat' cobre o último item quando a lista rola até o fim** — A lista tem `padding-bottom: 20px` (main.css:3850) mas o FAB é absoluto com `bottom: max(18px, safe-area)` e ~42px de altura (main.css:6494-6497, padding 11px + fonte). Com mais it | S |
| P2 | conversations/filtro-modo | **Filtro de modo é icon-only aqui, mas o mesmo controle no Sidebar mostra o label do ativo** — O Sidebar passa `showActiveLabel` ao SegmentedRow (Sidebar.tsx:328); a tela cheia não (ConversationsList.tsx:284-292), então os 4 filtros são só ícones (grid, balão, estante, robô  | S |
| P2 | conversations/item | **Conversa com título vazio renderiza linha sem nome nenhum** — A tela cheia renderiza `{c.title}` cru (ConversationsList.tsx:349). Se o título é vazio/whitespace, o item aparece só com chips e data — impossível de identificar e parece quebrado | S |
| P2 | conversations/item | **Botão '…' fica invisível (opacity 0) mesmo quando recebe foco de teclado** — `.axxa-recent-more` tem `opacity: 0` e só aparece em `:hover` do item ou em `@media (hover: none)` (main.css:6479-6488). Navegando por Tab no desktop, o foco entra num botão invisí | S |
| P2 | conversations/lista-longa | **Tela cheia não tem 'end of list' nem scroll-to-top — mas o Sidebar (lista menor) tem** — O Sidebar implementa marcador de fim de lista e botão de voltar ao topo (Sidebar.tsx:388 e 406, usando `t.conversations.endOfList`/`scrollTop`). A tela 'All conversations' — que é  | M |
| P2 | Copy do Usage (intro, footnote, report) | **Copy user-facing manda o usuário 'editar src/usage/pricing.ts' — vazamento dev em 4 lugares** — O intro do tab diz 'see src/usage/pricing.ts' (en-us.ts:774-775), o footnote de custo parcial diz 'Edit src/usage/pricing.ts to add' (en-us.ts:1006-1007), o report MD repete 'Edite | S |
| P2 | delete × auto-save | **Corrida: deletar o chat ativo com save pendente ressuscita o arquivo deletado** — handleDeleteChat (AxxaApp.tsx:1121-1147) faz `await deleteChat` + `await persistProjects` ANTES de chamar newChat() — só o newChat limpa o timer do debounce. Se havia um save agend | S |
| P2 | delete de conversa | **Delete é 1 toque sem confirmação e o Notice não oferece Desfazer** — No menu de contexto (long-press no mobile) 'Deletar' executa direto (ConversationsList.tsx:160-167, Sidebar.tsx:220) — sem ConfirmModal, que aliás já existe no projeto (components/ | M |
| P2 | Densidade × touch targets | **Densidade 'compact' derruba linhas de lista abaixo do touch target mínimo no mobile, sem piso** — compact seta --axxa-list-row-py: 3px e --axxa-seg-btn-py: 3px (main.css:680-688) — linhas de conversa e botões de segmento caem pra ~30px de altura, bem abaixo dos 44px de guidelin | S |
| P2 | flow-errors / 5xx | **Outage do provider (5xx/529/408) é mostrado como "Rate limit reached. Wait a few seconds"** — mapHttpError colapsa 5xx/408/409 no code "rate-limit" com a mensagem correta "service unavailable" (_shared.ts:206-211), mas describeProviderError DESCARTA essa mensagem e re-local | S |
| P2 | flow-errors / agent | **Erro no meio do run do agent perde os runSteps — retry re-executa ações já feitas** — No caminho feliz os steps do run são anexados à resposta final via setAgentSteps (runAgentTurn.ts:256-259) e replayados no histórico pra continuidade. No catch (runAgentTurn.ts:623 | S |
| P2 | flow-errors / erros determinísticos | **Erros determinísticos (genUnsupported, provider sem tools) oferecem só um retry que falha igual** — genUnsupported usa errorCode "unknown" (useGeneration.ts:74-77 e 236-241): o card mostra só "Try again", que re-roda a mesma geração não suportada e falha idêntico — a ação certa ( | S |
| P2 | flow-errors / geração de mídia | **Botão Stop é placebo na geração de imagem/áudio/vídeo (e no fallback mobile de stream)** — useGeneration cria AbortController e seta abortRef (useGeneration.ts:61-62), mas o signal NUNCA é passado: generateImage/Audio/Video nem aceitam signal na interface (base.ts:170-18 | L |
| P2 | flow-errors / ollama | **Erro de conexão do Ollama vira "Check your internet" — orientação errada pro caso local** — O provider lança a mensagem certa ("Connection to Ollama at <endpoint> failed. Make sure the server is running." — ollama.ts:107-110), mas describeProviderError re-localiza todo co | S |
| P2 | flow-errors / retryError | **"Try again" pode virar botão morto: no-ops silenciosos sem nenhum feedback** — retryError retorna silenciosamente se isLoading (AxxaApp.tsx:964) ou se não achar user-msg antes do erro (:978) — o clique não produz efeito visual nenhum, nem Notice, nem estado d | S |
| P2 | flow-errors / vault-qa | **Busca do vault falha e o turno segue sem contexto — resposta parece grounded mas não é** — No modo Vault Q&A, se hybridSearch lança (ex.: erro de embedding/key), o catch só marca o chip como failed e o fluxo CONTINUA chamando o LLM com vaultContextBlock vazio (useChatEng | S |
| P2 | Fontes do projeto | **Adicionar fonte duplicada mostra 'Source added to project' mas não adiciona nada** — handleAddProjectSource (useProjectActions.ts:71-82) ignora o path se já existe em p.sources, porém o Notice de sucesso 'Source added to project' (en-us.ts:128) dispara incondiciona | S |
| P2 | Fullscreen mobile (retorno futuro) | **Pré-requisitos do retorno do fullscreen estão desalinhados: CSS ancora .axxa-fullscreen no body, o plano ancora no drawer** — A única regra viva de fullscreen espera a classe no body (body.is-mobile:not(.axxa-fullscreen)…, main.css:26, com comentário 'NÃO remover como órfã'), mas o design aprovado em docs | M |
| P2 | Header durante onboarding | **Header completo (model switcher, busca, persona, Modo Voz) fica ativo por cima do onboarding — inclusive o Modo Voz, que envia mensagem e falha sem key** — O Header renderiza incondicionalmente com todas as ações. Durante o onboarding, o novato pode abrir o switcher de modelo (de um provider que não conectou), a busca de uma conversa  | S |
| P2 | i18n do fluxo de chat | **Strings em português hardcoded espalhadas numa UI que hoje é 100% EN** — O único locale ativo é EN_US (i18n/index.ts:17-20), mas o loop de chat exibe PT hardcoded: Notice do banner locked 'Pra trocar pra X, comece uma Nova conversa (botão "+" no topo)'  | M |
| P2 | imagegen/composer | **Depois de gerar via modal, o prompt continua no composer — um Enter acidental o reenvia como chat** — handleCreateImage pré-preenche o modal com composerDraftRef.current (useGeneration.ts:330) e, após a geração, adiciona a user msg e a imagem — mas nunca limpa o rascunho do compose | S |
| P2 | imagegen/copy | **Copy aponta 'Settings → Providers', mas a tab agora chama 'Connections'** — Após a reorganização em 5 tabs (Connections|Vault|Agent|Appearance|Usage), 'Providers' virou sub-tab dentro de Connections (AxxaSettingsTab.ts:238). As strings do fluxo de imagem a | S |
| P2 | imagegen/custos | **Caminho direto (modelo de imagem ativo) gera sem nenhum aviso de custo — só o modal avisa** — Com gpt-image-1/dall-e-3 selecionado como modelo ativo, qualquer Enter no composer dispara geração paga imediata (handleSend → runGenerationTurn, AxxaApp.tsx:656-658) sem mostrar p | M |
| P2 | imagegen/estatísticas | **Gerações de imagem nunca entram em Usage/Statistics — o gasto mais caro por chamada fica invisível** — addUsage só é chamado nos caminhos de chat/agent (AxxaApp.tsx:765,880; runAgentTurn.ts:237; useChatEngine.ts:254). runGenerationTurn e runImageGeneration não registram nada, apesar | M |
| P2 | imagegen/i18n | **Strings hardcoded em português no meio da UI en-us + plural quebrado ('imagemns', 'imagems')** — Os textos de atividade do fluxo estão fora do i18n e em PT: 'Gerando imagem...', 'Editando imagem...' (useGeneration.ts:88-92, 251) — usuário na locale en-us vê português. E o plur | S |
| P2 | imagegen/modal | **Estados vazios do modal e a row desabilitada do PlusModal são becos sem saída — nenhum atalho pra Settings** — Sem provider conectado, o ImageGenModal mostra a nota 'Add a key in Settings → Providers' e só oferece Cancel (ImageGenModal.ts:107-121, 164-169) — o usuário precisa fechar, lembra | S |
| P2 | imagegen/preços | **Sinais contraditórios de custo: badge 'free' no model sheet vs '~$0.039/img' no modal (Gemini e NIM)** — gemini-2.5-flash-image tem caps.free=true (modelCapabilities.ts:102 → badge 'free' na lista de modelos) mas pricing imagePerCall 0.039 tier 'paid' (pricing.ts:85) → o ImageGenModal | S |
| P2 | ImageGenModal | **Selecionar um modelo desconectado desabilita o Generate sem explicar por quê nem oferecer caminho** — Cards "no key" são clicáveis (só opacity 0.6); ao selecionar um, syncGenerate() apaga o CTA silenciosamente. A nota noneConnected só aparece quando NENHUM provider está conectado — | M |
| P2 | ImageGenModal | **Não há foco inicial no textarea do prompt, ao contrário de Persona e Rename** — PersonaModal foca o textarea (~50ms) e RenameChatModal foca e seleciona o input (~30ms); ImageGenModal não foca nada no onOpen. O campo prompt é a primeira coisa que o usuário edit | S |
| P2 | ImageGenModal (CSS) | **Font-sizes em px hardcoded ignoram os tokens tipográficos usados nos demais modais** — O CSS do ImageGen usa 12px, 13px, 13.5px, 14px, 11.5px e 10.5px fixos, enquanto Rename/LinkSafety/search-hit usam var(--font-ui-small/-smaller/-medium). Com isso o modal não respon | S |
| P2 | IncompatibleBanner | **Banner incompatível expõe id cru do modelo em vez de prettyModelName** — As mensagens de compatibility interpolam o id da API ("Model \"gpt-4o-mini\" doesn't accept images") e o chip de ação usa shortenModel(), que corta o id no meio ("claude-sonne…2510 | S |
| P2 | IncompatibleBanner / sessão locked | **Chip "Switch to" fica ativo em sessão locked e só rende um erro ao tocar** — Com a sessão travada (após 1ª mensagem), o banner continua mostrando o chip de troca de modelo como acionável; o tap devolve um Notice de erro (em PT, ver achado de copy) mandando  | S |
| P2 | IncompatibleBanner × session lock | **Trocar de modelo com sessão locked tem dois comportamentos diferentes: header/sheet troca sozinho, banner recusa e manda apertar '+'** — No header e no ModelSheet, escolher outro modelo com lock inicia nova conversa automaticamente (AxxaApp.tsx:1379-1392). No IncompatibleBanner, o botão de swap com lock só dispara u | S |
| P2 | LinkSafetyModal | **"Copy link" falhando fecha o modal sem nenhum feedback — usuário acredita que copiou** — No catch do clipboard.writeText só há console.error; o this.close() roda de qualquer forma e o Notice de sucesso não aparece. Em WebView mobile/contexto sem permissão de clipboard, | S |
| P2 | LinkSafetyModal | **Mute de sessão é aplicado no onchange do checkbox, mesmo que o usuário depois cancele** — mutedThisSession é setado no momento do toggle, não no momento de uma ação. Quem marca "Don't ask again this session" e em seguida clica Cancel (ou Esc) desliga o aviso de seguranç | S |
| P2 | Long-press nas mensagens (Android) | **Long-press pode disparar o menu duas vezes no Android: timer próprio de 500ms + contextmenu nativo do WebView** — useMessageContextMenu arma um timer de 500ms no touchstart que chama showMenu (useMessageContextMenu.ts:69-77) e, em paralelo, mantém o handler de onContextMenu que também chama sh | S |
| P2 | MediaScreen | **Linhas de áudio/vídeo não são clicáveis, enquanto imagens abrem no Obsidian** — As células de imagem são <button> com onClick que abre o arquivo via openLinkText, mas as rows de áudio/vídeo são <div> estáticas sem handler nenhum: o usuário vê seus arquivos lis | S |
| P2 | MediaScreen | **Galeria corta silenciosamente em 300 imagens/200 arquivos e sem ordenação por data** — media.imgs/others sofrem slice(0,300)/(0,200) sem nenhum indicador de truncamento, e a lista vem na ordem arbitrária de app.vault.getFiles() (nenhum sort). Num vault grande, o usuá | S |
| P2 | Mobile (global) | **Alvos de toque muito abaixo de 44px nos controles mais usados** — Medido no viewport mobile 390px: 6 botões de ação do rodapé da mensagem com 28×28 ADJACENTES (Copy/Save/Read/Regen/Like/Dislike), copy de código 28×28, botões do header 32×32, avat | M |
| P2 | Model switcher locked (Header) | **Trocar modelo com sessão locked aborta o stream e abre conversa nova sem confirmação nem feedback** — handleHeaderModelSelect com isLocked faz abortRef.abort() + newChat() imediatamente (AxxaApp.tsx:1379-1392). O único aviso é o hint estático no topo do dropdown ('Choosing another  | M |
| P2 | Navbar padding × teclado aberto | **Regra do navbar-padding não tem exceção para teclado aberto — faixa morta acima do teclado** — A regra @supports :has reserva navbar-height + safe-area no padding-bottom da view sempre que .mobile-navbar existe no DOM (main.css:26-38). Quando o teclado abre, o Obsidian escon | S |
| P2 | NewChatScreen — desktop | **No desktop, as sugestões esticam na largura total coladas à esquerda enquanto o resto da tela centraliza em 460px** — O bloco de boas-vindas e o provider têm max-width:460px centralizados (main.css:7040/7049), mas .axxa-suggest é width:100% sem max-width (main.css:1363-1369). Num painel de 900px a | S |
| P2 | NewChatScreen — provider sem key | **Provider atual aparece no seletor mesmo sem estar configurado, sem nenhum aviso de key ausente** — O provBase injeta o provider ativo na lista mesmo quando providerConfigured() é false (NewChatScreen.tsx:73-75) — correto para não sumir com a seleção, mas o slot fica idêntico aos | M |
| P2 | Observer de teclado — view fora do drawer | **Com a view no tab container principal (não no drawer), o early-return mata o toggle de body.axxa-keyboard-open** — No update() do keyboard observer, `if (!drawer) return;` (AxxaView.tsx:91-93) roda ANTES do toggle no body (linha 104). O CSS suporta explicitamente a view fora do drawer no mobile | S |
| P2 | Onboarding → Settings sem concluir | **onboardingDone é marcado no CLIQUE do CTA — quem abre Settings e fecha sem colar key perde o onboarding para sempre e cai num NewChatScreen sem nenhuma dica de setup** — `finishOnboarding(true)` seta o flag antes de saber se uma key foi de fato adicionada. Se o usuário fechar o modal de Settings intimidado (5 tabs, 6 providers), o onboarding nunca  | S |
| P2 | onboarding/copy | **Nota de confiança com gramática quebrada: "Got Ollama? runs local, no key."** — O fragmento depois da interrogação começa em minúscula, não tem sujeito ("runs local" em vez de "it runs locally") e comprime duas mensagens distintas (segurança da chave + alterna | S |
| P2 | onboarding/layout | **Conteúdo colado no topo com ~30% do viewport morto embaixo — CTA fora da thumb zone no mobile** — O .axxa-onboarding é flex column sem centralização vertical nem margin-auto: no mobile 390x844 sobram ~260px vazios abaixo do Skip, e no desktop quase metade da tela fica vazia. Nu | S |
| P2 | onboarding/pós-skip | **Copy "Start free, no card" (freeStartTitle/Sub) está morta — o affordance pós-skip que ela implicava não existe** — As chaves i18n freeStartTitle ("Start free, no card") e freeStartSub ("Gemini free tier · OpenRouter free models · local Ollama. Tap to set up.") existem desde v0.1.138 mas não são | M |
| P2 | onboarding/skip | **Alvo de toque do "Skip for now" tem ~28px de altura — abaixo do mínimo de 44px no mobile** — O .axxa-onboarding-skip tem padding de 6px e font-ui-smaller, resultando num alvo de ~28px de altura num plugin cujo caminho principal é mobile. O botão de escape do onboarding é j | S |
| P2 | persistência .md (round-trip) | **Conteúdo com linha '## You'/'## Assistant' corrompe o parse — e o re-save no open torna a corrupção permanente** — renderBody escreve o content verbatim (chatPersistence.ts:164) mas parseBody fatia o arquivo por regex `^## (You|Assistant)$` (chatPersistence.ts:291). Se uma resposta da IA contiv | M |
| P2 | Persistência do chat (auto-save/load) | **Reload do chat perde truncated, variants e reasoning: botão Continuar, navegação ‹1/N› e painel de raciocínio somem** — O auto-save serializa apenas type/content/timestamp/reaction/agentSteps (AxxaApp.tsx:469-482) e handleLoadChat só restaura esses campos (1404-1417). Consequências visíveis: uma res | M |
| P2 | PlansScreen | **Card Pro vende "Projects (coming soon)" mas Projects já é feature implementada** — O copy do plano Pro lista "Projects (coming soon)", porém Projects existe como feature real (components/screens/Projects.tsx com lista+detalhe+picker, story 'projects' no Storybook | S |
| P2 | PlusModal / tiles Camera e Photos | **Tiles desabilitados sem vision não explicam nada no mobile** — Camera e Photos ficam disabled quando o modelo não tem vision, com a explicação só no atributo title — que não existe no touch. O botão disabled também nunca dispara onClick, então | S |
| P2 | PlusModal + ModelSheet / Effort | **Effort tem duas UIs com copy e comportamento divergentes** — O mesmo ajuste existe em dois lugares: PlusModal (pills numa linha, tooltip técnico em PT, fecha o sheet inteiro ao escolher) e ModelSheet→Effort (lista com taglines EN "Balanced f | M |
| P2 | ProfileScreen | **Rows "Connected providers" e "Chats" são becos sem saída e mostram "—" ambíguo para zero** — As duas rows estáticas têm o mesmo visual das clicáveis (mesma classe, mesmo layout, só sem chevron) mas não levam a lugar nenhum. Justamente quando connectedProviders é 0 — o mome | S |
| P2 | ProjectDetailScreen (empty state de Chats) | **Empty state de conversas flutua no topo, desconectado do CTA que resolve ele no rodapé** — Com 0 conversas, a mensagem 'No conversations in this project yet.' aparece no terço superior (sem título, só o sub — Projects.tsx:296-299) e o botão 'New chat in this project' fic | S |
| P2 | ProjectEditor (a11y) | **Dialog rotulado como 'Choose icon' e swatches/ícones anunciados como hex e slug crus** — O role=dialog usa aria-label={t.projects.chooseIcon} ('Choose icon') em vez do título real New/Edit project (Projects.tsx:121). Os swatches têm aria-label={c} — leitor de tela anun | S |
| P2 | ProjectEditor (input de nome) | **Campo de nome sem autofocus e Enter não salva o projeto** — Ao abrir 'New project', o primeiro (e único) campo obrigatório não recebe foco — no mobile o teclado não sobe e o usuário precisa tocar no input; no desktop precisa clicar. Digitar | S |
| P2 | Reduce motion | **Toggle reduce-motion não desliga animações por keyframe (só transitions)** — O reset global de body.axxa-reduce-motion zera transition-duration/delay e scroll-behavior mas NÃO animation-duration/iteration-count. Resultado: com reduce-motion LIGADO, shimmer  | S |
| P2 | Reduce motion | **prefers-reduced-motion do SO é ignorado até o usuário achar o toggle** — A decisão de o toggle do usuário ser a fonte da verdade é boa e deve ficar — mas o valor INICIAL não lê o prefers-reduced-motion do sistema. Um usuário com distúrbio vestibular que | S |
| P2 | rename (header) | **Renomear pelo header nos primeiros ~500ms da conversa falha com erro e descarta o título digitado** — Após o 1º send, currentChatId já existe mas o arquivo só é escrito 500ms depois (debounce). handleHeaderRename (AxxaApp.tsx:1166-1190) cai no branch com arquivo: renameChat tenta a | S |
| P2 | RenameChatModal | **Mecanismo de retry em falha é código morto: failureLabel nunca é passado e o modal fecha mesmo quando o rename falha** — O modal foi desenhado para permanecer aberto em erro (catch com Notice via failureLabel), mas (1) nenhum caller passa failureLabel — e não poderia, pois t.conversations.renameFaile | S |
| P2 | Safe-area — fonte dupla | **Safe-area lida de duas fontes diferentes: env() em umas telas, var(--safe-area-inset-*) do Obsidian em outras** — O padding da view usa a var do Obsidian (var(--safe-area-inset-bottom, 0px), main.css:11 e 33), enquanto voice screen, camera, sheets, onboarding e afins usam env(safe-area-inset-b | S |
| P2 | ScreenShell / MediaScreen (a11y) | **aria-label "Voltar" hardcoded em português numa UI 100% inglês; toggle de escopo sem aria-pressed** — O botão de voltar de TODAS as telas (Media, Statistics, Profile, Plans, Locked) tem aria-label="Voltar" fixo, fora do i18n — leitor de tela anuncia PT no meio de uma interface EN.  | S |
| P2 | SegmentedRow — acessibilidade | **role=tablist sem navegação por teclado e com o '+' (ação) anunciado como tab** — O seletor usa role="tablist"/role="tab" + aria-selected (SegmentedRow.tsx:145,175-176) mas não implementa o padrão de teclado de tabs (setas para mover, Tab único para entrar) — ca | M |
| P2 | SegmentedRow (sidebar/starter) | **role=tablist sem navegação por setas nem roving tabindex** — O controle segmentado anuncia "tab, 1 de 4" ao leitor de tela — que instrui o usuário a usar setas — mas as setas não fazem nada; todos os "tabs" estão no tab order (contrário ao p | S |
| P2 | Seletor de provider (NewChatScreen) | **Ollama sempre aparece como provider 'configurado' (endpoint default localhost:11434) — novato clica, envia e ganha erro de rede genérico** — `providerConfigured('ollama')` checa só se `ollamaEndpoint` é não-vazio, e o DEFAULT já vem preenchido com http://localhost:11434. Resultado: todo primeiro uso mostra Ollama no sel | M |
| P2 | Sheets (seleção) | **Estado "selecionado" e descrições dos efforts invisíveis pra leitor de tela** — Nas listas de seleção (modelos em More models, níveis de Effort no ModelSheet, pills de effort no PlusModal), o item ativo é indicado só por classe CSS + ícone de check decorativo  | S |
| P2 | sidebar/a11y dialog | **role=dialog aria-modal sem gestão de foco: abrir a gaveta não move o foco pra dentro nem devolve ao fechar** — O aside declara role='dialog' aria-modal='true' (Sidebar.tsx:232-243) e o inert ao fechar está correto, mas ao ABRIR nada recebe foco dentro da gaveta e não há focus trap — usuário | M |
| P2 | sidebar/delete de conversa | **Deletar chat só existe via right-click/long-press sem nenhuma affordance — e long-press→contextmenu é frágil no iOS** — openItemMenu (Sidebar.tsx:212-223) pendura o delete exclusivamente no onContextMenu da linha. Não há nenhum indício visual (nem no hover) de que a linha tem menu, e em WKWebView/iO | M |
| P2 | sidebar/end-of-list e scroll vazio | **Com poucas conversas o scroll abre um vazio de 1 viewport, e o 'end of list' fica órfão a uma tela do último item (com linhas invisíveis)** — .axxa-sidebar-list tem min-height:100% (main.css:6706) pra mecânica de rolar os Recents ao topo — mas com 6 chats isso cria ~800px de vazio rolável: o usuário rola pra um void, o F | M |
| P2 | sidebar/FAB scroll-top | **FAB 'subir ao topo' não tem superfície — é uma seta solta flutuando sobre a lista** — .axxa-sidebar-fab (main.css:6741-6772) define posição, tamanho 40px, border-radius 999px e animações de entrada, mas nenhum background/box-shadow/cor. Na prática o 'botão circular' | S |
| P2 | sidebar/filtro de recents | **Filtro segmentado no estado default é 4 ícones sem nenhum rótulo, e o divisor 'All | modos' é invisível** — Com 'All' ativo (iconOnly:true, Sidebar.tsx:127-142), o showActiveLabel não mostra texto em segmento nenhum — o usuário vê 4 glifos (grid, balão, library, bot) e precisa adivinhar  | S |
| P2 | sidebar/recents | **'Recents' lista TODOS os chats sem limite e a prop onOpenAll ('Ver todas') está morta** — recents = safeChats inteiro ordenado, sem slice (Sidebar.tsx:151-162) e sem virtualização — com centenas de conversas a gaveta monta centenas de botões (custo de render no mobile)  | M |
| P2 | skills/descoberta | **Descoberta fraca: única porta é a 4ª linha do sheet "+", sem hint de "/" em lugar nenhum** — A feature inteira depende de o usuário (a) abrir o "+" e ler até a linha "Apps & Skills" (PlusModal.tsx:373-384, abaixo de câmera/fotos/arquivos/nota/web/imagem) ou (b) adivinhar q | M |
| P2 | skills/frontmatter | **Erros de frontmatter/corpo são 100% silenciosos — skill some ou degrada sem diagnóstico** — YAML inválido → catch vazio, fm={} (skills.ts:31-35): a skill aparece com o nome do arquivo, sem description/icon/mode, e o usuário não sabe por que o frontmatter "não pegou". Nota | M |
| P2 | skills/nomenclatura | **Três nomes pro mesmo objeto: "Apps & Skills", "app", "skill", "/command"** — A tela chama "Apps & Skills" e o empty state diz que cada nota "becomes an app here" (en-us.ts:55, 62); as Settings chamam "Skills" e dizem que cada nota "becomes a /command" (en-u | S |
| P2 | skills/seed | **Skills de exemplo são hardcoded em português, mesmo com UI em en-us** — EXAMPLE_SKILLS (skills.ts:89-130) tem nomes, descriptions e corpos em PT ("Resuma o conteúdo abaixo em 3 bullets", "pro meu vault") independente de settings.language. Com o produto | S |
| P2 | skills/SkillsScreen | **SkillsScreen: dialog sem aria-modal, sem foco inicial e sem fechar por Escape** — O container tem role="dialog" (SkillsScreen.tsx:26) mas não tem aria-modal="true", nenhum foco é movido pra dentro ao abrir, não há focus trap e não existe handler de Escape (grep  | S |
| P2 | SkillsScreen (empty state) | **Empty state com '404' gigante comunica erro, não 'comece aqui' — e não tem ação** — Sem skills, a tela mostra um '404' de 56px/800 (SkillsScreen.tsx:48; main.css:2958-2964) sobre 'No skills yet'. '404' significa 'página não encontrada' — num primeiro uso legítimo  | S |
| P2 | Slash commands (/clear, /regen) | **/clear não aborta o stream em andamento (request órfã segue gastando API) e duplica /new; /regen pode ramificar uma bolha de erro** — /clear executa useChatStore.getState().newChat() direto, sem abortRef.current?.abort() (AxxaApp.tsx:1460-1465) — diferente de handleNewChat (1100-1105). Limpar durante um stream de | S |
| P2 | Tipografia / tema | **Texto informativo em --text-faint falha contraste (2,8:1) em fonte 10px** — Timestamps das mensagens (10px), versão, ticker do placeholder e outros textos informativos usam --text-faint: medido ao vivo #666 sobre fundo dark ≈ 2,8:1 e #999 sobre branco ≈ 2, | S |
| P2 | Todos os modais | **Quatro sistemas de botões e três níveis de heading diferentes entre os sete modais** — LinkSafety usa pills full-width empilhados (radius 999px); Rename usa botões pequenos radius 8px à direita; ImageGen tem seu próprio .axxa-imggen-btn; Persona e Confirm usam Settin | M |
| P2 | Usage → Balance / cross-check / card de embedding | **IDs crus de provider capitalizados viram 'Openai', 'Openrouter', 'Nim' — branding errado** — O painel Balance renderiza o id cru (`head.createSpan({ text: p })`, linha 3058) com capitalize do CSS: aparece 'Openai', 'Anthropic', 'Openrouter', 'Nim' (screenshot). O mesmo em: | S |
| P2 | Usage → cards de resumo | **Cards de resumo renderizam um círculo de ícone vazio — o parâmetro icon é descartado com `void icon`** — usageCard cria o .axxa-usage-card-icon, seta a cor, e depois faz `void icon;` sem nunca chamar setIcon (AxxaSettingsTab.ts:3627-3631). Os 4 cards (Estimated spend / Tokens in / Tok | S |
| P2 | Usage → intro | **Copy do Usage manda o usuário 'ver src/usage/pricing.ts' — caminho de código-fonte em texto de produto** — outrosUsageIntro: 'Pricing based on official lab tables (see src/usage/pricing.ts)'. Usuário final de um plugin Obsidian não tem por que abrir o repositório; referência a arquivo d | S |
| P2 | Usage → tabelas | **Tabelas de Usage estouram os 390px e a coluna Cost é decepada no mobile** — As tabelas (By provider / By model / Top chats) têm width:100% mas 5 colunas com padding 8px 11px não cabem em 390px; como .axxa-settings-root tem overflow-x:hidden (main.css:4473- | M |
| P2 | Usage tab — cards de resumo | **Ícone dos cards de resumo nunca é renderizado — sobra um quadrado vazio de 30px em cada card** — `usageCard` recebe `icon` ('dollar-sign', 'arrow-down'…) mas o corpo faz `void icon;` e cria uma div `.axxa-usage-card-icon` vazia, só com cor de texto (AxxaSettingsTab.ts:3627-363 | S |
| P2 | Usage tab — empty state | **Empty state mente quando o filtro de período zera a janela: 'No saved conversations yet'** — Com 'Last 7 days' selecionado e nenhum chat na janela (mas histórico existente), `agg.total.chats === 0` dispara o copy 'No saved conversations yet. Send your first message to star | S |
| P2 | Usage tab — export | **Export salva o arquivo mas não oferece abrir — e 'PDF (print)' depende de pop-up sem alternativa guiada** — MD/HTML export mostram Notice 'Saved to axxa-ai/reports/usage-….md' (AxxaSettingsTab.ts:3591, 3610) e param aí: o usuário precisa fechar Settings e navegar manualmente até a pasta  | M |
| P2 | usage/export.ts | **Reports exportados saem 100% em português enquanto toda a UI é en-us** — O único locale do app é en-us (src/i18n/ contém só en-us.ts e index.ts), mas o MD/PDF gerado é hardcoded em PT: 'últimos X dias'/'todo o histórico' (export.ts:38-45), headers 'Conv | M |
| P2 | Variantes de resposta (Messages) | **Navegação de variantes usa fallback de índice inconsistente — mostra N/N mas seta ‹ desabilitada** — O botão prev usa disabled={(msg.variantIndex ?? 0) <= 0} (Messages.tsx:365), enquanto a contagem e o next usam ?? msg.variants.length - 1 (Messages.tsx:372, 380) — e o store também | S |
| P2 | variantes de resposta (regenerate) | **Variantes do regenerate não são persistidas — ao reabrir o chat só sobra a versão exibida** — O branching guarda `variants[]/variantIndex` no store (store/chat.ts:55-58, 310-346) e a UI oferece navegação ‹ N/M ›. Mas ChatMessageStored (chatPersistence.ts:17-26) não tem camp | M |
| P2 | Vault → RAG (provider de embedding) | **Descrição do provider de embedding só explica 2 dos 4 providers do dropdown** — ragProviderDesc diz apenas 'OpenAI = text only (paid). OpenRouter Nemotron VL = text + image (free, tight rate limit)' — mas o dropdown lista também Gemini e Nvidia NIM (ORDER, lin | S |
| P2 | vault-qa/conversa multi-turno | **Follow-ups perdem o grounding: a busca usa só o texto do turno atual** — hybridSearch recebe query=userText cru. Um follow-up natural ("e o segundo ponto?", "resume isso") não tem keywords nem semântica útil → 0 hits → "answering without vault context". | L |
| P2 | vault-qa/erro de busca | **Busca falha → turno continua sem contexto do vault, sem avisar** — No catch da busca, o activity vira "failed" com a mensagem de erro, mas o fluxo segue e o LLM responde SEM nenhum contexto do vault e sem o vaultQaSuffix. O caso vizinho (0 hits) a | S |
| P2 | vault-qa/keyword search | **Braço keyword lê o vault inteiro a cada mensagem, mesmo com índice semântico** — searchVault faz cachedRead + regex em TODOS os .md do vault por turno (o braço keyword do híbrido roda sempre, independente do índice). Em vault de milhares de notas — justamente o | M |
| P2 | VoiceScreen (a11y) | **Status de voz (Listening/Thinking/Speaking) muda sem aria-live — leitor de tela não percebe nada** — O `<p className="axxa-voice-status">` (VoiceScreen.tsx:279) é a única indicação textual do estado da conversa e troca entre 'Listening…', 'Thinking…', 'Speaking…' e o interim do di | S |
| P2 | VoiceScreen (a11y) | **Dialog de voz sem focus trap/Escape e status sem aria-live — inconsistente com o resto do app** — O VoiceScreen usa role='dialog' mas não usa o useFocusTrap que os outros modais do repo usam, não fecha com Escape, e o <p> de status (Listening/Thinking/Speaking + transcrição int | S |
| P2 | VoiceScreen (ditado) | **Primeira frase finalizada dispara o envio — pausa curta no meio do raciocínio corta o usuário** — `onFinal` para o ditado e envia imediatamente o primeiro resultado final (VoiceScreen.tsx:101-107), e a Web Speech API finaliza um segmento após ~1s de silêncio. Quem pausa pra pen | M |
| P2 | VoiceScreen (erros de envio) | **Erro do provider é lido em voz alta com a ação de correção escondida atrás do overlay** — Erros de envio viram `ai-response` com `isError:true` (useChatEngine.ts:83-89) e o filtro do lastAi não exclui erros (AxxaApp.tsx:1923-1925), então o modo voz lê o erro cru em voz  | M |
| P2 | VoiceScreen (loop hands-free) | **Loop hands-free quebra sozinho quando o reconhecimento expira por silêncio** — O SpeechRecognition do Chromium auto-encerra após alguns segundos de silêncio; o onEnd do VoiceScreen só faz setState('idle'). Numa conversa hands-free, se o usuário demora a respo | M |
| P3 | 'See more' — 3 modos | **Chevron-down no 'See more' sugere expandir inline, mas a ação abre um bottom sheet** — Nos três modos o 'See more' usa ícone chevron-down (ComposerSuggestions.tsx:105,123,140). Chevron para baixo é a convenção de 'expandir aqui embaixo/accordion'; o que acontece é um | S |
| P3 | agent/chips de atividade | **Meta dos chips acoplada por regex ao texto PT do resultado da tool — quebra silenciosa se o formato mudar** — summarizeToolResult extrai '8 items' com a regex /\((\d+)\s+itens?\)/ sobre a string 'Conteúdo de X (N itens):' produzida por vault_list. Qualquer tradução/i18n dos resultados de t | M |
| P3 | Animação de entrada das sugestões | **Stagger só cobre os 3 primeiros filhos — o 'See more' (4º) entra ANTES dos itens** — A animação axxa-suggest-in com `backwards` é aplicada a todos os balões, mas os delays escalonados param no nth-child(3) (main.css:1387-1395). O 4º filho — sempre o 'See more' — an | S |
| P3 | Câmera in-app | **Overlay da câmera usa scrim translúcido de modal — antes do vídeo carregar (e no estado de erro) o chat aparece atrás** — O .axxa-camera-overlay compartilha o background de scrim com os modais (var(--background-modifier-cover, rgba(0,0,0,.45)), main.css:808-812) e não tem background próprio no bloco d | S |
| P3 | ChatSearchModal | **Busca em chat sem mensagens falha silenciosamente e resultados não destacam o termo** — handleOpenSearch retorna cedo quando hits.length===0: o clique no ícone de busca simplesmente não faz nada, parecendo botão quebrado. Nos resultados, o trecho é texto puro truncado | M |
| P3 | Composer / placeholder x ticker | **Campo fica sem nenhum placeholder quando há anexo pendente e o editor perde o foco** — O CSS esconde o cm-placeholder sempre que o composer não tem foco (quem assume é o ticker), mas o ticker só renderiza sem streaming e sem anexos pendentes. No mobile o fluxo é comu | S |
| P3 | ConfirmModal | **Confirmação destrutiva sem título e com CTA genérico "Confirm"** — O modal mostra só um <p> com a mensagem e botões "Cancel"/"Confirm" (com setWarning). Sem heading, a área de título do Modal do Obsidian fica vazia; e "Confirm" genérico obriga o u | S |
| P3 | Connections → Providers · badge de tipo de key | **Badge de key não diferencia 'sem key' de key válida salva, e não há ação de testar a conexão** — O badge vivo (Project key/Admin key/Unrecognized) só valida FORMATO; não existe nenhum 'Test connection' nem estado 'connected ✓' no tab do provider — o único jeito de saber se a k | M |
| P3 | conversations/busca | **Placeholder usa '...' (três pontos) em vez do ellipsis '…' padrão do produto, e omite que busca por modo** — `searchPlaceholder: "Search by title, model or provider..."` (en-us.ts:300) usa três pontos ASCII enquanto o resto do copy usa o caractere '…' ('Listening…' en-us.ts:86, 'Checking… | S |
| P3 | conversations/filtro-modo | **SegmentedRow usa role=tablist/tab sem o contrato de teclado de tabs** — O controle declara `role="tablist"` e `role="tab"` com aria-selected (SegmentedRow.tsx:145, 175-176), mas não implementa roving tabindex nem navegação por setas — todos os 'tabs' s | M |
| P3 | conversations/header | **Contador '6/6' no header é críptico e vira ruído quando nada está filtrado** — O header mostra `filtered.length/chats.length` sem rótulo (ConversationsList.tsx:253-255). Sem filtro ativo, '6/6' não comunica nada; com filtro, o formato 'N/M' exige decodificaçã | S |
| P3 | Day separator (ChatArea) | **Day separator estilizado como pill mas sem background — renderiza como texto solto** — O span do separador tem padding 3px 12px + border-radius 999px (main.css:382-388) mas nenhuma declaração de background ou color — o 'pill' é invisível e 'Today' aparece como texto  | S |
| P3 | Edição inline do UserBubble (Messages) | **Bolha em modo edição perde o data-msg-id — busca/highlight não encontram a mensagem** — O branch de edição (Messages.tsx:160-199) renderiza o wrapper sem data-msg-id (presente só no branch normal, linha 204). Se o usuário abrir a busca e escolher essa mensagem enquant | S |
| P3 | flow-errors / storybook | **Story chat-error usa content vazio: card de erro renderiza mudo (e revela falta de fallback)** — mockErrorMessage tem content: "" (mock.ts:251-258), então o screenshot chat-error--dark.png mostra o card só com o triângulo, sem NENHUM texto de erro — a story não representa o es | S |
| P3 | flow-errors / truncated | **Detecção de resposta cortada só existe no chat mode e depende do provider reportar usage** — A heurística de truncamento (output ≥ 95% do maxTokens) exige lastOutputTokens > 0 (useChatEngine.ts:268-276) — provider que não emite usage no stream nunca mostra o botão "Continu | M |
| P3 | Fontes do projeto (touch targets) | **Alvos de toque abaixo do mínimo: remover fonte 26px e swatches de cor 30px** — O 'x' de remover fonte tem 26x26px (.axxa-proj-source-remove, main.css:2124-2130) e os swatches 30x30px (:2221-2224) — abaixo dos ~44px recomendados para mobile, num plugin cujo ce | S |
| P3 | Grade de ícones do projeto | **'trash-2' como ícone escolhível de projeto colide com o affordance de deletar logo abaixo** — PROJECT_ICONS inclui 'trash-2' (projects.ts:26) — no modo edição, a lixeira aparece duas vezes na mesma tela com significados opostos: como opção de identidade do projeto na grade  | S |
| P3 | handleOpenSettings (fallback) | **Fallback do 'abrir Settings' mostra o LABEL do botão como Notice — se a API semi-privada falhar, o usuário vê um toast 'Open Settings' sem sentido** — O catch de `handleOpenSettings` faz `new Notice(t.header.openSettings)` — a string é o rótulo do botão ('Open Settings'), não uma instrução. O único ponto de recuperação do CTA pri | S |
| P3 | Haptics | **Vibração usa dois caminhos (helper de 8ms vs navigator.vibrate(30) cru) e não tem como desligar** — O helper hapticTick (8ms, haptics.ts:8-14) é o padrão declarado para seleções, mas 4 pontos chamam navigator.vibrate?.(30) direto: início e fim de gravação de voz (Composer.tsx:810 | S |
| P3 | imagegen/agente | **Resultado da tool generate_image devolvido ao LLM em português hardcoded** — No fluxo do agente, o texto de resultado da tool ('Usuário cancelou a geração...', 'Imagem gerada... NÃO repita a geração') é PT fixo (runAgentTurn.ts:344-363). Funciona, mas com p | S |
| P3 | MediaScreen | **Empty state do Media descreve só o escopo AXXA mesmo quando o filtro é "Whole vault"** — Com o filtro em "Whole vault" e vault sem mídia, o empty diz "Generated or attached images, audio and video show up here" — copy que descreve a pasta AXXA (geradas/anexadas), não o | S |
| P3 | onboarding/a11y | **Ícones decorativos da lista de features sem aria-hidden** — O componente Icon nunca marca aria-hidden="true" no span/SVG que injeta via setIcon; os 5 ícones da lista de features (e o do CTA) são puramente decorativos e podem ser anunciados  | S |
| P3 | onboarding/código | **Ícones pareados por índice com o array de features do i18n — acoplamento frágil entre arquivos** — OnboardingScreen define icons=[...5 nomes] e casa com t.onboarding.features[i] por posição. Quando a tradução PT (ou uma edição de copy) reordenar/adicionar uma feature, o pareamen | S |
| P3 | onboarding/copy | **"Skip for now" promete temporariedade, mas o skip é permanente** — O copy "for now" sugere que o welcome volta depois, mas onDismiss grava onboardingDone=true para sempre — não há nenhum mecanismo de re-exibição nem comando para rever a tela. Copy | S |
| P3 | onboarding/copy | **Nomes de providers divergem do resto do app: "Claude" e "NIM" vs "Anthropic" e "Nvidia NIM"** — A feature "6 providers, your key" lista "OpenAI, Claude, Gemini, OpenRouter, NIM and Ollama", mas providersMeta (usado em Settings/seletor, para onde o CTA manda o usuário) chama o | S |
| P3 | onboarding/copy | **Promessa incondicional "stored in the OS keychain" mas o código tem fallback plaintext** — A nota afirma sem ressalva que a chave vai para o OS keychain, mas saveSettings tem fallback explícito: em runtime sem SecretStorage a chave é salva em plaintext no data.json (main | S |
| P3 | persistência .md (escrita) | **saveChat sobrescreve o arquivo inteiro sem escrita atômica — kill no meio trunca o chat e ele some da lista sem aviso** — saveChat faz adapter.write direto no path final (chatPersistence.ts:370), reescrevendo o histórico COMPLETO a cada save. Se o processo morrer no meio (mobile), o .md fica truncado/ | M |
| P3 | Reactions (like/dislike) | **Like/dislike persistem no .md mas não têm nenhum efeito nem consequência visível — feedback que não vai a lugar algum** — setReaction grava e o auto-save persiste (store/chat.ts:286-293; AxxaApp.tsx:473-476), mas nada consome a reaction: não aparece em Statistics, não sugere regenerar após dislike, nã | S |
| P3 | Reasoning collapsible (Messages) | **Clique no painel de reasoning durante o stream alterna estado invisível e deixa o painel preso aberto depois** — expanded = open || live (Messages.tsx:91): enquanto live, o painel é forçado aberto e o clique no header alterna `open` sem efeito visual nenhum (nem consegue colapsar). Se o usuár | S |
| P3 | Resposta vazia do provider | **'[Empty response received]' vira bolha normal com footer completo (like, salvar como nota, TTS de nada) em vez de estado de erro com retry** — Quando o stream termina sem nenhum token, streamReply adiciona um ai-response comum com t.ai.emptyResponse (useChatEngine.ts:278-281), sem isError. A UI renderiza o footer inteiro: | S |
| P3 | settings/skills | **Contagem "N skills loaded" fica velha após trocar a pasta de skills** — O onChange do campo skillsPath salva e chama reloadSkills (AxxaSettingsTab.ts:2211-2215) mas não redesenha a seção — o texto "N skill(s) loaded" logo abaixo (linha 2223) continua m | S |
| P3 | Sidebar (recentes) | **Deletar conversa na gaveta só existe via right-click/long-press** — Na sidebar, o menu de deletar só abre por onContextMenu — usuário de teclado/SR não tem como invocá-lo ali (nenhum botão "..." como o da tela Conversations, que mitiga o problema p | S |
| P3 | sidebar/aria-label | **A gaveta inteira é anunciada como 'Conversations', mas contém navegação, conta e settings** — aria-label do aside usa t.header.conversations (Sidebar.tsx:236) — leitor de tela anuncia o dialog como 'Conversations' embora ele seja o menu principal do app (nav de 5 telas + no | S |
| P3 | sidebar/filtro segmentado a11y | **SegmentedRow declara role=tablist/tab mas não implementa o padrão de tabs (nem é tabs)** — SegmentedRow.tsx:145 usa role='tablist' e :175 role='tab' + aria-selected, mas não há roving tabindex nem navegação por setas — cada 'tab' fica no tab-order individual, contradizen | S |
| P3 | sidebar/footer conta | **Avatar 'YO' são as 2 primeiras letras do label genérico 'Your account' — parece iniciais de usuário mas é ruído** — O avatar deriva de t.account.label.slice(0,2) (Sidebar.tsx:425) → 'YO' em EN, e viraria 'SU' ('Sua conta') em PT. Parece um monograma de usuário real, mas é um artefato do copy — n | S |
| P3 | sidebar/nav ativa | **Item de nav ativo não ganha a 'pílula sutil' prometida — só bold, que ainda causa jitter de largura** — O header do componente promete 'a tela ativa ganha uma pílula sutil' (Sidebar.tsx:6) e o prop doc idem (:47), mas .axxa-sidebar-nav-item.is-active (main.css:1920-1922) só aplica fo | S |
| P3 | skills/slash-command | **Slash usa o nome cru da skill ("/Resumo TL;DR") — impossível de digitar por inteiro** — O label do comando é s.name literal (AxxaApp.tsx:1516), com espaços e pontuação, mas o trigger do autocomplete só reconhece [\w-]* (completions.ts:198): ao digitar o espaço de "/Re | S |
| P3 | slash commands | **'/clear' promete 'Limpar conversa atual' mas na prática inicia outra conversa (idêntico ao /new)** — O comando /clear (AxxaApp.tsx:1460-1465) chama newChat(), que zera currentChatId/título — a conversa antiga fica intacta no disco e o que o usuário ganha é uma conversa NOVA, exata | S |
| P3 | StatisticsScreen / formatUsd | **Precisão monetária mista na mesma lista: $0.212, $0.019 e $0.0010 lado a lado** — formatUsd alterna entre 4, 3, 2 e 0 casas decimais conforme a magnitude, então a coluna de custos do Top models mistura formatos ($0.212 / $0.019 / $0.0010) e o total sai "$0.481"  | S |
| P3 | Storybook / QA do fluxo | **Story 'chat-error' usa mensagem de erro com content vazio — o card de erro aparece em branco e o copy real do fluxo no-key nunca foi validado visualmente** — O mockErrorMessage tem `content: ""` e `errorCode: "invalid-key"`; no screenshot chat-error--dark.png o card mostra só o triângulo com uma faixa vazia. Como o ErrorMessage não tem  | S |
| P3 | Timestamps | **Hora com zero à esquerda ('05:57 PM') — não idiomático em en-US** — formatTime usa hour: '2-digit' (timestamps.ts:16-21), produzindo '05:57 PM' em todas as mensagens (visível em todos os screenshots). O padrão en-US — e o que ChatGPT/Claude/iMessag | S |
| P3 | Usage → Balance | **Balance abre a tab com 4 blocos 'add a top-up →' cuja seta aponta para o lado errado** — Para um usuário sem recargas registradas, a primeira coisa do Usage são 4 blocos (Openai/Anthropic/Gemini/Nim) dizendo 'add a top-up →' — a seta aponta para a direita/fora do card, | M |
| P3 | vault-qa/citações ambíguas | **Notas com mesmo basename em pastas diferentes geram citações idênticas que abrem a nota errada** — O bloco de contexto usa `### [[basename]]` (path só em itálico, fora do link). Dois hits "projetos/Ideias.md" e "arquivo/Ideias.md" viram dois headers [[Ideias]] idênticos; a citaç | S |
| P3 | vault-qa/índice desatualizado | **Índice velho responde por notas já editadas sem nenhum sinal de staleness no chat** — Auto-reindex é opt-in (e só roda com índice existente); com ele desligado, notas editadas/criadas após a indexação não existem no braço semântico e os excerpts injetados podem esta | M |
| P3 | vault-qa/keyword matching | **Keywords com menos de 3 caracteres são descartadas — "IA", "AI", "ML", "UX" ficam invisíveis** — extractKeywords filtra w.length >= 3. Pergunta "minhas notas sobre IA" perde a única keyword relevante; sem índice semântico o resultado é "No relevant notes found" mesmo com dezen | S |
| P3 | VoiceScreen (ajustes de voz) | **Dropdown de vozes despeja todas as vozes do sistema sem filtro ou ordenação por idioma** — O select lista `listVoices()` inteiro (VoiceScreen.tsx:319-323) — no desktop isso passa fácil de 70-100 vozes em dezenas de idiomas, sem agrupar nem priorizar o idioma da UI (`lang | S |

## 6. Achados refutados na verificação (transparência)

- **Impossível enviar mensagem só com áudio — beco sem saída após gravar** (Composer (hold-to-record)) — REFUTADO. O revisor não leu o onstop do recorder: Composer.tsx:792-796 insere o alias ('Áudio 0:05 ') no editor via view.dispatch(replaceSelection) logo após gravar. Isso dispara o updateListener (linha 458-462) que seta

## 6b. P0/P1 sem veredito (verificador não cobriu — tratar como suspeita)

- [P1] **Composer do vault-qa usa position:fixed no viewport — escapa do painel no desktop** (Composer do Vault Q&A)

## 7. Cobertura e lacunas (crítico de completude)

GAPS DE COBERTURA — priorizados (12)

1. **SkillsScreen nunca inspecionada visualmente** — P1 | kind: state | effort: M
   A área "voice-skills" só capturou voice (ADHOC-voice-injected.png). Não existe story "skills" (storybook/stories.tsx:178-326 lista 17 ids, nenhum skills) nem nenhum screenshot skills*.png em shots/. `/home/user/axxa-os-ai-agent/src/components/chat/SkillsScreen.tsx` (96 linhas) foi revisada só por código — layout, empty state e tema light nunca vistos.

2. **Modais críticos sem nenhum screenshot** — P1 | kind: state | effort: M
   Em shots/ o único modal capturado é o modelsheet. Ficaram sem inspeção visual: `src/agent/ConfirmationModal.ts` (177 linhas — aprovação de ferramenta do agente, momento de maior confiança do produto), `src/generation/ImageGenModal.ts` (267), `src/components/composer/CameraModal.tsx` (293), `src/components/composer/PlusModal.tsx`, `SuggestionsSheet.tsx`, `src/components/chat/ChatSearchModal.ts`, `PersonaModal.ts`, `LinkSafetyModal.ts`, `RenameChatModal.ts`. A área "modals" foi auditada apenas em código.

3. **Densidade compact/large só olhada no chat** — P1 | kind: consistency | effort: S
   Só existem chat--density-compact.png e chat--density-large.png. Settings (5 tabs), composer, modelsheet, conversations, projects, statistics nunca foram vistos fora de density=normal — exatamente onde densidade costuma quebrar (linhas de setting, chips, sheets). Matriz possível: 17 stories × 2 temas × 3 densidades × 2 viewports; cobertura real ≈ 2 temas × normal × mobile + 2 exceções.

4. **Desktop quase não coberto (e desktop+light nunca)** — P1 | kind: consistency | effort: S
   Só 4 capturas desktop, todas dark: chat--desktop.png, ADHOC-newchat-chat-desktop.png, ADHOC-newchat-agent-desktop.png, ADHOC-onboarding-desktop-dark.png. Settings, sidebar, conversations, projects, statistics, plans, modelsheet nunca em desktop; combinação desktop×light tem zero screenshots — e Obsidian desktop é um público real do plugin.

5. **Empty states não exercitados** — P1 | kind: state | effort: M
   Todas as stories renderizam estado populado (mocks fixos em storybook/mock.ts). Nunca vistos: conversations sem nenhuma conversa, projects vazio, statistics/usage com zero dados, sidebar recém-instalado, resultado vazio da busca de conversas. São as telas do primeiro dia de uso — contíguas ao flow-first-run mas fora dele.

6. **Providers Ollama/NIM/OpenRouter sem cobertura visual nem de fluxo** — P2 | kind: flow | effort: M
   Connections só capturou anthropic/gemini/openai (ADHOC-conn-providers-{anthropic,gemini,openai}-dark.png). `src/providers/ollama.ts` (350 linhas), `nim.ts` (599) e `openrouter.ts` (195) não foram tocados por nenhum flow: setup de base URL local (Ollama sem API key), listagem de modelos locais e erros de conexão local ficaram sem revisão.

7. **Integração real com Obsidian não verificada (limitação estrutural)** — P2 | kind: flow | effort: L
   Toda a auditoria rodou no Storybook com `storybook/obsidian-shim.ts`. `src/main.ts` (1065 linhas — comandos, ribbon, settings tab registration), `src/views/AxxaView.tsx` e o modo `mobileFullscreen`/`.axxa-fullscreen` (que será mantido) não foram exercitados no app real: teclado mobile sobrepondo o composer, safe-area do iOS e coexistência com a sidebar nativa do Obsidian seguem não testados.

8. **Export de uso nunca exercitado** — P2 | kind: flow | effort: S
   `src/usage/export.ts` tem 444 linhas e nenhuma evidência de teste no flow-usage (que cobriu agregação/saldo). Formato do arquivo gerado, nomes de coluna e comportamento com dataset vazio não foram verificados.

9. **Interações intra-chat não capturadas** — P2 | kind: ux | effort: M
   `src/components/chat/useMessageContextMenu.ts` (menu de contexto de mensagem), editar/regenerar mensagem e comportamento do auto-scroll durante streaming não têm screenshot nem menção — as stories chat/composer-streaming são estáticas e ninguém interagiu com uma mensagem antes de capturar.

10. **Markdown edge cases finos** — P2 | kind: bug | effort: S
    `src/components/_shared/Markdown.tsx` (170 linhas) só foi visto com o conteúdo curto do mock (storybook/mock.ts tem apenas 2 ocorrências de code-fence/tabela). Tabela larga em viewport 390px (overflow-x?), bloco de código longo, listas aninhadas profundas e links longos sem quebra não foram renderizados por ninguém.

11. **Sub-áreas do flow-a11y prováveis de terem ficado de fora** — P3 | kind: a11y | effort: S
    Sem evidência em shots/ ou nas áreas de: prefers-reduced-motion, ordem de tab/foco nos modais em desktop (o `src/components/_shared/useFocusTrap.ts` existe mas nenhum modal foi aberto em desktop), e zoom/fonte grande do Obsidian.

12. **Áreas de src/ sem dono claro na matriz de revisão** — P3 | kind: consistency | effort: S
    Nenhuma área listada mapeia explicitamente: `src/components/layout/Header.tsx` (415 linhas — visível nas stories mas sem revisor dedicado), `src/components/_shared/ErrorBoundary.tsx` (o que o usuário vê num crash de render?), `src/agent/loopDetection.ts` e `src/providers/paramPolicy.ts`. Provavelmente tocados de raspão pelos flows, mas ninguém foi responsável por eles.

Cobertura confirmada OK (não reportar como gap): light×dark mobile para as 17 stories; settings nas 5 tabs (ADHOC-settings-*); projects/editor em dark e light; PT-BR ausente do i18n é intencional (src/i18n/index.ts:17 — "PT-BR removido, i18n será refeito").
