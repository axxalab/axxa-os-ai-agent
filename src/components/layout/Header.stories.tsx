// Header.stories.tsx — header da view (branding / título / switcher de modelo).
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { Header } from "./Header";

const meta = {
  title: "Layout/Header",
  component: Header,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    axxaFrame: { height: 360 },
    docs: {
      description: {
        component:
          "Header da view. Sem chat ativo mostra o branding \"AXXA OS\"; com chat " +
          "ativo troca por um input inline com o título + o switcher central de " +
          "modelo. À direita: busca (só no chat), nova conversa e menu \"…\".",
      },
    },
  },
  argTypes: {
    version: { control: "text" },
    chatTitle: { control: "text", description: "Vazio = sem chat (branding)." },
    searchActive: { control: "boolean" },
    canCopy: { control: "boolean" },
    personaActive: { control: "boolean" },
    modelName: { control: "text" },
    modelLocked: { control: "boolean" },
    modelOptions: { control: "object" },
  },
  args: {
    version: "0.1.236",
    chatTitle: "",
    searchActive: false,
    canCopy: false,
    personaActive: false,
    modelName: "gpt-4o",
    modelOptions: ["gpt-4o", "gpt-4o-mini", "o3-mini"],
    modelLocked: false,
    onOpenSettings: fn(),
    onNewChat: fn(),
    onOpenSidebar: fn(),
    onRenameChat: fn(),
    onToggleSearch: fn(),
    onCopyConversation: fn(),
    onEditPersona: fn(),
    onSelectModel: fn(),
    onOpenVoice: fn(),
  },
} satisfies Meta<typeof Header>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Estado inicial — sem conversa, só o branding. */
export const Branding: Story = {};

/** Conversa ativa — título editável + switcher de modelo. */
export const WithChat: Story = {
  args: {
    chatTitle: "Resumo do artigo sobre RAG",
    canCopy: true,
  },
};

/** Sessão travada (após a 1ª mensagem) — o switcher mostra o cadeado. */
export const ModelLocked: Story = {
  args: {
    chatTitle: "Planejamento de sprint",
    canCopy: true,
    modelLocked: true,
    personaActive: true,
  },
};

/** Busca aberta dentro da conversa — ícone de busca destacado. */
export const SearchActive: Story = {
  args: {
    chatTitle: "Notas da reunião",
    canCopy: true,
    searchActive: true,
  },
};
