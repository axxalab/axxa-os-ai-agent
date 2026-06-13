// src/skills/skills.ts
// Skills compartilháveis (v0.1.139) — aposta #4.
//
// Um SKILL é só uma NOTA markdown na pasta de skills (settings.skillsPath):
//   - frontmatter: name, description, icon?, mode?
//   - corpo: o prompt/template que vai pro composer quando o skill é acionado.
// Acionável via slash-command no composer (/<nome>). Como é .md, qualquer um
// edita no próprio Obsidian e compartilha (é uma nota). Esse é o efeito de rede.

import { type App, parseYaml, normalizePath } from "obsidian";

export interface Skill {
  id: string;
  name: string;
  description: string;
  /** Ícone Lucide (default: sparkles). */
  icon: string;
  /** Modo preferido (chat / vault-qa / agent) — trocado ao acionar, se houver. */
  mode?: string;
  /** Corpo da nota = prompt/template injetado no composer. */
  body: string;
  path: string;
}

/** Parseia uma nota .md → Skill (frontmatter + corpo). null se não tiver corpo. */
function parseSkillFile(path: string, raw: string): Skill | null {
  let fm: Record<string, unknown> = {};
  let body = raw;
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (m) {
    try {
      fm = (parseYaml(m[1]) as Record<string, unknown>) ?? {};
    } catch {
      fm = {};
    }
    body = m[2];
  }
  body = body.trim();
  if (!body) return null;
  const base = (path.replace(/\.md$/i, "").split("/").pop() ?? path).trim();
  const name = String(fm.name ?? base);
  return {
    id: "skill-" + base.toLowerCase().replace(/[^\w-]+/g, "-"),
    name,
    description: String(fm.description ?? ""),
    icon: String(fm.icon ?? "sparkles"),
    mode: fm.mode ? String(fm.mode) : undefined,
    body,
    path,
  };
}

/** Lê todos os skills (.md) da pasta. Ordena por nome. */
export async function loadSkills(
  app: App,
  folderPath: string
): Promise<Skill[]> {
  const folder = normalizePath(folderPath || "axxa-ai/skills");
  const prefix = folder.endsWith("/") ? folder : folder + "/";
  const files = app.vault
    .getMarkdownFiles()
    .filter((f) => f.path.startsWith(prefix));
  const skills: Skill[] = [];
  // v0.1.228: dois arquivos cujo basename só difere por caractere não-\w geram
  // o mesmo id (ex: "Plano!" e "Plano?"). Desambigua com sufixo numérico pra o
  // id continuar único (o path já é, mas o id é usado como chave estável).
  const seenIds = new Set<string>();
  for (const f of files) {
    try {
      const raw = await app.vault.cachedRead(f);
      const s = parseSkillFile(f.path, raw);
      if (!s) continue;
      if (seenIds.has(s.id)) {
        let n = 2;
        while (seenIds.has(`${s.id}-${n}`)) n++;
        s.id = `${s.id}-${n}`;
      }
      seenIds.add(s.id);
      skills.push(s);
    } catch {
      /* nota ilegível — skip */
    }
  }
  skills.sort((a, b) => a.name.localeCompare(b.name));
  return skills;
}

// 3 skills de exemplo que mostram o poder do plugin (citação + vault + ação).
const EXAMPLE_SKILLS: { file: string; content: string }[] = [
  {
    file: "Resumo TL;DR.md",
    content: `---
name: Resumo TL;DR
description: Resume o conteúdo em 3 bullets + 1 ação
icon: list
mode: chat
---
Resuma o conteúdo abaixo em **3 bullets curtos** e termine com **uma ação** sugerida. Seja direto.

`,
  },
  {
    file: "Literature note.md",
    content: `---
name: Literature note
description: Vira um material em nota de literatura (Zettelkasten)
icon: book-open
mode: chat
---
Crie uma *literature note* a partir do material abaixo:
- Resumo em 1 parágrafo.
- 3 a 5 pontos-chave em bullets.
- Uma seção **Conexões** sugerindo possíveis [[links]] pro meu vault.

`,
  },
  {
    file: "Construir MOC.md",
    content: `---
name: Construir MOC
description: Gera um Map of Content sobre um tema usando suas notas
icon: network
mode: vault-qa
---
Monte um **Map of Content (MOC)** sobre o tema abaixo usando as minhas notas.
Liste as notas relevantes como [[links]] agrupadas por subtema, cite as fontes, e sugira 2-3 notas que faltam criar.

Tema: `,
  },
];

/** Cria a pasta + escreve os skills de exemplo que ainda não existem.
 *  Retorna quantos foram criados. */
export async function seedExampleSkills(
  app: App,
  folderPath: string
): Promise<number> {
  const folder = normalizePath(folderPath || "axxa-ai/skills");
  if (!(await app.vault.adapter.exists(folder))) {
    await app.vault.adapter.mkdir(folder);
  }
  let created = 0;
  for (const ex of EXAMPLE_SKILLS) {
    const p = normalizePath(`${folder}/${ex.file}`);
    // v0.1.228: checa e cria na MESMA camada (vault), e isola cada create num
    // try/catch — assim um arquivo que já existe no disco (mas fora do índice)
    // não dispara desync nem aborta a criação dos demais exemplos.
    if (app.vault.getAbstractFileByPath(p)) continue;
    try {
      await app.vault.create(p, ex.content);
      created++;
    } catch {
      /* já existe / corrida com o índice — ignora e segue */
    }
  }
  return created;
}
