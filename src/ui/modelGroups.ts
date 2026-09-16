// src/ui/modelGroups.ts
// Como a folha de modelos se organiza quando a lista fica grande.
//
// Com o catálogo do provider puxado, a folha vira um rolo de vinte linhas em
// que seis dizem a mesma frase e no meio delas moram coisas que NÃO conversam
// — geradores de imagem, vozes de TTS, modelos de embedding. Escolher ali é
// procurar.
//
// Os cards do motor já sabem o que cada modelo é (`category`), então o
// agrupamento não inventa nada: só usa o que já estava gravado e põe junto o
// que é da mesma natureza. A ordem é a da utilidade pra uma CONVERSA, que é o
// que esta folha escolhe.

import { getModelCard } from "../providers/modelDescriptions";

export interface ModelGroup {
  /** Rótulo do grupo. Vazio no primeiro: ele não precisa se apresentar. */
  label: string;
  models: string[];
}

/** Ordem dos grupos e o nome de cada um. */
const ORDEM: Array<{ id: string; label: string; cats: string[] }> = [
  { id: "chat", label: "Chat", cats: ["chat-vision", "chat-text", "agent"] },
  { id: "reasoning", label: "Reasoning", cats: ["reasoning"] },
  { id: "image", label: "Image", cats: ["image-gen"] },
  { id: "voice", label: "Voice", cats: ["audio-gen"] },
  { id: "video", label: "Video", cats: ["video-gen"] },
  { id: "outros", label: "Other", cats: ["embedding", "other"] },
];

/**
 * Separa os modelos por natureza, preservando a ordem recebida dentro de cada
 * grupo (é a ordem que a pessoa montou em Settings).
 *
 * Grupos vazios não aparecem. TODO grupo tem nome: eles viram abas, e aba sem
 * nome não existe. Quando sobra um grupo só, quem some é a barra de abas —
 * decisão da tela, não daqui.
 */
export function groupModels(
  provider: string,
  models: readonly string[]
): ModelGroup[] {
  const porId = new Map<string, string[]>();
  for (const m of models) {
    const cat = getModelCard(provider, m).category;
    const alvo =
      ORDEM.find((g) => g.cats.includes(cat))?.id ?? "outros";
    const atual = porId.get(alvo);
    if (atual) atual.push(m);
    else porId.set(alvo, [m]);
  }
  return ORDEM.filter((g) => porId.get(g.id)?.length).map((g) => ({
    label: g.label,
    models: porId.get(g.id) as string[],
  }));
}

/**
 * Filtra pelo que a pessoa digitou. Casa com o ID e com o nome bonito, porque
 * é o nome bonito que está na tela ("GPT 5.4") e o id que ela talvez conheça
 * ("gpt-5.4"). Busca literal, não regex: aqui se procura UM modelo pelo nome,
 * não um padrão.
 */
export function filterModels(
  models: readonly string[],
  query: string,
  pretty: (m: string) => string
): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...models];
  return models.filter(
    (m) =>
      m.toLowerCase().includes(q) || pretty(m).toLowerCase().includes(q)
  );
}
