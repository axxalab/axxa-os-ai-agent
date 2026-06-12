# PR de submissão — pronto pra colar (#12)

Tudo que você precisa pra abrir o PR no
[`obsidianmd/obsidian-releases`](https://github.com/obsidianmd/obsidian-releases).
Faça **uma vez**; updates depois chegam sozinhos via GitHub Release.

---

## 1. A entrada do `community-plugins.json`

Fork do `obsidianmd/obsidian-releases`, e **adicione no FIM do array** em
`community-plugins.json` (mantenha a vírgula do item anterior):

```json
{
  "id": "axxa-os-ai-agent",
  "name": "AXXA OS - AI Agent",
  "author": "Axxa Lab",
  "description": "Chat with AI, query your vault with local RAG, and let an agent read and edit your notes across six LLM providers. Bring your own API key.",
  "repo": "axxalab/axxa-os-ai-agent"
}
```

`id` / `name` / `author` / `description` batem **exatamente** com o `manifest.json`. ✅

---

## 2. Descrição do PR (cole no corpo)

> **AXXA OS — AI Agent**
>
> An AI workspace inside Obsidian: chat across six LLM providers (OpenAI,
> Anthropic, Google Gemini, OpenRouter, NVIDIA NIM, Ollama), local RAG over your
> vault, and an agent that reads/edits notes with explicit diff-approval.
> **Bring-your-own-key** — no accounts, no backend of ours.
>
> **Network use (disclosure):** the plugin only makes network requests to the
> LLM provider the user selects, authenticated with the user's own API key.
> There is **no telemetry, analytics, or tracking** of any kind. Endpoints are
> the official APIs of the six providers above (and a user-configured Ollama
> endpoint, default `localhost`). Image generation uses the same provider APIs.
>
> **Secrets:** API keys are stored in the OS secret storage via Obsidian's
> `secretStorage` (not in `data.json`) — hence `minAppVersion: 1.11.4`.
>
> **Mobile:** `isDesktopOnly: false`. Mobile-specific browser features degrade
> gracefully (see notes below) — the core chat/RAG/agent flows work on mobile.
>
> **Notes for review (non-public / browser APIs used):**
> - `app.setting.open()` / `openTabById()` — semi-private API used only to open
>   this plugin's own settings tab from in-app CTAs. No public equivalent;
>   widely used by community plugins. Guarded with optional chaining + try/catch
>   so a future API change degrades to a Notice instead of throwing.
> - `requestUrl` with header `anthropic-dangerous-direct-browser-access` — needed
>   for Anthropic's API in the Electron/mobile webview (CORS).
> - `navigator.mediaDevices.getUserMedia` — optional in-app camera (attach a
>   photo). On **mobile** we use the native `<input capture>` (system camera)
>   instead; on desktop a live webcam preview. Both are opt-in (user taps the
>   camera tile) and fail gracefully if unavailable/denied.
> - Web Speech API (`speechSynthesis` / `SpeechRecognition`) — optional voice
>   mode (read-aloud + dictation). Feature-detected; if unavailable the UI says
>   so and still reads answers aloud where possible. No data leaves the device.
> - No `innerHTML` anywhere (uses `setIcon`/`replaceChildren`). CSS lives in
>   `styles.css` (no inline styles injected into the app chrome). The plugin
>   does **not** manipulate Obsidian's layout/chrome.

---

## 3. Pré-submit (rodar antes de abrir o PR)

- [x] Release com tag == `manifest.json.version` + 3 assets (a Action faz).
- [x] `manifest.json`, `versions.json`, `LICENSE` (MIT), `README` (PT+EN).
- [x] Sem telemetria; sem `innerHTML`; CSS em `styles.css`.
- [x] API privada revisada e justificada (acima).
- [ ] **Screenshots reais** em `docs/screenshots/` (substituir os placeholders)
      e/ou no README — o review gosta de ver a cara do plugin.
- [ ] (Opcional) `fundingUrl` no `manifest.json` se quiser link de apoio.
- [ ] Rodar `docs/VALIDATION.md` com chaves reais (sign-off funcional).

Depois de aprovado: nada de re-review. Cada update = bump no manifest + commit +
`git tag 0.1.X && git push origin 0.1.X`.
