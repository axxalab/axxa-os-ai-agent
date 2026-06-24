// SkillsScreen.stories.tsx — galeria de skills (notas .md viram prompts/templates).
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { SkillsScreen } from "./SkillsScreen";
import type { Skill } from "../../skills/skills";

const SKILLS: Skill[] = [
  {
    id: "blog-post",
    name: "Rascunho de post",
    description: "Transforma um tópico em um rascunho estruturado de blog.",
    icon: "pen-line",
    mode: "chat",
    body: "Escreva um rascunho de post sobre: ",
    path: "axxa-ai/skills/blog-post.md",
  },
  {
    id: "daily-review",
    name: "Revisão diária",
    description: "Resume e organiza as notas do dia em ações.",
    icon: "calendar-check",
    mode: "vault-qa",
    body: "Revise minhas notas de hoje e liste as ações.",
    path: "axxa-ai/skills/daily-review.md",
  },
  {
    id: "refactor-notes",
    name: "Refatorar notas",
    description: "Reorganiza e conecta notas soltas sobre um tema.",
    icon: "git-merge",
    mode: "agent",
    body: "Reorganize e conecte minhas notas sobre ",
    path: "axxa-ai/skills/refactor-notes.md",
  },
];

const meta = {
  title: "Chat/SkillsScreen",
  component: SkillsScreen,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    axxaFrame: { height: 620 },
    docs: {
      description: {
        component:
          "Galeria de Skills — cada nota .md em axxa-ai/skills vira um card que " +
          "injeta um prompt/template no composer (e troca o modo, se definido).",
      },
    },
  },
  argTypes: {
    onUse: { action: "use" },
    onOpenNote: { action: "openNote" },
    onClose: { action: "close" },
  },
  args: {
    skills: SKILLS,
    onUse: fn(),
    onOpenNote: fn(),
    onClose: fn(),
  },
} satisfies Meta<typeof SkillsScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Galeria com skills de exemplo. */
export const Default: Story = {};

/** Estado vazio — nenhuma skill criada (mostra a decoração 404). */
export const Empty: Story = {
  args: { skills: [] },
};
