// src/i18n/pt-br.ts
// Strings do plugin em português brasileiro.
// É o "source of truth" do dicionário — o tipo `Translations` é inferido daqui.
// en-us.ts e qualquer outro locale precisam espelhar a mesma estrutura
// (TypeScript valida em build).

export const PT_BR = {
  composer: {
    placeholderChat: "Pergunte ao AXXA Agent...",
    placeholderVaultQa: "Pergunte sobre seu Vault...",
    placeholderAgent: "Peça pro Agent (ex: 'crie uma nota sobre X', 'organize a pasta Y')...",
    placeholderCoder: "Cole código ou pergunte como debugar...",
    sendLabel: "Enviar mensagem",
    stopLabel: "Parar geração",
    micLabel: "Segure pra gravar áudio",
    micRecording: "Solte pra parar",
    plusLabel: "Mais opções",
    attachImageLabel: "Anexar imagem",
    attachImageRemoveLabel: "Remover anexo",
    attachImageNoVision:
      "O modelo selecionado não aceita imagens. Troque por um modelo com vision (ex: gpt-4o, claude, gemini).",
    attachImagePastedNotice: "Imagem colada anexada",
    attachImageFailed: "Falha ao processar a imagem.",
  },

  recording: {
    micDenied: "Permissão de microfone negada — habilite nas configurações do sistema.",
    micUnsupported: "Microfone não suportado nesse dispositivo.",
    saved: (duration: string) => `Áudio salvo (${duration})`,
    saveFailed: "Erro ao salvar o áudio.",
    cancelled: "Gravação cancelada.",
    alias: (duration: string) => `Áudio ${duration}`,
  },

  menu: {
    copy: "Copiar",
    regenerate: "Regenerar",
    delete: "Deletar",
  },

  header: {
    newChat: "Nova conversa",
    openSettings: "Configurações",
    conversations: "Conversas",
    moreOptions: "Mais opções",
    fullscreen: "Tela cheia (mobile)",
    exitFullscreen: "Sair da tela cheia",
    search: "Buscar na conversa",
    copyConversation: "Copiar conversa",
    copyConversationDone: "Conversa copiada",
    persona: "Persona do chat",
    personaActive: "Persona do chat (ativa)",
  },

  chat: {
    searchPlaceholder: "Buscar nesta conversa…",
    searchResults: (n: number) => `${n} resultado${n === 1 ? "" : "s"}`,
    searchNoResults: "Nenhum resultado nesta conversa.",
    continueLabel: "Continuar",
    continueTitle: "Resposta cortada no limite — continuar de onde parou",
    personaTitle: "Persona do chat",
    personaDesc:
      "Instrução de sistema custom pra esta conversa — define papel, tom e regras. Vazio = usa o padrão.",
    personaPlaceholder:
      "Ex: Você é um revisor técnico cético. Responda curto, aponte riscos primeiro.",
    personaSave: "Salvar",
    personaClear: "Limpar",
    personaSet: "Persona definida pra este chat",
    personaCleared: "Persona removida — usando o padrão",
  },

  conversations: {
    title: "Todas as conversas",
    back: "Voltar",
    searchPlaceholder: "Buscar por título, modelo ou provider...",
    emptyAll: "Nenhuma conversa salva ainda. Mande sua primeira mensagem!",
    emptySearch: "Nenhuma conversa encontrada pra essa busca.",
    sortDateDesc: "Mais recentes",
    sortDateAsc: "Mais antigas",
    sortTitleAsc: "Título A-Z",
    sortMsgsDesc: "Mais mensagens",
    sortTokensDesc: "Mais tokens",
    filterAll: "Todos",
    renameTitle: "Renomear conversa",
    renameAria: "Renomear conversa",
    renameModalTitle: "Renomear conversa",
    renameInputLabel: "Novo título",
    renameSubmit: "Salvar",
    renameCancel: "Cancelar",
    renameSuccess: (title: string) => `Renomeado para "${title}".`,
    renameFailed: (msg: string) => `Falha ao renomear: ${msg}`,
  },

  starter: {
    title: "Nova conversa",
    subtitle:
      "Configure antes de começar — provider e modelo travam ao mandar a primeira mensagem.",
    modeLabel: "Modo",
    providerLabel: "Provider",
    modelLabel: "Modelo",
    effortLabel: "Effort",
    recentChatsLabel: "Conversas recentes",
    hint: 'Mande a primeira mensagem pra começar. Provider e modelo travam — só Effort pode mudar depois (via "+").',
    modelCapsAria: "Capacidades do modelo",
    capVisionTooltip: "Aceita imagens (multimodal)",
    capToolsTooltip: "Suporta tool calling (Agent Mode)",
    capStreamTooltip: "Streaming real (tokens chegam ao vivo)",
    capFreeTooltip: "Modelo gratuito",
    capImageGenTooltip: "Gera imagens — salvas em axxa-ai/generation/images",
    capAudioGenTooltip: "Gera áudio — salvo em axxa-ai/generation/audio",
    capVideoGenTooltip: "Gera vídeo — salvo em axxa-ai/generation/video",
  },

  modes: {
    chat: "Chat",
    chatDesc: "Conversa direta",
    vaultQa: "Vault Q&A",
    vaultQaDesc: "Busca notas como contexto",
    agent: "Agent",
    agentDesc: "Lê, cria, edita e organiza arquivos do vault",
    coder: "Coder",
    coderDesc: "Edita código com diff preview (em breve)",
    study: "Study",
    studyDesc: "Flashcards, quizzes e resumos de estudo (em breve)",
    soonBadge: "em breve",
    comingSoon: (name: string) => `O modo ${name} chega em breve.`,
  },

  agent: {
    thinking: "🤖 Agente pensando...",
    needsOpenAI:
      "Agent Mode requer um provider com tool calling. Use OpenAI, Anthropic, Gemini, OpenRouter, Nvidia NIM ou Ollama (modelo compatível).",
    deniedAction: "🚫 Ação negada pelo usuário",
    maxTurnsReached: (n: number) =>
      `Agente atingiu o limite de ${n} turnos sem terminar. Tente refrasear a tarefa.`,
    permissionLevel: "Nível de permissão do Agent",
    permissionLevelDesc:
      "Quanto controle o Agent tem sobre o vault. Delete sempre pede confirmação independente do nível.",
    permissionAsk: "Ask — confirma cada ação que modifica arquivo",
    permissionVault: "Vault — read/write livre, só delete pergunta",
    permissionYolo: "YOLO — zero modais, exceto delete (irreversível)",
  },

  plus: {
    dialogLabel: "Opções da conversa",
    title: "Opções da conversa",
    attachTitle: "Anexar arquivo",
    attachSub: "PDFs, imagens, notas do vault — virão no Módulo 5",
    attachSoonBadge: "em breve",
    attachPdf: "PDF",
    attachImage: "Imagem",
    attachNote: "Nota",
    attachPdfNotice: "Anexar PDF vem no Módulo 5",
    attachImageNotice: "Anexar imagem vem no Módulo 5",
    attachNoteNotice: "Referenciar nota vem no Módulo 5",
    effortTitle: "Effort",
    effortSub: "Intensidade do processamento — afeta max_tokens",
    pickNoteEmpty: "Nenhuma nota markdown no vault.",
    pickNotePrompt:
      "Cole o caminho da nota (ex: pasta/nota.md):",
    pickNoteFailed: (msg: string) => `Falha ao anexar nota: ${msg}`,
    pickNoteNotFound: (path: string) =>
      `Nota não encontrada: ${path}`,
    pickPdfWrongType: "Selecione um arquivo PDF.",
    pickPdfFailed: "Falha ao anexar PDF.",
    webSearchTitle: "Busca na web",
    webSearchDesc:
      "Provider/modelo decide quando buscar. Pesquisa ativada quando precisar.",
    createImageTitle: "Criar imagem",
    createImageDesc: "Permite ao modelo gerar imagens na resposta.",
    createImageNoGen:
      "Modelo atual não gera imagens. Selecione um modelo com badge 'img-gen'.",
    extendedThinkingTitle: "Raciocínio estendido",
    extendedThinkingDesc:
      "Modelos com reasoning visível mostram passos antes de responder.",
  },

  vault: {
    searching: (topK: number, effort: string) =>
      `Buscando até ${topK} notas no vault (effort: ${effort})...`,
    foundContext: (count: number) =>
      `${count} nota${count > 1 ? "s" : ""} encontrada${count > 1 ? "s" : ""} como contexto`,
    notFound:
      "Nenhuma nota relevante encontrada — respondendo sem contexto do vault",
  },

  ai: {
    thinking: "Pensando...",
    emptyResponse: "[Resposta vazia recebida]",
    errorPrefix: "[Erro]",
    unknownError: "Erro desconhecido.",
  },

  systemPrompt: {
    base:
      "Você é o AXXA Agent, um assistente integrado ao Obsidian. " +
      "Responda em português, de forma clara, direta e útil. " +
      "Quando fizer sentido, use Markdown.",
    vaultQaSuffix:
      "\n\nO usuário está no modo Vault Q&A — abaixo seguem notas relevantes " +
      "extraídas do vault dele. Use elas como fonte principal pra responder, " +
      "e cite o título da nota quando referenciar.\n\nNotas:\n\n",
  },

  settings: {
    title: "AXXA OS — AI Agent",
    topTabs: {
      providers: "Providers",
      appearance: "Aparência",
      effort: "Effort",
      usage: "Usage",
      outros: "Outros",
    },
    effortTabs: {
      low: "Low 🐢",
      med: "Med ⚖️",
      high: "High ⚡",
      xhigh: "xHigh 🔥",
      max: "Max 🚀",
    },
    effortIntro:
      "Ajuste fino dos níveis de Effort. Cada nível tem sua sub-aba — campos vazios voltam aos defaults built-in. Max é uncapped por padrão (200 turns, 80% do contexto).",
    effortReset: "Restaurar padrões deste nível",
    effortResetConfirm: "Restaurar valores padrão deste nível? Seus overrides serão perdidos.",
    effortResetDone: "Restaurado pros defaults.",
    effortFields: {
      maxTokens: "max_tokens (resposta)",
      maxTokensDesc:
        "Máximo de tokens que o modelo pode gerar na resposta. 0 = uncapped (usa % do context window do modelo).",
      agentMaxTurns: "Agent: turnos máximos",
      agentMaxTurnsDesc:
        "Quantos rounds de tool-calling o Agent pode fazer antes de desistir. 0 = ilimitado (só anti-loop detection corta). Era 10 hardcoded em todos os níveis — agora cada effort tem o seu.",
      temperature: "Temperatura",
      temperatureDesc:
        "Aleatoriedade da resposta (0-2). Baixa = preciso/repetitivo, alta = criativo/variado. -1 = não enviar (provider usa default).",
      vaultTopK: "Vault Q&A: top-K notas",
      vaultTopKDesc: "Quantas notas o modo Vault Q&A injeta como contexto.",
      vaultExcerptChars: "Vault Q&A: chars por trecho",
      vaultExcerptCharsDesc:
        "Tamanho do excerto de cada nota injetado no system prompt.",
      parallelToolCalls: "Tool calls em paralelo",
      parallelToolCallsDesc:
        "Quando o Agent pede várias tools no mesmo turno, executa em paralelo (mais rápido). Default ativo em high+.",
      toolRetryOnError: "Retentar tools em erro",
      toolRetryOnErrorDesc:
        "Quantas vezes retentar tools que falham com erro transitório (network/timeout/locked). Erros estruturais (path errado) não são retentados.",
      contextReservePercent: "Reserva de contexto (max)",
      contextReservePercentDesc:
        "Quando max_tokens=0 (uncapped), quantos % da janela do modelo usar pra resposta. 80% = sobra 20% pra prompt+system.",
      loopDetectionWindow: "Detecção de loop (turnos)",
      loopDetectionWindowDesc:
        "Quantas chamadas repetidas iguais consecutivas viram um nudge automático pro Agent reconsiderar. 0 = desativado.",
    },
    tabs: {
      openai: "OpenAI",
      anthropic: "Anthropic",
      gemini: "Gemini",
      openrouter: "OpenRouter",
      nim: "Nvidia NIM",
      ollama: "Ollama",
      outros: "Outros",
    },
    providerIntro:
      "Configure a API key e selecione os modelos ativos pro provider escolhido.",
    defaultProvider: "Provider padrão",
    defaultProviderDesc: "Qual API usar nas conversas",
    apiKey: "API Key",
    apiKeyDescOpenai: "sk-... — armazenada localmente no vault.",
    apiKeyDescAnthropic: "sk-ant-... — armazenada localmente.",
    apiKeyDescGemini: "Chave do aistudio.google.com/apikey — armazenada localmente.",
    apiKeyDescOpenrouter: "sk-or-... — armazenada localmente.",
    apiKeyDescNim: "nvapi-... (gerada no build.nvidia.com) — armazenada localmente.",
    model: "Modelo padrão",
    modelDesc: (provider: string) =>
      `Modelo padrão do ${provider}. Use 'Buscar' pra ver os disponíveis.`,
    modelFetchTooltip: "Buscar modelos via API",
    modelSearchingNotice: (provider: string) =>
      `Buscando modelos do ${provider}...`,
    modelNoneNotice: (provider: string) =>
      `Nenhum modelo retornado pelo ${provider}.`,
    modelLoadedNotice: (count: number) => `${count} modelos carregados.`,
    modelFailedNotice: (msg: string) => `Falha ao buscar modelos: ${msg}`,
    modelSetNotice: (model: string) => `Modelo definido: ${model}`,
    activeModels: "Modelos ativos",
    activeModelsDesc: (provider: string) =>
      `Quais modelos do ${provider} aparecem no seletor da tela inicial. Adicione manualmente pra incluir modelos legacy.`,
    activeModelsEmpty: "Nenhum modelo ativo. Adicione abaixo.",
    activeModelsAddBtn: "Adicionar",
    activeModelsAddPlaceholder: (example: string) => `ex: ${example}`,
    activeModelsFetchBtn: "Buscar da API",
    activeModelsFetchingBtn: "Buscando...",
    activeModelsAlready: (model: string) => `"${model}" já está na lista.`,
    activeModelsAdded: (model: string) => `Modelo "${model}" adicionado.`,
    activeModelsAvailable: (count: number) =>
      `${count} modelos disponíveis. Marque os que devem aparecer no seletor:`,
    activeModelsRemoveTitle: "Remover",
    geminiIntro:
      "Google Gemini via endpoint OpenAI-compatible. Tool calling funciona em 2.5+/3.x. Tier free generoso no AI Studio.",
    openrouterIntro:
      "Proxy multi-modelo. Modelos prefixados por provider (ex: anthropic/claude-3.5-sonnet).",
    nimIntro:
      "Nvidia NIM hospedado (1k créditos free). Modelos: Llama 3.3/3.1, Nemotron, Mixtral, Qwen2.5, DeepSeek R1, Phi-4 + geração de imagem (SDXL, FLUX). Se receber erro 404/403, vá em build.nvidia.com → Organization → habilite 'Public API Endpoints'.",
    ollamaIntro:
      "LLMs locais. Precisa do servidor Ollama rodando (https://ollama.com). Tool calling funciona em llama3.1+, qwen2.5+, mistral-large.",
    ollamaEndpoint: "Endpoint",
    ollamaEndpointDesc:
      "URL do servidor Ollama (default: http://localhost:11434)",
    outrosIntro: "Configurações gerais — paths, idioma, aparência.",
    outrosTabs: {
      geral: "Geral",
      ui: "Interface",
      agent: "Agent",
      rag: "RAG",
      usage: "Usage",
    },
    outrosGeralIntro: "Idioma, vault paths e preferências básicas.",
    outrosUiIntro: "Aparência, chips visíveis, code blocks.",
    outrosAgentIntro: "Permissões e comportamento do Agent Mode.",
    outrosRagIntro: "Busca semântica nas suas notas com embeddings.",
    outrosUsageIntro:
      "Contabilidade de tokens e custo estimado por conversa. Preços baseados em tabelas oficiais dos labs (ver src/usage/pricing.ts). Exportável em PDF e Markdown.",
    language: "Idioma",
    languageDesc:
      "Linguagem do plugin. A interface atualiza na hora.",
    languagePtBr: "Português (Brasil)",
    languageEnUs: "English (US)",
    chatsPath: "Pasta dos chats",
    chatsPathDesc: "Onde os chats serão salvos no Vault",
    skillsPath: "Pasta das skills",
    skillsPathDesc: "Onde as skills serão salvas no Vault (vem no Módulo 7)",
    recordingsPath: "Pasta das gravações",
    recordingsPathDesc: "Onde os áudios gravados pelo botão de mic serão salvos",
    generationPath: "Pasta de gerações",
    generationPathDesc:
      "Onde mídias geradas (imagem/áudio/vídeo) são salvas. Cada saída gera 2 arquivos: a mídia + sidecar .md com frontmatter (prompt, modelo, provider).",
    comingSoon: "Em breve",
    comingSoonItems: [
      "Audio recorder (mic) — Sprint E",
      "Agent Mode (file ops) — Módulo 6",
      "Skills management — Módulo 7",
      "MCP Connect (Notion, ClickUp, Figma) — Módulo 9",
    ] as string[],
    codeWrap: "Quebrar linhas em code blocks",
    codeWrapDesc:
      "Quando ativo, code blocks longos quebram em vez de scrollar horizontalmente. Útil em telas estreitas (mobile).",
    appearance: "Aparência",
    appearanceDesc:
      "Escolha um fundo pra interface do AXXA. Cores e gradientes (lineares + radiais).",
    backgroundLabels: {
      none: "Padrão",
      sunset: "Pôr do sol",
      ocean: "Oceano",
      forest: "Floresta",
      violet: "Violeta",
      mono: "Mono",
      aurora: "Aurora",
      spotlight: "Spotlight",
      nebula: "Nebula",
      pulse: "Pulse · live",
      flow: "Flow · live",
      "aurora-live": "Aurora · live",
    },
    chips: "Chips visíveis",
    chipsDesc:
      "Escolha quais informações aparecem nas listas e no status line. Default é compacto — marque o que quiser ver.",
    chipsComposer: "Status line do Composer",
    chipsComposerDesc: "Aparece abaixo do campo de mensagem (uma única linha).",
    chipsList: "Cards da lista de chats",
    chipsListDesc: "Aparece em cada item de Recent Chats e Conversations.",
    chipsLabels: {
      mode: "Modo (chat / agent / vault-qa)",
      model: "Modelo",
      effort: "Effort",
      context: "Contexto usado / total",
      in: "Tokens in",
      out: "Tokens out",
      total: "Tokens total",
      speed: "Tokens por segundo (live)",
      date: "Data relativa",
      messages: "Quantidade de mensagens",
      tokens: "Tokens totais",
    },
    rag: "Vault Q&A (RAG)",
    ragDesc:
      "Busca semântica nas suas notas usando embeddings. Sem isso, o modo Vault Q&A usa busca keyword (mais rápido, menos preciso).",
    ragProvider: "Provider de embedding",
    ragProviderDesc:
      "OpenAI = texto only (pago). OpenRouter Nemotron VL = texto + imagem (free, rate limit apertado).",
    ragModel: "Modelo de embedding",
    ragModelDesc:
      "Badges: [FREE] sem custo, [🖼️] aceita imagens. Áudio não é suportado por nenhum modelo VL — pra áudio precisaria Whisper API (sprint próprio).",
    ragIndexPath: "Pasta do índice",
    ragIndexPathDesc:
      "Onde o arquivo de embeddings (.json) é salvo no Vault.",
    ragIndexBtn: "Indexar vault",
    ragReindexBtn: "Reindexar (do zero)",
    ragClearBtn: "Limpar índice",
    ragStats: (chunks: number, files: number, lastAt: string) =>
      `${chunks} chunks em ${files} arquivos · última: ${lastAt}`,
    ragStatsEmpty: "Índice vazio. Clique em 'Indexar vault' pra começar.",
    ragStatsMismatch:
      "⚠️ Modelo configurado é diferente do índice salvo. Reindexe pra usar o novo modelo.",
    ragProfileLabel: "Perfil do índice (quantização)",
    ragProfileRecommend: (count: number, name: string) =>
      `Seu vault: ${count} notas → recomendado: ${name}`,
    ragProfileNoDim:
      "Este modelo não suporta dim reduzida — usando dim cheia com int8.",
    ragAutoReindexLabel: "Reindexar automaticamente",
    ragAutoReindexDesc:
      "Re-embeda notas modificadas em background (4s após editar). Só roda com índice já criado. Cada re-embed consome tokens.",
    ragIndexingPhaseScanning: (done: number, total: number) =>
      `Escaneando vault: ${done}/${total}`,
    ragIndexingPhaseEmbedding: (
      done: number,
      total: number,
      chunks: number
    ) => `Indexando: ${done}/${total} arquivos · ${chunks} chunks embedados`,
    ragIndexingPhaseDone: (chunks: number, tokens: number) =>
      `Concluído. ${chunks} novos chunks · ~${tokens} tokens consumidos.`,
    ragIndexingCancel: "Cancelar",
    ragIndexingCancelled: "Indexação cancelada.",
    ragIndexingFailed: (msg: string) => `Falha na indexação: ${msg}`,
    ragNoApiKey:
      "API key da OpenAI não configurada. Vá em Settings → Providers → OpenAI primeiro.",
    ragNoOpenRouterKey:
      "API key do OpenRouter não configurada. Vá em Settings → Providers → OpenRouter primeiro.",
    ragClearConfirm:
      "Tem certeza? Isso apaga o índice. Você vai precisar reindexar pra usar Vault Q&A com embeddings de novo.",
    usagePeriodLabel: "Período:",
    usagePeriod7d: "Últimos 7 dias",
    usagePeriod30d: "Últimos 30 dias",
    usagePeriod90d: "Últimos 90 dias",
    usagePeriodAll: "Todo o histórico",
    usageLoading: "Calculando uso...",
    usageError: "Erro ao agregar uso",
    usageEmpty:
      "Nenhuma conversa salva ainda. Mande sua primeira mensagem pra começar.",
    usageCostLabel: "Gasto estimado",
    usageTokensInLabel: "Tokens in",
    usageTokensOutLabel: "Tokens out",
    usageChatsLabel: "Conversas",
    usageByProvider: "Por provider",
    usageByModel: "Por modelo (top 10)",
    usageByMode: "Por modo",
    usageHeatmap: "Últimos 30 dias",
    usageTopChats: "Top 10 conversas mais caras",
    usageColProvider: "Provider",
    usageColModel: "Modelo",
    usageColMode: "Modo",
    usageColTitle: "Título",
    usageColChats: "Conversas",
    usageColIn: "Tokens in",
    usageColOut: "Tokens out",
    usageColCost: "Custo",
    usageColTokens: "Tokens (in/out)",
    usagePartialFootnote:
      "* Custo parcial — algum modelo na agregação não tem pricing configurado. Edite src/usage/pricing.ts pra adicionar.",
    usageExport: "Exportar relatório",
    usageExportPdf: "PDF (imprimir)",
    usageExportMarkdown: "Markdown",
    usageExportHtml: "HTML",
    usageExportSuccess: (path: string) => `Salvo em ${path}`,
    usageExportFailed: "Falha ao exportar",
  },
};

// O type infere a estrutura completa do PT_BR (sem `as const` pra que
// strings fiquem como `string` em vez de literais — assim en-us.ts pode
// ter textos diferentes mantendo o mesmo shape).
export type Translations = typeof PT_BR;
