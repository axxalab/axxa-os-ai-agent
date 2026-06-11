// tests/obsidian-stub.ts
// Stub mínimo da API do Obsidian pros testes (aliasado via vitest.config.ts).
// Só precisa cobrir o que os módulos sob teste tocam no carregamento/execução.
// Expanda conforme novos testes exercitarem mais da API.

export function normalizePath(path: string): string {
  // Versão simplificada: colapsa barras e tira a inicial/ final, como o real.
  return path.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/|\/$/g, "");
}

export function parseYaml(_input: string): unknown {
  // Os testes que dependem de YAML real devem injetar o próprio parser ou
  // testar a camada acima. Aqui devolvemos objeto vazio só pra não quebrar.
  return {};
}

export class Notice {
  constructor(public message?: string) {}
  setMessage() {}
  hide() {}
}

// requestUrl: por padrão falha (nenhum teste deve bater na rede de verdade).
// Testes que exercitam providers via requestUrl (NIM) injetam uma impl com
// __setRequestUrl — como o provider importa ESTA função e ela lê __impl em
// tempo de chamada, o override funciona sem precisar de vi.mock + alias.
let __requestUrlImpl: ((opts: unknown) => Promise<unknown>) | null = null;
export function __setRequestUrl(
  fn: ((opts: unknown) => Promise<unknown>) | null
): void {
  __requestUrlImpl = fn;
}
export async function requestUrl(opts: unknown): Promise<unknown> {
  if (__requestUrlImpl) return __requestUrlImpl(opts);
  throw new Error("requestUrl não mockado — use __setRequestUrl no teste.");
}

// Classes/funcs comuns como no-ops, pra imports não quebrarem o load.
export class Plugin {}
export class PluginSettingTab {}
export class ItemView {}
export class Modal {}
export class Setting {}
export class TFile {}
export class TFolder {}
export class Component {}
export const MarkdownRenderer = { render: async () => {} };
export function setIcon(): void {}
