// Composer.stories.tsx — o COMPOSER REAL (editor CodeMirror + status line +
// anexos + gravação). É o input de texto do app, com @nota e /comando.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { Composer, type PendingAttachment } from "./Composer";

// 1x1 cinza pra simular thumbnail de imagem anexada.
const GRAY_PX =
  "data:image/gif;base64,R0lGODlhAQABAIAAAMzMzAAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";

const ATTACHMENTS: PendingAttachment[] = [
  { id: "img1", kind: "image", dataUrl: GRAY_PX, mimeType: "image/png", name: "captura.png" },
  { id: "note1", kind: "note", path: "Notas/RAG.md", name: "RAG.md" },
  { id: "pdf1", kind: "pdf", name: "paper.pdf" },
  { id: "aud1", kind: "audio", path: "axxa-ai/recordings/2026.webm", name: "Áudio 0:05", durationMs: 5000 },
];

const meta = {
  title: "Composer/Composer",
  component: Composer,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    axxaFrame: { height: 320 },
    docs: {
      description: {
        component:
          "O composer real do AXXA: editor CodeMirror com autocomplete de @nota " +
          "(wikilinks) e /comando, status line com chips (provider/model/effort/" +
          "tokens/contexto), anexos (imagem/nota/pdf/áudio), botão de modelo, voz e " +
          "hold-to-record. Enter envia, Shift+Enter quebra linha.",
      },
    },
  },
  argTypes: {
    providerName: { control: "text" },
    modelName: { control: "text" },
    effort: { control: "inline-radio", options: ["low", "med", "high", "xhigh", "max"] },
    mode: { control: "inline-radio", options: ["chat", "vault-qa", "agent"] },
    streaming: { control: "boolean" },
    locked: { control: "boolean" },
    visionEnabled: { control: "boolean" },
    tokensIn: { control: "number" },
    tokensOut: { control: "number" },
    tokensPerSec: { control: "number" },
    contextUsed: { control: "number" },
    visibleChips: { control: "object" },
    placeholder: { control: "text" },
  },
  args: {
    providerName: "OpenAI",
    modelName: "gpt-4o",
    effort: "med",
    mode: "chat",
    streaming: false,
    locked: false,
    visionEnabled: true,
    tokensIn: 1240,
    tokensOut: 860,
    tokensPerSec: 42,
    contextUsed: 5300,
    visibleChips: ["provider", "model", "effort", "tokens", "context"],
    onSend: fn(),
    onStop: fn(),
    onPlusClick: fn(),
    onOpenModel: fn(),
    onOpenVoice: fn(),
    onDraftChange: fn(),
    onAddImage: fn(),
    onRemoveAttachment: fn(),
    onPickNote: fn(),
    onAddAudio: fn(),
    onSaveAudio: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Composer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Modo chat — digite e aperte Enter (a action onSend dispara). */
export const Chat: Story = { args: { mode: "chat" } };

/** Modo Q&A (vault) — placeholder e visual próprios do modo. */
export const VaultQA: Story = { args: { mode: "vault-qa" } };

/** Modo agente. */
export const Agent: Story = { args: { mode: "agent" } };

/** Streaming em andamento — botão de enviar vira "parar". */
export const Streaming: Story = { args: { streaming: true } };

/** Sessão travada — chip de modelo com cadeado. */
export const Locked: Story = { args: { locked: true } };

/** Com anexos pendentes (imagem, nota, pdf e áudio). */
export const WithAttachments: Story = {
  args: { pendingAttachments: ATTACHMENTS },
};
