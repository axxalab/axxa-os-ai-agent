# AXXA OS — AI Agent
## Instruções para AI Coding Agents

### Contexto
Plugin para Obsidian construído por um designer UX aprendendo TypeScript.
Stack: TypeScript + React 18 + Obsidian Plugin API + Zustand + esbuild.

### Regras de ouro
1. Output de build SEMPRE em `/output` (nunca na raiz)
2. Nunca usar `localStorage`, `sessionStorage` ou `eval()`
3. CSS variables do Obsidian SEMPRE — `var(--background-primary)`, `var(--text-normal)` etc.
4. Fetch nativo — sem `axios`
5. Mobile first em TUDO — sidebar direita, drawer no mobile
6. Comentários em PT-BR
7. Explicar decisões técnicas em linguagem de design (analogias visuais) quando possível

### Como testar
- `npm run dev` → watch mode, rebuild automático em `/output`
- `npm run deploy:output` → copia `/output` para o vault configurado em `.axxa.local.json`
- Reativar plugin no Obsidian (Settings → Community Plugins → toggle off/on)

### Módulo atual
Consultar [`ACTION-PLAN.md`](./ACTION-PLAN.md) para ver o módulo em andamento e os itens pendentes.

### Documentos do projeto
- [`README.md`](./README.md) — estrutura técnica completa
- [`MASTER-PLAN.md`](./MASTER-PLAN.md) — visão de produto e negócio
- [`PROMPT-MESTRE.md`](./PROMPT-MESTRE.md) — prompt do engenheiro principal
- [`VIABILIDADE-FINANCEIRA.md`](./VIABILIDADE-FINANCEIRA.md) — análise financeira
