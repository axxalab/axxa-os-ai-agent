// PlusModal.stories.tsx — bottom sheet do "+" do composer (anexos, esforço,
// toggles de web search / imagem / thinking, estilo de resposta, skills).
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { PlusModal } from "./PlusModal";
import { withMediaMocks } from "../../../.storybook/fixtures";

const meta = {
  title: "Composer/PlusModal",
  component: PlusModal,
  tags: ["autodocs"],
  decorators: [withMediaMocks],
  parameters: {
    layout: "fullscreen",
    axxaFrame: false,
    docs: {
      description: {
        component:
          "Bottom sheet do botão '+' do composer: anexar (nota/pdf/imagem/câmera), " +
          "slider de esforço, toggles (web search, criar imagem, extended thinking), " +
          "estilo de resposta e atalho pra galeria de skills.",
      },
    },
  },
  argTypes: {
    currentEffort: { control: "inline-radio", options: ["low", "med", "high", "xhigh", "max"] },
    visionEnabled: { control: "boolean" },
    imageGenEnabled: { control: "boolean" },
    createImageAvailable: { control: "boolean" },
    responseStyle: {
      control: "inline-radio",
      options: ["normal", "concise", "explanatory", "formal", "friendly"],
    },
    toggles: { control: "object" },
    onSelectEffort: { action: "selectEffort" },
    onClose: { action: "close" },
    onAttachPicked: { action: "attachPicked" },
    onToggle: { action: "toggle" },
    onCreateImage: { action: "createImage" },
    onSelectStyle: { action: "selectStyle" },
    onExploreSkills: { action: "exploreSkills" },
  },
  args: {
    currentEffort: "med",
    visionEnabled: true,
    imageGenEnabled: true,
    createImageAvailable: true,
    responseStyle: "normal",
    toggles: { webSearch: false, createImage: false, extendedThinking: true },
    onSelectEffort: fn(),
    onClose: fn(),
    onAttachPicked: fn(),
    onToggle: fn(),
    onCreateImage: fn(),
    onSelectStyle: fn(),
    onExploreSkills: fn(),
  },
} satisfies Meta<typeof PlusModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Modelo sem visão nem geração de imagem — opções desabilitadas. */
export const TextOnlyModel: Story = {
  args: { visionEnabled: false, imageGenEnabled: false, createImageAvailable: false },
};
