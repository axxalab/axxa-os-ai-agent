# SVG source assets

Arquivos SVG crus usados na UI do AXXA OS. São **fonte** — viram código inline
no `main.js` no build (o plugin distribui só `main.js` + `manifest.json` +
`styles.css`), então esta pasta **não é distribuída**, só serve de origem.

Fluxo: solte os `.svg` aqui → eu registro via `addIcon()` em
`src/components/_shared/` (mono) ou inline como componente/CSS (colorido) →
usado pelo `<Icon name="..." />`.
