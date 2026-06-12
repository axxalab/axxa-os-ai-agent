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

  camera: {
    title: "Câmera",
    previewAlt: "Foto capturada",
    close: "Fechar câmera",
    flash: "Lanterna",
    retake: "Refazer",
    use: "Usar foto",
    useSystem: "Câmera do sistema",
    shutter: "Tirar foto",
    flip: "Virar câmera",
    unsupported: "Câmera não disponível neste dispositivo.",
    denied: "Não foi possível acessar a câmera. Permita o acesso ou use a câmera do sistema.",
    fileName: (stamp: string) => `Foto ${stamp}.jpg`,
  },

  skills: {
    title: "Apps & Skills",
    subtitle: "Templates do seu vault — toque pra usar na conversa.",
    close: "Voltar",
    use: "Usar",
    openNote: "Abrir nota",
    emptyTitle: "Nenhuma skill ainda",
    emptySub:
      "Crie notas .md na pasta de skills (axxa-ai/skills) — cada uma vira um app aqui.",
  },

  allSet: {
    title: "Tudo certo!",
    sub: "Você está pronto pra começar.",
  },

  voice: {
    title: "Modo Voz",
    introTitle: "Conheça o Modo Voz",
    feat1Title: "Conversas naturais",
    feat1Desc: "Fale e ouça as respostas — sem digitar.",
    feat2Title: "Lê em voz alta",
    feat2Desc: "As respostas do AXXA são faladas pra você.",
    feat3Title: "Voz e velocidade",
    feat3Desc: "Escolha a voz e o ritmo da leitura.",
    feat4Title: "Local e privado",
    feat4Desc: "Voz e fala processadas no seu dispositivo.",
    start: "Começar",
    close: "Fechar",
    settings: "Ajustes de voz",
    talk: "Tocar pra falar",
    stop: "Parar",
    statusListening: "Ouvindo…",
    statusThinking: "Pensando…",
    statusSpeaking: "Falando…",
    statusTapToTalk: "Toque no microfone pra falar",
    statusTtsOnly: "Ditado indisponível — leio as respostas em voz",
    sttUnavailable:
      "O ditado por voz não está disponível neste dispositivo. As respostas ainda são lidas em voz alta.",
    voiceLabel: "Voz",
    voiceDefault: "Padrão do sistema",
    speedLabel: "Velocidade",
    test: "Testar voz",
    testPhrase: "Olá! Esta é a voz do AXXA.",
  },

  projects: {
    title: "Projetos",
    back: "Voltar",
    newProject: "Novo projeto",
    emptyTitle: "Nenhum projeto ainda",
    emptySub: "Crie um projeto pra agrupar conversas e notas de contexto.",
    rowMeta: (chats: number, sources: number) =>
      `${chats} conversa${chats === 1 ? "" : "s"} · ${sources} fonte${sources === 1 ? "" : "s"}`,
    editorNewTitle: "Novo projeto",
    editorEditTitle: "Editar projeto",
    nameLabel: "Nome",
    namePlaceholder: "Nome do projeto",
    chooseIcon: "Escolher ícone",
    chooseColor: "Cor",
    save: "Salvar",
    cancel: "Cancelar",
    done: "Concluir",
    deleteProject: "Excluir projeto",
    tabChats: "Conversas",
    tabSources: "Fontes",
    chatsEmpty: "Nenhuma conversa neste projeto ainda.",
    sourcesEmpty: "Nenhuma fonte. Adicione notas do vault como contexto.",
    addSource: "Adicionar fonte",
    removeSource: "Remover fonte",
    newChatInProject: "Nova conversa neste projeto",
    created: (name: string) => `Projeto "${name}" criado`,
    deleted: "Projeto excluído",
    sourceAdded: "Fonte adicionada ao projeto",
  },

  inspire: {
    openLabel: "Inspire-se",
    title: "Inspire-se",
    subtitle: "Toque numa ideia pra começar",
    close: "Fechar",
    catAll: "Tudo",
    catCreate: "Criar",
    catLearn: "Aprender",
    catPlay: "Brincar",
    cards: [
      { title: "Editor de escrita", desc: "Revisa clareza, tom e gramática", icon: "pen-line", cat: "create", prompt: "Revise o texto abaixo melhorando clareza, tom e gramática, mantendo o sentido:\n\n" },
      { title: "Chuva de ideias", desc: "10 ideias criativas sobre um tema", icon: "lightbulb", cat: "create", prompt: "Me dê 10 ideias criativas e variadas sobre: " },
      { title: "Código comentado", desc: "Escreve e explica passo a passo", icon: "code", cat: "create", prompt: "Escreva e comente, passo a passo, um código que: " },
      { title: "Resumir nota", desc: "Pontos principais em tópicos", icon: "list", cat: "learn", prompt: "Resuma os pontos principais em tópicos curtos:\n\n" },
      { title: "Explique simples", desc: "Como se eu tivesse 5 anos", icon: "graduation-cap", cat: "learn", prompt: "Explique de forma bem simples, como para uma criança: " },
      { title: "Flashcards", desc: "Pergunta e resposta pra estudar", icon: "layers", cat: "learn", prompt: "Crie 10 flashcards (pergunta → resposta) sobre: " },
      { title: "Plano de estudos", desc: "Roteiro de 7 dias", icon: "calendar-days", cat: "learn", prompt: "Monte um plano de estudos de 7 dias, com metas diárias, sobre: " },
      { title: "Quiz relâmpago", desc: "5 perguntas pra testar", icon: "puzzle", cat: "play", prompt: "Crie um quiz de 5 perguntas (com gabarito no final) sobre: " },
      { title: "Adivinhe a palavra", desc: "Jogo de sim ou não", icon: "gamepad-2", cat: "play", prompt: "Vamos brincar: pense numa palavra e eu adivinho fazendo perguntas de sim ou não. Pode começar." },
    ],
  },

  responseStyle: {
    menuLabel: "Escolher estilo",
    normal: "Normal",
    concise: "Conciso",
    explanatory: "Explicativo",
    formal: "Formal",
    friendly: "Amigável",
    instrConcise:
      "Responda de forma concisa e direta, sem preâmbulos nem repetição.",
    instrExplanatory:
      "Explique com profundidade: detalhe o raciocínio, dê exemplos e quebre em passos.",
    instrFormal: "Use um tom formal e profissional, em linguagem precisa.",
    instrFriendly:
      "Use um tom amigável e acessível, como uma conversa entre amigos.",
  },

  linkSafety: {
    title: "Esse link é seguro?",
    desc: "Esse link não foi verificado e pode levar a um site de terceiros. Confira o endereço completo antes de abrir.",
    open: "Abrir link",
    copy: "Copiar link",
    cancel: "Cancelar",
    copied: "Link copiado",
    muteSession: "Não perguntar de novo nesta sessão",
  },

  menu: {
    copy: "Copiar",
    regenerate: "Regenerar",
    delete: "Deletar",
    edit: "Editar",
    cancel: "Cancelar",
    saveResend: "Salvar e reenviar",
  },

  header: {
    newChat: "Novo chat",
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
    modelSwitcherLabel: "Trocar modelo",
    modelLockedHint: "Escolher outro modelo abre uma nova conversa.",
    recents: "Recentes",
  },

  account: {
    badgeFree: "Free",
    badgePremium: "Premium",
    badgeFounder: "Founder",
    stats: (chats: number, tokens: string) =>
      `${chats} ${chats === 1 ? "conversa" : "conversas"} · ${tokens} tokens`,
  },

  chat: {
    searchPlaceholder: "Buscar nesta conversa…",
    searchResults: (n: number) => `${n} resultado${n === 1 ? "" : "s"}`,
    searchNoResults: "Nenhum resultado nesta conversa.",
    continueLabel: "Continuar",
    continueTitle: "Resposta cortada no limite — continuar de onde parou",
    deletedToTrash: "Conversa movida pra lixeira.",
    personaTitle: "Persona do chat",
    personaDesc:
      "Instrução de sistema custom pra esta conversa — define papel, tom e regras. Vazio = usa o padrão.",
    personaPlaceholder:
      "Ex: Você é um revisor técnico cético. Responda curto, aponte riscos primeiro.",
    personaSave: "Salvar",
    personaClear: "Limpar",
    personaSet: "Persona definida pra este chat",
    personaCleared: "Persona removida — usando o padrão",
    copied: "Resposta copiada",
    savedAsNote: (path: string) => `Nota criada: ${path}`,
    saveAsNoteFailed: "Falha ao salvar a nota.",
    disclaimer: "O AXXA pode errar. Confira informações importantes.",
    actionCopy: "Copiar",
    actionRegen: "Regenerar",
    actionLike: "Curtir",
    actionDislike: "Descurtir",
    actionReadAloud: "Ler em voz alta",
    actionStopReading: "Parar leitura",
    actionSaveNote: "Salvar como nota",
    reasoningLive: "Pensando…",
    reasoningDone: "Raciocínio",
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
    today: "Hoje",
    yesterday: "Ontem",
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

  // Dashboard — starter virou home do plugin (v0.1.103): stats de uso,
  // atividade, setup de nova conversa e status de RAG/providers.
  dashboard: {
    greetingMorning: "Bom dia",
    greetingAfternoon: "Boa tarde",
    greetingEvening: "Boa noite",
    tagline: "Seu hub de IA no vault — configure abaixo e mande a primeira mensagem.",
    overviewLabel: "Visão geral",
    statChats: "Conversas",
    statMessages: "Mensagens",
    statTokens: "Tokens",
    statCost: "Gasto estimado",
    activityLabel: "Atividade · 7 dias",
    activitySpend: "Gasto · 3 dias",
    activityEmpty: "Sem atividade ainda — sua primeira conversa aparece aqui.",
    activitySpendEmpty: "Sem gasto nesse período.",
    activityDay: (chats: number, tokens: string) =>
      `${chats} conversa${chats === 1 ? "" : "s"} · ${tokens} tokens`,
    activityBlock: (chats: number, cost: string) =>
      `${chats} conversa${chats === 1 ? "" : "s"} · ${cost}`,
    activityToday: "hoje",
    newChatLabel: "Nova conversa",
    viewAll: "Ver todas",
    statusLabel: "Status",
    ragTitle: "Índice RAG",
    ragStats: (chunks: string, files: number) =>
      `${chunks} chunks · ${files} notas`,
    ragLast: (when: string) => `última indexação: ${when}`,
    ragEmpty: "Nenhuma nota indexada ainda",
    ragMismatch: "Modelo de embedding mudou — reindexe",
    providersTitle: "Providers",
    providersCount: (n: number, total: number) =>
      `${n}/${total} configurados`,
    // Datas relativas (formatRelativeDate) — locale-aware (v0.1.103)
    relNow: "agora",
    dateLocale: "pt-BR",
    // Effort tátil (v0.1.122)
    effortHold: "segure e arraste",
    effortAdjusting: "ajustando…",
    // Card de modelo (v0.1.122)
    modelSeeMore: "Ver mais",
    modelFlipHint: "toque pra detalhes",
    // Card de modelo v2 (v0.1.130)
    modelExpand: "Expandir",
    modelCollapse: "Recolher",
    modelSpecs: "toque pra specs",
    modelFlipBack: "voltar",
    modelFetch: "Buscar specs",
    modelFetching: "buscando…",
    modelFetchNone: "Sem specs nessa fonte ainda",
    modelFetchErr: "Falha ao buscar specs",
    // StarterScreen v2 (v0.1.131)
    resume: "Retomar",
    providerAdd: "Adicionar",
    launcherHint: "Comece por aqui",
    todayLine: (chats: number, cost: string) =>
      `${chats} ${chats === 1 ? "conversa" : "conversas"} hoje · ${cost}`,
    starters: {
      chat: ["Resuma este texto…", "Explique de forma simples:", "Faça um roteiro pra…"],
      vaultQa: ["O que minhas notas dizem sobre…", "Conecte ideias entre…", "Resuma minhas notas de…"],
      agent: ["Crie uma nota sobre…", "Organize a pasta…", "Liste pendências em…"],
    },
    // Onboarding grátis + confiança (v0.1.138)
    freeStartTitle: "Comece grátis, sem cartão",
    freeStartSub:
      "Gemini free tier · modelos free do OpenRouter · Ollama local. Toque pra configurar.",
    trustLine: "Tudo fica no seu vault · sem telemetria · offline com Ollama",
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
    systemPrompt:
      "Você é o AXXA Agent, um assistente integrado ao Obsidian com acesso direto " +
      "ao vault do usuário via ferramentas (tools). Responda em português. " +
      "Pra ENCONTRAR notas sobre um tema ou pergunta, use vault_search PRIMEIRO " +
      "(busca semântica) em vez de listar pastas e ler arquivo por arquivo — é " +
      "muito mais eficiente. " +
      "Use as tools pra realizar a tarefa pedida — leia, crie, edite, mova ou delete " +
      "arquivos quando o user pedir. Pergunte ANTES se a intenção for ambígua. " +
      "Quando terminar, devolva uma resposta de texto resumindo o que fez. " +
      "Pra editar arquivos, SEMPRE use vault_read antes pra ver o conteúdo exato. " +
      "Se uma tool falhar, AJUSTE a estratégia (path errado? formato? permissão?) " +
      "antes de tentar de novo — nunca repita a MESMA call exata que acabou de falhar. " +
      "Quando precisar listar muitos arquivos, prefira tool calls em paralelo (mesmo turn).",
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
    diffApproval: "Aprovar mudanças (diff)",
    diffApprovalDesc:
      "Toda ação que ESCREVE no vault (editar/criar/mover/deletar) mostra um diff/preview pra você aprovar antes de gravar. Com 'Aprovar todas' você libera o resto da rodada. Recomendado deixar ligado.",
  },

  plus: {
    dialogLabel: "Opções da conversa",
    title: "Opções da conversa",
    addToChat: "Adicionar à conversa",
    attachCamera: "Câmera",
    attachPhotos: "Fotos",
    attachFiles: "Arquivo",
    attachNoteDesc: "Referenciar uma nota do vault",
    styleDesc: "Tom e formato das respostas",
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
    // Falha genérica do "Pensando..." (activity vira X). Curto.
    failed: "Falhou",
    interrupted: "Interrompido",
    // Mensagens localizadas por código — substituem o texto PT-only que vinha
    // cru dos providers, pra um user en-US ver inglês. v0.1.147
    err: {
      noKey: (provider: string) =>
        `Sem API key pra ${provider}. Adicione sua chave nas Configurações pra começar.`,
      invalidKey: (provider: string) =>
        `A API key de ${provider} parece inválida ou expirada. Confira nas Configurações.`,
      rateLimit: "Limite de requisições atingido. Aguarde alguns segundos e tente de novo.",
      network: "Falha de conexão. Confira sua internet e tente de novo.",
      // Billing do Gemini: a assinatura consumer (Google AI Pro/Ultra) NÃO cobre
      // a API — ela é cobrada à parte no AI Studio. v0.1.162
      billing:
        "O Gemini precisa de billing ativo na API pra esse modelo. Sua assinatura Google AI Pro/Ultra NÃO cobre a API — ela é cobrada à parte no AI Studio. Ative o billing (plano Prepay, mín. US$10) e tente de novo.",
    },
    // Ações da bolha de erro
    retry: "Tentar de novo",
    openSettings: "Abrir Configurações",
    openBilling: "Ativar billing no AI Studio",
    // Geração não suportada (auditoria v0.1.164) — tipo + resumo do que dá hoje.
    genUnsupported: (type: "image" | "audio" | "video", suportado: string) => {
      const tipo = type === "image" ? "imagem" : type === "audio" ? "áudio" : "vídeo";
      return `Geração de ${tipo} ainda não é suportada no AXXA com este provider/modelo. Hoje dá pra gerar: ${suportado}.`;
    },
  },

  // Modal de geração de imagem (fallback manual) — v0.1.166
  imageGen: {
    title: "Gerar imagem",
    editTitle: "Editar imagem",
    promptLabel: "Prompt",
    promptPlaceholder: "Descreva a imagem que você quer…",
    modelLabel: "Modelo",
    generate: "Gerar",
    cancel: "Cancelar",
    connected: "conectado",
    notConnected: "sem chave",
    noModels:
      "Nenhum modelo de imagem ativo. Ative um em Configurações → Providers (ex: gemini-2.5-flash-image, gpt-image-1).",
    free: "grátis",
    useAttached: "Editar a imagem anexada (IMG2IMG)",
    editOnlyNano: "edição só no Nano Banana",
    perImage: (usd: string) => `~${usd}/img`,
    menuLabel: "Criar imagem",
    menuDesc: "Gera uma imagem na conversa atual — sem trocar de modelo.",
  },

  // Planos (#8) + license key (#15) — v0.1.180
  plans: {
    title: "Planos",
    current: "atual",
    freeFeats: [
      "Chat com 6 providers (BYO key)",
      "Vault Q&A + RAG local com citações",
      "Agente com aprovação por diff",
      "Geração de imagem na conversa",
      "Personas, skills e modos",
    ],
    proFeats: [
      "Tudo do Free",
      "Mídia — galeria do vault",
      "Estatísticas avançadas",
      "Projetos (em breve)",
      "Suporte prioritário",
    ],
    licenseLabel: "License key",
    apply: "Aplicar",
    licenseHint: "Cole sua license pra desbloquear o Pro. (teste: AXXA-PRO-TEST-2026)",
    licenseValid: "✓ Chave válida — Pro ativo.",
    licenseInvalid: "✗ Formato inválido. Use AXXA-PRO-XXXX-XXXX.",
  },

  // Onboarding de 1º uso (#4) + discoverability (#7) — v0.1.178
  onboarding: {
    title: "Bem-vindo ao AXXA OS",
    sub: "Seu workspace de IA, nativo no Obsidian.",
    features: [
      { title: "6 providers, sua chave", desc: "OpenAI, Claude, Gemini, OpenRouter, NIM e Ollama — você traz a chave (BYO)." },
      { title: "Converse com seu vault", desc: "Vault Q&A com RAG local e citações clicáveis pras notas." },
      { title: "Um agente que age", desc: "Lê e edita suas notas, sempre com aprovação por diff." },
      { title: "Gera imagem no chat", desc: "Direto na conversa, sem trocar o modelo." },
      { title: "Tudo local-first", desc: "Conversas, personas e skills (.md) ficam no seu vault." },
    ],
    byoNote:
      "Sua API key é guardada no cofre do sistema. Tem Ollama? roda local, sem chave.",
    cta: "Adicionar minha primeira key",
    skip: "Pular por agora",
  },

  // Navegação lateral (v0.1.174)
  nav: {
    conversations: "Conversas",
    media: "Mídia",
    statistics: "Estatísticas",
    projects: "Projetos",
    profile: "Perfil",
    settings: "Configurações",
    more: "Ver mais",
    less: "Ver menos",
  },
  screens: {
    mediaEmptyTitle: "Sem mídia",
    mediaEmptySub: "Imagens, áudios e vídeos gerados ou anexados aparecem aqui.",
    mediaScopeAxxa: "Só AXXA",
    mediaScopeAll: "Todo o vault",
    statSpend: "Gasto",
    statChats: "Conversas",
    statTokens: "Tokens",
    statTopModels: "Top modelos",
    statEmptyTitle: "Sem dados ainda",
    statEmptySub: "Use o chat pra começar a gerar estatísticas.",
    statOpenUsage: "Ver detalhes em Configurações → Usage",
    profileAccount: "Conta",
    profilePlan: "Plano",
    profileSettings: "Configurações",
    profileProviders: "Providers conectados",
    profileChats: "Conversas",
    lockedTitle: "Recurso do plano Pro",
    lockedSub: "Essa tela faz parte do AXXA Pro. Faça upgrade pra desbloquear.",
    lockedCta: "Ver planos",
  },

  systemPrompt: {
    base:
      "Você é o AXXA Agent, um assistente integrado ao Obsidian. " +
      "Responda em português, de forma clara, direta e útil. " +
      "Quando fizer sentido, use Markdown.",
    vaultQaSuffix:
      "\n\nO usuário está no modo Vault Q&A — abaixo seguem notas relevantes " +
      "extraídas do vault dele. Use elas como fonte principal pra responder. " +
      "SEMPRE cite inline as notas que você usou, no formato [[Título]], usando " +
      "EXATAMENTE o título que aparece no cabeçalho ### de cada bloco (o que está " +
      "entre [[ ]]). Não invente notas que não estão abaixo. Se a resposta vier " +
      "de uma nota específica, cite-a logo após a frase.\n\nNotas:\n\n",
  },

  settings: {
    title: "AXXA OS — AI Agent",
    topTabs: {
      providers: "Providers",
      setup: "Setup & RAG",
      appearance: "Aparência",
      effort: "Effort",
      usage: "Usage",
      outros: "Outros",
    },
    setupIntro:
      "Pastas onde o AXXA salva tudo no vault + busca semântica (RAG) sobre suas notas.",
    setupFoldersTitle: "Pastas",
    setupRagTitle: "Vault Q&A / RAG",
    appearanceTabs: {
      background: "Fundo",
      chips: "Chips",
      ui: "Interface",
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
    openaiDataSharing: "Programa de data-sharing",
    openaiDataSharingDesc:
      "Compartilhar o tráfego da API com a OpenAI rende tokens grátis diários em modelos de TEXTO. Marque se você está inscrito.",
    openaiTier: "Usage tier",
    openaiTierDesc: "Seu tier na OpenAI (1–5). Define o volume de tokens grátis do data-sharing.",
    openaiFreeHint: (eligible: boolean, bigK: number, miniM: number) =>
      eligible
        ? `Tokens grátis/dia (data-sharing): ~${bigK}k em modelos grandes · ~${miniM}M em mini. ⚠️ Geração de IMAGEM não é coberta — é cobrada normal (~$0.04/img).`
        : "Ative o data-sharing (Tier 1+) pra ganhar tokens grátis diários em modelos de TEXTO. Geração de imagem nunca é coberta.",
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
    modelSetDefault: "Definir como modelo padrão",
    modelDefaultTag: "padrão",
    modelsFetchedWithEmbeds: (chat: number, emb: number) =>
      `${chat} modelos + ${emb} de embedding (RAG) encontrados.`,
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
    skillsPathDesc:
      "Pasta no Vault com as skills (.md). Cada skill vira um /comando no composer.",
    skillsManage: "Skills",
    skillsManageDesc: (n: number) =>
      `${n} skill${n === 1 ? "" : "s"} carregada${n === 1 ? "" : "s"}. Cada nota .md (com frontmatter name/description/icon/mode) vira /comando.`,
    skillsCreateExamples: "Criar exemplos",
    skillsReload: "Recarregar skills",
    skillsSeeded: (n: number) =>
      n > 0
        ? `${n} skill${n === 1 ? "" : "s"} de exemplo criada${n === 1 ? "" : "s"}`
        : "As skills de exemplo já existem",
    skillsReloaded: (n: number) =>
      `${n} skill${n === 1 ? "" : "s"} carregada${n === 1 ? "" : "s"}`,
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
    density: "Densidade da interface",
    densityDesc:
      "Escala o espaçamento de todo o app — listas, pílulas, segmentos e cantos. Compact espreme tudo; Large dá mais respiro.",
    densityLarge: "Large",
    densityNormal: "Normal",
    densityCompact: "Compact",
    motion: "Movimento",
    motionDesc:
      "A personalidade das animações do app — vale pra tudo que animamos daqui pra frente. Soft é discreto; Chaotic é mola pura.",
    motionSoft: "Soft",
    motionWave: "Wave",
    motionIntense: "Intense",
    motionChaotic: "Chaotic",
    reducedMotionMobile: "Reduzir movimento no mobile",
    reducedMotionMobileDesc:
      "No celular/tablet, desliga as animações de movimento (segura bateria e evita enjoo). Não afeta o desktop.",
    appearance: "Aparência",
    appearanceDesc:
      "Escolha um fundo pra interface do AXXA. Cores e gradientes (lineares + radiais).",
    backgroundLabels: {
      none: "Padrão",
      // Static
      dawn: "Amanhecer",
      ocean: "Oceano",
      forest: "Floresta",
      violet: "Violeta",
      rose: "Rosa",
      amber: "Âmbar",
      slate: "Ardósia",
      mono: "Mono",
      // Live
      aurora: "Aurora · live",
      nebula: "Nebula · live",
      pulse: "Pulse · live",
      flow: "Flow · live",
      tide: "Maré · live",
      ember: "Brasa · live",
      spectrum: "Espectro · live",
      lagoon: "Lagoa · live",
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
    ragEmbDim: "Dimensão",
    ragEmbImage: "Imagens",
    ragEmbYes: "Sim",
    ragEmbNo: "Não",
    ragEmbCost: "Custo",
    ragEmbCtx: "Contexto",
    ragEmbPerChunk: "Por trecho",
    ragEmbMobileNote:
      "Mais dimensão = mais preciso, porém índice maior. No mobile o índice é separado (gera e usa o do mobile) com teto de 16 MB — acima disso vira keyword. Dica: perfil Leve/Mínimo (int8 + dim reduzida) encolhe ~4–8×.",
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
    ragStatsFormat: (fmt: string) => `Formato no disco: ${fmt}`,
    ragFormatStreamed: "em pedaços (stream)",
    ragFormatSingle: "arquivo único",
    ragStatsFormatMismatch:
      "⚠️ O formato no disco é diferente do configurado. Reindexe pra aplicar.",
    ragProfileLabel: "Perfil do índice (quantização)",
    ragProfileRecommend: (count: number, name: string) =>
      `Seu vault: ${count} notas → recomendado: ${name}`,
    ragProfileNoDim:
      "Este modelo não suporta dim reduzida — usando dim cheia com int8.",
    ragStreamShardsLabel: "Índice em pedaços (stream)",
    ragStreamShardsDesc:
      "Salva o índice em vários pedaços e lê UM por vez na busca, em vez de carregar tudo na memória. Memória limitada (recomendado pra vaults grandes ou mobile); cada busca lê do disco — um tico mais lento. Precisa reindexar pra aplicar; nesse modo a reindexação é sempre do zero (sem incremental).",
    ragStreamShardsHint: (n: number) =>
      `Ativo: ~${n} trechos por pedaço. O índice não fica inteiro na RAM — a busca varre os pedaços e mantém só os melhores. Reindexe pra (re)gerar nesse formato.`,
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
    usageCostBilledLabel: "Cobrado (data-sharing)",
    // Painel data-sharing — cobra só o excedente da cota grátis. v0.1.168
    usageDsTitle: (tier: number) => `Data-sharing — Tier ${tier}`,
    usageDsGross: (v: string) => `Bruto: ${v}`,
    usageDsBilled: (v: string) => `Cobrado: ${v}`,
    usageDsSaved: (v: string) => `Economia: ${v}`,
    usageDsBig: "Modelos grandes — hoje",
    usageDsMini: "Mini/nano — hoje",
    usageDsNote:
      "Estimativa. A cota grátis é diária (reseta à meia-noite) e por pool. ⚠️ Ela é compartilhada com TODO o seu uso da OpenAI API — o plugin só enxerga os chats do vault, então o 'grátis restante' é otimista se você usa a API em outro lugar. Imagem nunca entra na cota.",
    // Cross-check de billing real (v0.1.169)
    usageBillingTitle: "Billing real (cross-check)",
    usageBillingCross: "Cruzar com a API",
    usageBillingCrossing: "Cruzando…",
    usageBillingEstimate: "Estimado",
    usageBillingReal: "Real",
    usageBillingStatusCol: "Status",
    usageBillingLeft: "restante",
    usageBillingNoLive:
      "Pra cruzar billing real: chave do OpenRouter (normal) e/ou uma Admin key da OpenAI no campo de API key.",
    usageBillingOrgNote:
      "Custo REAL da organização inteira (todo o uso da OpenAI), não só do plugin.",
    // Badge de formato da key (campo único reconhece projeto vs admin). v0.1.170
    keyKindNormal:
      "🔑 Chave de projeto — chat e geração OK. Custos reais precisam de uma Admin key.",
    keyKindAdmin:
      "🛡️ Admin key — custos reais ON no Usage. ⚠️ Admin key NÃO faz chat; use uma chave de projeto pra conversar.",
    keyKindUnknown: "⚠️ Formato de chave não reconhecido — confira se colou certo.",
    keyAdminReady: "Admin key detectada — clique “Cruzar com a API”.",
    keyAdminSoon: "Admin key detectada — custos reais da Anthropic em breve.",
    keyAdminAntExp:
      "Admin key detectada — Anthropic é EXPERIMENTAL (shape do cost_report não verificado). Clique “Cruzar”.",
    balanceRealExp: "real (exp)",
    adminKeyName: "Admin key (opcional)",
    adminKeyDesc:
      "Só pra custos/saldo reais (Admin API). NÃO faz chat — a chave de projeto fica no campo acima.",
    planOverrideName: "Plano (teste de admin)",
    planOverrideDesc:
      "Simula o plano pra testar as telas pagas. 'Auto' usa o plano real da conta; 'Free'/'Pro' forçam o comportamento. Não muda seu plano de verdade.",
    planAuto: "Auto (plano real)",
    openaiProjectName: "Project ID (opcional)",
    openaiProjectDesc:
      "Atribui o custo real só a este projeto. Crie um projeto dedicado pro AXXA no painel da OpenAI e use uma chave desse projeto — aí o saldo/custo reflete só o plugin, não a org inteira.",
    usageBillingProjNote: "Custo REAL só deste projeto da OpenAI (atribuição).",
    anthropicWorkspaceName: "Workspace ID (opcional)",
    anthropicWorkspaceDesc:
      "Atribui o custo real só a este workspace. Crie um workspace dedicado pro AXXA no Console da Anthropic e use uma chave dele — o custo reflete só o plugin.",
    // Saldo por provider (âncora). v0.1.171
    balanceTitle: "Saldo",
    balanceRefresh: "Atualizar saldo",
    balanceSetAnchor: "defina a âncora →",
    balanceEstimate: "estimado",
    balanceReal: "real",
    balanceLiveHint: "saldo real direto da API (clique Atualizar)",
    balanceNote:
      "Saldo = âncora − gasto desde a data. “real” usa o billing do provider (OpenAI/Anthropic admin · OpenRouter nativo); senão é “estimado” pelos chats do vault. Crédito é separado por provider.",
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
