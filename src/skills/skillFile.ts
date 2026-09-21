// src/skills/skillFile.ts
// Escrever um skill — a ponte entre o formulário e o arquivo .md.
//
// Um skill É uma nota (ver skills.ts): frontmatter + corpo. Isso é ótimo pra
// quem já está no Obsidian com o teclado na mão, e péssimo pra quem está no
// telefone: até 0.6.48, criar um skill pedia o nome e jogava a pessoa DENTRO
// do editor, com um bloco de YAML pra preencher no escuro. Quem não sabia o
// que era `mode:` saía com um arquivo pela metade — e um arquivo pela metade
// não vira skill nenhum (sem corpo, o parser descarta e ele some da lista).
//
// Aqui o formulário vira arquivo. O YAML é NOSSO problema, não do usuário.

/** O que o formulário coleta. Vira frontmatter + corpo. */
export interface SkillDraft {
  name: string;
  description: string;
  icon: string;
  /** Modo preferido; "" = usa o que estiver aberto. */
  mode: string;
  /** O prompt. É o que o skill É — sem ele não existe skill. */
  body: string;
}

export const SKILL_DRAFT_VAZIO: SkillDraft = {
  name: "",
  description: "",
  icon: "sparkles",
  mode: "",
  body: "",
};

/** A grade do seletor de ícone. Lucide, os mesmos que o Obsidian carrega. */
export const SKILL_ICONS: string[] = [
  "sparkles", "list", "book-open", "network", "pencil", "quote",
  "languages", "scissors", "wand", "calendar", "check-check", "brain",
  "code", "table", "mail", "megaphone", "lightbulb", "graduation-cap",
  "search", "map", "flask-conical", "target",
];

/** Caracteres que o Obsidian não aceita em nome de arquivo. */
const PROIBIDOS = /[\\/:*?"<>|#^[\]]/g;

/**
 * O nome do arquivo a partir do nome do skill.
 *
 * O nome é do USUÁRIO, o arquivo é nosso: ele digita "Resumo: TL;DR" e nós
 * damos um jeito no `:` — em vez de recusar e mandar digitar de novo.
 */
export function skillFileName(nome: string): string {
  const limpo = nome
    .replace(PROIBIDOS, "-")
    // Ponto no fim some no Windows; espaço duplo vira um.
    .replace(/\s+/g, " ")
    .replace(/^[.\s]+|[.\s]+$/g, "")
    .trim();
  // Nome só de pontuação vira um arquivo de traços ("///" → "---.md"): tem
  // nome, não tem palavra, e some no meio da pasta. Melhor o nome genérico,
  // que pelo menos se lê.
  if (!/[\p{L}\p{N}]/u.test(limpo)) return "Skill.md";
  return limpo + ".md";
}

/** Uma string YAML sempre entre aspas — nome com `:` quebraria o bloco. */
function yaml(v: string): string {
  return '"' + v.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
}

/** O .md completo: frontmatter + o prompt. */
export function skillMarkdown(d: SkillDraft): string {
  const linhas = [
    "---",
    `name: ${yaml(d.name.trim())}`,
    `description: ${yaml(d.description.trim())}`,
    `icon: ${yaml(d.icon || "sparkles")}`,
  ];
  // Modo vazio não vira linha: `mode: ""` faria o acionamento tentar trocar
  // pra um modo que não existe.
  if (d.mode) linhas.push(`mode: ${yaml(d.mode)}`);
  linhas.push("---", "", d.body.trim(), "");
  return linhas.join("\n");
}

/**
 * O que ainda falta pra poder salvar — ou null quando está pronto.
 *
 * Devolve a frase que a tela mostra. Duas regras, e as duas existem porque o
 * arquivo não perdoa: sem nome não há arquivo, e sem corpo o parser descarta
 * a nota (o skill seria criado e sumiria da lista no mesmo segundo).
 */
export function skillProblema(
  d: SkillDraft,
  /** Os caminhos que já existem na pasta — pra não pisar num skill existente. */
  existentes: readonly string[],
  /** Caminho do skill sendo editado (ele não conflita consigo mesmo). */
  atual?: string
): string | null {
  if (!d.name.trim()) return "Give it a name.";
  if (!d.body.trim()) return "Write the prompt — that is what the skill is.";
  const alvo = skillFileName(d.name);
  const colide = existentes.some(
    (p) => p !== atual && (p.split("/").pop() ?? p).toLowerCase() === alvo.toLowerCase()
  );
  if (colide) return "There is already a skill with that name.";
  return null;
}
