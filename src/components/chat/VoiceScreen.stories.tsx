// VoiceScreen.stories.tsx — modo Voz (orb animado, STT/TTS via Web Speech).
// No Storybook o reconhecimento de voz pode não estar disponível (mostra o
// aviso); os mocks de mídia evitam erros de permissão.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { VoiceScreen } from "./VoiceScreen";
import { withMediaMocks } from "../../../.storybook/fixtures";

const meta = {
  title: "Chat/VoiceScreen",
  component: VoiceScreen,
  tags: ["autodocs"],
  decorators: [withMediaMocks],
  parameters: {
    layout: "fullscreen",
    axxaFrame: { height: 720 },
    docs: {
      description: {
        component:
          "Modo Voz (ref ChatGPT/Grok): tela de intro com features + a tela ativa com " +
          "orb animado, status, mic (hold-to-talk) e ajustes de voz/velocidade.",
      },
    },
  },
  argTypes: {
    isStreaming: { control: "boolean" },
    lang: { control: "text" },
    voiceRate: { control: { type: "range", min: 0.5, max: 2, step: 0.1 } },
    introDone: { control: "boolean" },
    onSend: { action: "send" },
    onClose: { action: "close" },
    onChangeVoice: { action: "changeVoice" },
    onChangeRate: { action: "changeRate" },
    onIntroDone: { action: "introDone" },
  },
  args: {
    lastAi: null,
    isStreaming: false,
    lang: "en-us",
    voiceURI: "",
    voiceRate: 1,
    introDone: true,
    onSend: fn(),
    onClose: fn(),
    onChangeVoice: fn(),
    onChangeRate: fn(),
    onIntroDone: fn(),
  },
} satisfies Meta<typeof VoiceScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Tela de introdução (primeiro acesso ao modo voz). */
export const Intro: Story = { args: { introDone: false } };

/** Tela ativa — orb + controles. */
export const Active: Story = { args: { introDone: true } };

/** Respondendo (streaming) com a última resposta da IA. */
export const Speaking: Story = {
  args: {
    introDone: true,
    isStreaming: true,
    lastAi: { id: "a1", content: "Aqui vai a resposta sendo falada em voz alta.", done: false },
  },
};
