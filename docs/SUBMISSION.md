# Submissão ao Obsidian Community Plugins (#12)

Guia completo pra listar o AXXA OS no diretório oficial. A submissão é **uma vez**;
depois disso os updates chegam sozinhos via GitHub Release (já automatizado em
`.github/workflows/release.yml`).

## 1. Pré-requisitos (já temos)

- [x] Repo público no GitHub (`axxalab/axxa-os-ai-agent`).
- [x] `manifest.json` na raiz com `id`, `name`, `version`, `minAppVersion`,
      `description`, `author`, `isDesktopOnly`.
- [x] `versions.json` mapeando versão → minAppVersion.
- [x] Uma **GitHub Release** cujo tag == `manifest.json.version`, com
      `main.js` + `manifest.json` + `styles.css` anexados (a Action faz).
- [x] `LICENSE` (MIT).
- [x] `README.md` claro (PT + EN).

## 2. A entrada do `community-plugins.json`

Fork de [`obsidianmd/obsidian-releases`](https://github.com/obsidianmd/obsidian-releases),
e **adicione no FIM do array** em `community-plugins.json`:

```json
{
  "id": "axxa-os-ai-agent",
  "name": "AXXA OS - AI Agent",
  "author": "Axxa Lab",
  "description": "Chat with AI, query your vault with local RAG, and let an agent read and edit your notes across six LLM providers. Bring your own API key.",
  "repo": "axxalab/axxa-os-ai-agent"
}
```

`id` / `name` / `author` / `description` **têm que bater** com o `manifest.json`.
Abra um PR; o bot roda checagens automáticas e depois um humano revisa.

## 3. Checklist de review (passar de primeira)

- [x] **Sem telemetria/tracking.** O plugin só chama os providers que o user
      escolhe, com a chave dele. README já declara isso explicitamente.
- [x] **Keys no SecretStorage do OS** (não em `data.json`) desde v0.1.90 — por
      isso `minAppVersion 1.11.4`.
- [x] **CSS em `styles.css`**, não inline no JS (o build sincroniza
      `styles/main.css` → `output/styles.css`).
- [x] **Fullscreen REMOVIDO** (v0.1.127) — não mexemos mais no chrome/layout do
      Obsidian (era um risco de review). Confirmar que nada manipula o DOM do app.
- [x] **API privada:** auditado (v0.1.196). Único uso semi-privado é
      `app.setting.open()`/`openTabById()` — agora com optional-chaining +
      try/catch + comentário justificando; sem `innerHTML`; sem manipular o
      chrome do app. Justificativa pronta em `SUBMISSION_PR.md`.
- [x] **APIs de browser (mobile):** câmera usa `getUserMedia` no desktop e
      `<input capture>` nativo no mobile (v0.1.196); voz usa Web Speech API com
      feature-detection + degradação. Todas opt-in. Documentado no PR.
- [ ] **`fundingUrl`** (opcional) no manifest se quiser link de apoio.
- [x] **Network disclosure:** texto pronto em `SUBMISSION_PR.md` (sem telemetria;
      só os providers que o user escolhe, com a chave dele).

## 4. Riscos conhecidos a checar antes do PR

1. `app.setting.open()` / `openTabById` — API semi-privada usada pra abrir
   Settings. Provável OK, mas pode levantar flag.
2. `requestUrl` com `anthropic-dangerous-direct-browser-access` — documentar que
   é necessário pro Anthropic no browser/Electron.
3. Geração de imagem (Imagen/Nano Banana) faz `fetch`/`requestUrl` — coberto pelo
   disclosure de rede.

## 5. Depois de aprovado

Nada de re-review. Pra cada update: bumpe o `manifest.json` + commit, depois
`git tag 0.1.X && git push origin 0.1.X` → a Action publica a Release.
