// CameraModal.stories.tsx — captura de foto in-app. Usa getUserMedia (mockado
// no Storybook → stream vazio, sem prompt de permissão real).
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { CameraModal } from "./CameraModal";
import { withMediaMocks } from "../../../.storybook/fixtures";

const meta = {
  title: "Composer/CameraModal",
  component: CameraModal,
  tags: ["autodocs"],
  decorators: [withMediaMocks],
  parameters: {
    layout: "fullscreen",
    axxaFrame: false,
    docs: {
      description: {
        component:
          "Overlay de câmera (anexar foto direto do composer/PlusModal). Mostra o " +
          "preview da câmera e um botão de captura. No Storybook o getUserMedia é " +
          "mockado (stream vazio) pra não pedir permissão real.",
      },
    },
  },
  argTypes: {
    onCapture: { action: "capture" },
    onClose: { action: "close" },
  },
  args: {
    onCapture: fn(),
    onClose: fn(),
  },
} satisfies Meta<typeof CameraModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
