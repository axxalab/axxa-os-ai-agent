import { describe, it, expect } from "vitest";
import {
  MODULES,
  MODULE_LIST,
  chatsOfModule,
  moduleHint,
  moduleIcon,
  moduleEmptyLine,
  moduleLabel,
  modulePlaceholder,
  modulesInUse,
  moduleStats,
  relativeDay,
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
