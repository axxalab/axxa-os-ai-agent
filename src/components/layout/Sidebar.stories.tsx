// Sidebar.stories.tsx — gaveta lateral (nav + conversas recentes + conta).
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { Sidebar } from "./Sidebar";
import { SUMMARIES } from "../../../.storybook/fixtures";

const meta = {
  title: "Layout/Sidebar",
  component: Sidebar,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    axxaFrame: { height: 640 },
    docs: {
      description: {
        component:
          "Gaveta lateral (avatar do header): brand, 'nova conversa' por modo, " +
          "navegação (telas pagas com cadeado no free), conversas recentes filtráveis " +
          "e rodapé de conta/settings.",
      },
    },
  },
  argTypes: {
    open: { control: "boolean" },
    tier: { control: "inline-radio", options: ["free", "pro"] },
    founder: { control: "boolean" },
    version: { control: "text" },
    onClose: { action: "close" },
    onLoadChat: { action: "loadChat" },
    onNewChatMode: { action: "newChatMode" },
    onOpenAll: { action: "openAll" },
    onOpenSettings: { action: "openSettings" },
    onNavigate: { action: "navigate" },
    onDeleteChat: { action: "deleteChat" },
  },
  args: {
    open: true,
    chats: SUMMARIES,
    tier: "free",
    founder: false,
    version: "0.1.236",
    activeView: "chat",
    onClose: fn(),
    onLoadChat: fn(),
    onNewChatMode: fn(),
    onOpenAll: fn(),
    onOpenSettings: fn(),
    onNavigate: fn(),
    onDeleteChat: fn(),
  },
} satisfies Meta<typeof Sidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Gaveta aberta, plano free (telas pagas com cadeado). */
export const Free: Story = {};

/** Plano Pro + emblema Founder. */
export const ProFounder: Story = {
  args: { tier: "pro", founder: true },
};
