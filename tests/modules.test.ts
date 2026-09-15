import { describe, it, expect } from "vitest";
import {
  MODULES,
  MODULE_LIST,
  chatsOfModule,
  moduleHint,
  moduleIcon,
  moduleEmptyLine,
  moduleFabLabel,
  moduleLabel,
  modulePlaceholder,
  modulesInUse,
  moduleStats,
  relativeDay,
  relativeShort,
  searchChats,
} from "../src/ui/modules";
import { CHAT_MODES } from "../src/core/session";
import type { ChatSummary } from "../src/core/chatPersistence";

const chat = (over: Partial<ChatSummary>): ChatSummary =>
  ({
    id: "x",
    title: "t",
    date: "2026-09-10T10:00:00.000Z",
    mode: "chat",
    provider: "openai",
    model: "gpt-5",
    effort: "medium",
    tokensIn: 0,
    tokensOut: 0,
    messageCount: 2,
    toolCount: 0,
    filePath: "axxa-ai/chats/chat/x.md",
    starred: false,
    ...over,
  }) as ChatSummary;

describe("MODULES", () => {
  it("descreve TODOS os modos do motor — nenhum fica sem nome", () => {
    // Se alguém criar um quarto modo em session.ts e esquecer daqui, a gaveta
    // mostraria o id cru pro usuário. Este teste é o alarme.
    for (const m of CHAT_MODES) {
      expect(MODULES[m]).toBeTruthy();
      expect(MODULES[m].label.length).toBeGreaterThan(0);
      expect(MODULES[m].icon.length).toBeGreaterThan(0);
      expect(MODULES[m].placeholder.length).toBeGreaterThan(0);
      expect(MODULES[m].emptyLine.length).toBeGreaterThan(0);
    }
    expect(MODULE_LIST.map((m) => m.id)).toEqual(CHAT_MODES);
  });

  it("nunca devolve o id cru pra um modo conhecido", () => {
    expect(moduleLabel("vault-qa")).toBe("Vault Q&A");
    expect(moduleLabel("agent")).toBe("Agent");
  });

  it("modo desconhecido mostra o próprio id em vez de sumir", () => {
    // Conversa gravada por uma versão futura, ou pasta criada na mão.
    expect(moduleLabel("pesquisa")).toBe("pesquisa");
    expect(moduleIcon("pesquisa")).toBe("message-square");
    expect(modulePlaceholder("pesquisa")).toBe(MODULES.chat.placeholder);
  });

  it("a home vazia de cada módulo convida com as palavras dele", () => {
    // Uma frase genérica em três lugares diferentes faria as três homes
    // parecerem a mesma tela sem conteúdo.
    const frases = CHAT_MODES.map((m) => MODULES[m].emptyLine);
    expect(new Set(frases).size).toBe(CHAT_MODES.length);
    expect(moduleEmptyLine("agent")).toBe(MODULES.agent.emptyLine);
  });

  it("módulo estranho explica por que não dá pra criar nada nele", () => {
    const frase = moduleEmptyLine("research");
    expect(frase).not.toBe(MODULES.chat.emptyLine);
    expect(frase).toMatch(/can't start new ones/i);
  });

  it("modulesInUse põe no menu o módulo que só existe no disco", () => {
    // Sem isto, a conversa gravada num modo que esta versão não conhece
    // ficaria invisível: nenhuma porta levaria até ela.
    const vistos = modulesInUse([
      chat({ mode: "chat" }),
      chat({ mode: "research" }),
      chat({ mode: "research" }),
    ]).map((m) => m.id);
    expect(vistos).toEqual([...CHAT_MODES, "research"]);
  });

  it("sem conversa estranha, o menu é só o que o motor conhece", () => {
    expect(modulesInUse([chat({ mode: "agent" })]).map((m) => m.id)).toEqual([
      ...CHAT_MODES,
    ]);
    expect(modulesInUse([]).map((m) => m.id)).toEqual([...CHAT_MODES]);
  });

  it("vazio e nulo caem no Chat, não em string vazia", () => {
    expect(moduleLabel("")).toBe("Chat");
    expect(moduleLabel(undefined)).toBe("Chat");
    expect(moduleLabel(null)).toBe("Chat");
  });
});

describe("chatsOfModule", () => {
  const todas = [
    chat({ id: "a", mode: "chat" }),
    chat({ id: "b", mode: "agent" }),
    chat({ id: "c", mode: "vault-qa" }),
    chat({ id: "d", mode: "agent" }),
  ];

  it("separa por módulo preservando a ordem recebida", () => {
    expect(chatsOfModule(todas, "agent").map((c) => c.id)).toEqual(["b", "d"]);
    expect(chatsOfModule(todas, "chat").map((c) => c.id)).toEqual(["a"]);
  });

  it("módulo sem conversa devolve lista vazia, não undefined", () => {
    expect(chatsOfModule(todas, "pesquisa")).toEqual([]);
    expect(chatsOfModule([], "chat")).toEqual([]);
  });
});

describe("moduleStats", () => {
  it("conta e acha a mais recente MESMO fora de ordem", () => {
    // A gaveta recebe a lista já ordenada, mas depender disso seria uma
    // segunda verdade sobre "mais recente".
    const st = moduleStats(
      [
        chat({ mode: "agent", date: "2026-09-01T00:00:00.000Z" }),
        chat({ mode: "agent", date: "2026-09-09T00:00:00.000Z" }),
        chat({ mode: "agent", date: "2026-09-05T00:00:00.000Z" }),
        chat({ mode: "chat", date: "2026-09-30T00:00:00.000Z" }),
      ],
      "agent"
    );
    expect(st.count).toBe(3);
    expect(st.last).toBe("2026-09-09T00:00:00.000Z");
  });

  it("sem conversa não inventa data", () => {
    expect(moduleStats([], "chat")).toEqual({ count: 0 });
  });
});

describe("relativeDay", () => {
  // Dia de CALENDÁRIO LOCAL é o que a função compara — e é o que a pessoa
  // percebe. Então o teste também fala em hora local: escrever "…T09:00Z" aqui
  // faz o resultado depender do fuso de quem roda o teste (foi exatamente
  // assim que este arquivo falhou da primeira vez, em UTC-3).
  const local = (a: number, m: number, d: number, h = 10, min = 0) =>
    new Date(a, m - 1, d, h, min).toISOString();
  const emPonto = (a: number, m: number, d: number, h = 10, min = 0) =>
    new Date(a, m - 1, d, h, min).getTime();
  const agora = emPonto(2026, 9, 15, 9);

  it("hoje, ontem e os dias da semana", () => {
    expect(relativeDay(local(2026, 9, 15, 1), agora)).toBe("Today");
    expect(relativeDay(local(2026, 9, 14, 23, 50), agora)).toBe("Yesterday");
    expect(relativeDay(local(2026, 9, 12), agora)).toBe("3 days ago");
  });

  it("conta DIA de calendário, não 24 horas corridas", () => {
    // 23:50 de ontem tem menos de 24h, mas é ontem — dizer "Today" ali é o
    // tipo de erro que faz a lista parecer mentirosa.
    const meiaNoiteEMeia = emPonto(2026, 9, 15, 0, 30);
    expect(relativeDay(local(2026, 9, 14, 23, 50), meiaNoiteEMeia)).toBe(
      "Yesterday"
    );
  });

  it("a partir de uma semana mostra a data", () => {
    expect(relativeDay(local(2026, 9, 8), agora)).toBe(
      local(2026, 9, 8).slice(0, 10)
    );
  });

  it("data futura não vira 'há -2 dias'", () => {
    expect(relativeDay(local(2026, 9, 20), agora)).toBe("Today");
  });

  it("data quebrada devolve vazio em vez de 'Invalid Date'", () => {
    expect(relativeDay("nem data é", agora)).toBe("");
  });
});

describe("searchChats", () => {
  const lista = [
    chat({ id: "a", title: "Rewrite the plugin README", model: "gpt-5" }),
    chat({ id: "b", title: "Draft the changelog", model: "claude-sonnet-4-6" }),
    chat({ id: "c", title: "Clean up the inbox", model: "gemini-2.5-flash" }),
    chat({ id: "d", title: "", model: "gpt-4o" }),
  ];
  const ids = (q: string) => searchChats(lista, q).hits.map((c) => c.id);

  it("expressão vazia devolve tudo, sem se dizer regex", () => {
    const r = searchChats(lista, "   ");
    expect(r.hits).toHaveLength(4);
    expect(r.regex).toBe(false);
    expect(r.invalida).toBe(false);
  });

  it("palavra comum funciona como sempre — ela também é regex válida", () => {
    expect(ids("readme")).toEqual(["a"]);
    expect(ids("INBOX")).toEqual(["c"]);
  });

  it("regex de verdade: âncora, alternativa e classe", () => {
    expect(ids("^Draft")).toEqual(["b"]);
    expect(ids("readme|inbox")).toEqual(["a", "c"]);
    expect(ids("chang[e]log")).toEqual(["b"]);
  });

  it("procura também no MODELO — é o que está escrito no cartão", () => {
    expect(ids("gemini")).toEqual(["c"]);
    expect(ids("^gpt-5$")).toEqual([]);
    expect(ids("gpt-")).toEqual(["a", "d"]);
  });

  it("conversa sem título é achável pelo 'Untitled' que a lista mostra", () => {
    expect(ids("untitled")).toEqual(["d"]);
  });

  it("expressão quebrada NÃO zera a lista: cai em literal e avisa", () => {
    // Acontece o tempo todo enquanto se digita — cada `(` solto passa por
    // aqui. Um campo que apaga tudo no meio da digitação parece defeito.
    const r = searchChats(lista, "Draft (");
    expect(r.invalida).toBe(true);
    expect(r.regex).toBe(false);
    expect(r.hits).toEqual([]);
    const r2 = searchChats(lista, "README (");
    expect(r2.invalida).toBe(true);
    expect(r2.hits).toEqual([]);
  });

  it("literal casa o texto cru quando a regex não compila", () => {
    const comParenteses = [chat({ id: "z", title: "Fix the (weird) title" })];
    const r = searchChats(comParenteses, "(weird");
    expect(r.invalida).toBe(true);
    expect(r.hits.map((c) => c.id)).toEqual(["z"]);
  });
});

describe("relativeShort", () => {
  const agora = new Date(2026, 8, 15, 12, 0).getTime();
  const atras = (ms: number) => new Date(agora - ms).toISOString();

  it("minutos, horas e dias — a coluna da direita do cartão", () => {
    expect(relativeShort(atras(53 * 60000), agora)).toBe("53m");
    expect(relativeShort(atras(10 * 3600000), agora)).toBe("10h");
    expect(relativeShort(atras(3 * 86400000), agora)).toBe("3d");
  });

  it("acabou de acontecer não é '0m'", () => {
    expect(relativeShort(atras(5000), agora)).toBe("now");
  });

  it("as fronteiras não pulam uma unidade", () => {
    expect(relativeShort(atras(59 * 60000), agora)).toBe("59m");
    expect(relativeShort(atras(60 * 60000), agora)).toBe("1h");
    expect(relativeShort(atras(23 * 3600000), agora)).toBe("23h");
    expect(relativeShort(atras(24 * 3600000), agora)).toBe("1d");
  });

  it("passou de um mês vira data — '47d' não diz nada a ninguém", () => {
    const velho = atras(60 * 86400000);
    expect(relativeShort(velho, agora)).toBe(velho.slice(0, 10));
  });

  it("data no futuro (relógio do aparelho atrasado) não vira negativo", () => {
    expect(relativeShort(atras(-90 * 60000), agora)).toBe("now");
  });

  it("data quebrada devolve vazio", () => {
    expect(relativeShort("nem data é", agora)).toBe("");
  });
});

describe("moduleFabLabel", () => {
  it("o Agent roda SESSÃO, os outros abrem conversa", () => {
    expect(moduleFabLabel("agent")).toBe("New session");
    expect(moduleFabLabel("chat")).toBe("New chat");
    expect(moduleFabLabel("vault-qa")).toBe("New question");
  });
});

describe("moduleHint", () => {
  const local = (a: number, m: number, d: number, h = 10) =>
    new Date(a, m - 1, d, h).toISOString();
  const agora = new Date(2026, 8, 15, 9).getTime();

  it("singular e plural", () => {
    expect(moduleHint({ count: 1, last: local(2026, 9, 15, 8) }, agora)).toBe(
      "1 chat · Today"
    );
    expect(moduleHint({ count: 4, last: local(2026, 9, 14, 8) }, agora)).toBe(
      "4 chats · Yesterday"
    );
  });

  it("módulo vazio convida em vez de mostrar zero", () => {
    expect(moduleHint({ count: 0 }, agora)).toBe("No chats yet");
  });

  it("sem data utilizável mostra só a contagem", () => {
    expect(moduleHint({ count: 2, last: "quebrado" }, agora)).toBe("2 chats");
  });
});
