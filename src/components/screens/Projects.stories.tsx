// Projects.stories.tsx — projetos (lista, editor, detalhe).
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import {
  ProjectsListScreen,
  ProjectDetailScreen,
  ProjectEditor,
} from "./Projects";
import { PROJECTS, SUMMARIES } from "../../../.storybook/fixtures";

const meta = {
  title: "Screens/Projects",
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    axxaFrame: { height: 640 },
    docs: {
      description: {
        component:
          "Projetos: lista de projetos (grid), editor (ícone + cor + nome) e tela de " +
          "detalhe (conversas + fontes do projeto).",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Lista de projetos. */
export const List: Story = {
  render: () => (
    <ProjectsListScreen
      projects={PROJECTS}
      onOpen={fn()}
      onCreate={fn()}
      onClose={fn()}
    />
  ),
};

/** Lista vazia — CTA pra criar o primeiro projeto. */
export const ListEmpty: Story = {
  render: () => (
    <ProjectsListScreen projects={[]} onOpen={fn()} onCreate={fn()} onClose={fn()} />
  ),
};

/** Editor de projeto (criando um novo). */
export const EditorNew: Story = {
  render: () => <ProjectEditor onSave={fn()} onClose={fn()} />,
};

/** Editor de projeto (editando um existente, com opção de excluir). */
export const EditorEditing: Story = {
  render: () => (
    <ProjectEditor initial={PROJECTS[0]} onSave={fn()} onDelete={fn()} onClose={fn()} />
  ),
};

/** Detalhe do projeto: conversas e fontes. */
export const Detail: Story = {
  render: () => (
    <ProjectDetailScreen
      project={PROJECTS[0]}
      chats={SUMMARIES.slice(0, 3)}
      onBack={fn()}
      onEdit={fn()}
      onNewChat={fn()}
      onOpenChat={fn()}
      onAddSource={fn()}
      onRemoveSource={fn()}
      onOpenSource={fn()}
    />
  ),
};
