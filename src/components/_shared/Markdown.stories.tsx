// Markdown.stories.tsx — wrapper do MarkdownRenderer do Obsidian.
// Nota: no Storybook o renderer real do Obsidian é mockado por um conversor
// markdown→HTML mínimo (.storybook/obsidian-mock.ts) — o suficiente pra mostrar
// formatação. No app real, a engine é a mesma que renderiza notas.
import type { Meta, StoryObj } from "@storybook/react";
import { Markdown } from "./Markdown";

const RICH = `# AXXA OS

Um agente de IA dentro do **Obsidian**. Ele *conversa*, responde sobre o seu
vault e age com ferramentas.

## Recursos

- Chat com streaming de tokens
- Q&A sobre as suas notas (RAG)
- Modo agente com tools

> "Só o tema é herdado; o resto é nosso." — Design System

Bloco de código:

\`\`\`ts
export function setIcon(el: HTMLElement, name: string) {
  el.replaceChildren();
}
\`\`\`

Veja a \`status line\` ou um [link](https://obsidian.md).
`;

const meta = {
  title: "Shared/Markdown",
  component: Markdown,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    axxaFrame: { height: 560 },
    docs: {
      description: {
        component:
          "Renderiza markdown com a engine do Obsidian (headings, ênfase, listas, " +
          "code blocks com botão de copiar, links, callouts). Re-renderiza a cada " +
          "mudança de `content` (também durante streaming, com throttle ~64ms).",
      },
    },
  },
  argTypes: {
    content: { control: "text", description: "Texto markdown a renderizar." },
  },
  args: { content: RICH },
  decorators: [
    (Story) => (
      <div style={{ padding: 16, overflow: "auto", height: "100%" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Markdown>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ShortReply: Story = {
  args: {
    content:
      "Claro! Aqui vão **3 passos**:\n\n- Abrir o painel\n- Escolher o modelo\n- Enviar a mensagem",
  },
};

export const CodeBlock: Story = {
  args: {
    content:
      "Exemplo de função:\n\n```js\nconst sum = (a, b) => a + b;\nconsole.log(sum(2, 3));\n```\n",
  },
};
