// src/i18n/pt-br.ts
// Strings do plugin em português brasileiro.
// É o "source of truth" do dicionário — o tipo `Translations` é inferido daqui.
// en-us.ts e qualquer outro locale precisam espelhar a mesma estrutura
// (TypeScript valida em build).

export const PT_BR = {
  composer: {
    placeholderChat: "Pergunte ao AXXA Agent...",
    placeholderVaultQa: "Pergunte sobre seu Vault...",
    placeholderAgent: "Peça pro Agent organizar seu vault...",
    placeholderCoder: "Cole código ou pergunte como debugar...",
    sendLabel: "Enviar mensagem",
    stopLabel: "Parar geração",
    micLabel: "Gravar áudio",
    plusLabel: "Mais opções",
  },

  menu: {
    copy: "Copiar",
    regenerate: "Regenerar",
    delete: "Deletar",
  },

  header: {
    newChat: "Nova conversa",
    openSettings: "Configurações",
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
  },

  modes: {
    chat: "Chat",
    chatDesc: "Conversa direta",
    vaultQa: "Vault Q&A",
    vaultQaDesc: "Busca notas como contexto",
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
    tabs: {
      openai: "OpenAI",
      anthropic: "Anthropic",
      openrouter: "OpenRouter",
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
    apiKeyDescOpenrouter: "sk-or-... — armazenada localmente.",
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
    openrouterIntro:
      "Proxy multi-modelo. Modelos prefixados por provider (ex: anthropic/claude-3.5-sonnet).",
    ollamaIntro:
      "LLMs locais. Precisa do servidor Ollama rodando (https://ollama.com).",
    ollamaEndpoint: "Endpoint",
    ollamaEndpointDesc:
      "URL do servidor Ollama (default: http://localhost:11434)",
    outrosIntro: "Configurações gerais — paths, idioma, aparência.",
    language: "Idioma",
    languageDesc:
      "Linguagem do plugin. A interface atualiza na hora.",
    languagePtBr: "Português (Brasil)",
    languageEnUs: "English (US)",
    chatsPath: "Pasta dos chats",
    chatsPathDesc: "Onde os chats serão salvos no Vault",
    skillsPath: "Pasta das skills",
    skillsPathDesc: "Onde as skills serão salvas no Vault (vem no Módulo 7)",
    comingSoon: "Em breve",
    comingSoonItems: [
      "Appearance (background, balloon) — Módulo 3",
      "Agent Mode (file ops) — Módulo 6",
      "Skills management — Módulo 7",
      "MCP Connect (Notion, ClickUp, Figma) — Módulo 9",
    ] as string[],
  },
};

// O type infere a estrutura completa do PT_BR (sem `as const` pra que
// strings fiquem como `string` em vez de literais — assim en-us.ts pode
// ter textos diferentes mantendo o mesmo shape).
export type Translations = typeof PT_BR;
