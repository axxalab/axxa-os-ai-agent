# Storybook (harness de preview)

Preview dos componentes React reais do plugin **fora do Obsidian**, pra
revisão visual/UX rápida sem abrir um vault.

```bash
npm run storybook          # build + serve em http://localhost:6006 (watch)
npm run storybook:build    # só builda em storybook/dist/
```

## Como funciona

- `build.mjs` — esbuild com os mesmos aliases preact do plugin + alias de
  `obsidian` → `obsidian-shim.ts`.
- `obsidian-shim.ts` — mock de runtime do Obsidian: `setIcon`/`addIcon`
  (via pacote `lucide`), `Notice`, `Menu`, `Modal`, `Platform`,
  `MarkdownRenderer` (markdown naive) e as extensões de prototype do DOM
  (`createEl`, `empty`, …). **Nunca entra no bundle real** — o esbuild do
  plugin segue marcando `obsidian` como external.
- `theme.css` — aproximação das variáveis do default theme do Obsidian
  (light + dark). O CSS real do plugin (`styles/main.css`) é servido como
  `plugin.css`.
- `mock.ts` — plugin/app fake + conversas e mensagens de exemplo.
- `stories.tsx` — registro das stories (telas principais, navegação,
  composer, telas secundárias).
- `main.tsx` — shell com nav de stories e controles de tema / densidade /
  viewport (mobile 390×844, desktop 900). Estado vai no hash da URL, então
  dá pra deep-linkar: `#story=chat&theme=light&density=compact&vp=mobile`.

## Limitações conhecidas

- Markdown das mensagens é um renderer naive (sem syntax highlight,
  callouts, mermaid).
- As variáveis de tema são aproximadas — cores/contrastes finos devem ser
  confirmados dentro do Obsidian.
- Modais nativos (`Modal`/`SuggestModal`) são stubs simples.

Relatório de UX gerado a partir deste harness: `docs/UX_REVIEW.md`.
