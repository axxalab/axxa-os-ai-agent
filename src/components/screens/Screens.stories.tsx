// Screens.stories.tsx — telas full-screen do app (media/stats/profile/plans/locked/onboarding).
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import {
  MediaScreen,
  StatisticsScreen,
  ProfileScreen,
  LockedScreen,
  OnboardingScreen,
  PlansScreen,
} from "./Screens";
import { SUMMARIES, mockObsidianApp } from "../../../.storybook/fixtures";

const meta = {
  title: "Screens/Screens",
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    axxaFrame: { height: 640 },
    docs: {
      description: {
        component:
          "Telas full-screen acessadas pela gaveta: Mídia, Estatísticas, Perfil, " +
          "Planos, tela bloqueada (free) e onboarding de 1º uso.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Galeria de mídia (gerações + gravações). Vazia no mock (sem arquivos). */
export const Media: Story = {
  render: () => (
    <MediaScreen app={mockObsidianApp} axxaPaths={["axxa-ai/generation"]} onClose={fn()} />
  ),
};

/** Estatísticas de uso, derivadas dos summaries. */
export const Statistics: Story = {
  render: () => (
    <StatisticsScreen summaries={SUMMARIES} onOpenUsage={fn()} onClose={fn()} />
  ),
};

/** Perfil do usuário (plano, email, providers conectados). */
export const Profile: Story = {
  render: () => (
    <ProfileScreen
      tier="pro"
      email="voce@exemplo.com"
      connectedProviders={["openai", "anthropic"]}
      totalChats={42}
      onClose={fn()}
      onOpenPlans={fn()}
      onOpenSettings={fn()}
    />
  ),
};

/** Planos (free vs pro) + ativação de licença. */
export const Plans: Story = {
  render: () => (
    <PlansScreen tier="free" license="" onSetLicense={fn()} onClose={fn()} />
  ),
};

/** Tela bloqueada (recurso pago no plano free). */
export const Locked: Story = {
  render: () => <LockedScreen view="media" onClose={fn()} onSeePlans={fn()} />,
};

/** Onboarding de primeiro uso. */
export const Onboarding: Story = {
  render: () => <OnboardingScreen onOpenSettings={fn()} onDismiss={fn()} />,
};
