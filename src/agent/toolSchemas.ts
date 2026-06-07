// src/agent/toolSchemas.ts
// Definições das tools — descrições pro LLM + JSON Schema dos params.
//
// Convenção: nome em snake_case (matchea OpenAI/Anthropic).
// Descrições EM PT-BR — o LLM lê pra decidir quando usar a tool.

import type { ToolDefinition } from "./types";

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "vault_list",
    description:
      "Lista os arquivos e pastas dentro de uma pasta do vault. Use pra descobrir o que existe antes de criar/editar. Sem parâmetro = raiz do vault.",
    parameters: {
      type: "object",
      properties: {
        folder: {
          type: "string",
          description:
            "Caminho da pasta (ex: 'projetos/2026'). Vazio ou ausente = raiz do vault.",
        },
      },
      required: [],
    },
    destructive: false,
  },
  {
    name: "vault_read",
    description:
      "Lê o conteúdo completo de um arquivo do vault. Use antes de editar pra ver o que tá lá. Conteúdo é truncado em 200K chars se for muito grande.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Caminho do arquivo no vault (ex: 'notas/agenda.md').",
        },
      },
      required: ["path"],
    },
    destructive: false,
  },
  {
    name: "vault_create",
    description:
      "Cria um arquivo novo no vault com o conteúdo fornecido. Falha se o arquivo já existe (use vault_edit pra modificar). Cria pastas no caminho automaticamente se necessário.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            "Caminho do arquivo novo. Inclua extensão (ex: '.md' pra notas).",
        },
        content: {
          type: "string",
          description: "Conteúdo do arquivo (markdown, texto, código, etc).",
        },
      },
      required: ["path", "content"],
    },
    destructive: true,
  },
  {
    name: "vault_edit",
    description:
      "Edita um arquivo existente substituindo uma string específica. Find/replace literal (sem regex). A string old_str deve aparecer EXATAMENTE 1 vez no arquivo — se aparecer 0 ou múltiplas, a tool falha. Use vault_read antes pra ver o conteúdo exato.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Caminho do arquivo a editar.",
        },
        oldStr: {
          type: "string",
          description:
            "String LITERAL a ser substituída. Inclua contexto suficiente pra ser única no arquivo (3-5 linhas se possível).",
        },
        newStr: {
          type: "string",
          description: "String que substitui a antiga.",
        },
      },
      required: ["path", "oldStr", "newStr"],
    },
    destructive: true,
  },
  {
    name: "vault_move",
    description:
      "Renomeia ou move um arquivo/pasta. Falha se o destino já existe (não sobrescreve).",
    parameters: {
      type: "object",
      properties: {
        from: { type: "string", description: "Caminho atual." },
        to: { type: "string", description: "Caminho novo." },
      },
      required: ["from", "to"],
    },
    destructive: true,
  },
  {
    name: "vault_delete",
    description:
      "Deleta um arquivo ou uma pasta VAZIA do vault. Operação irreversível — sempre pede confirmação ao user, mesmo em modo YOLO. Pra pastas com conteúdo, delete os arquivos primeiro.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Caminho do arquivo/pasta." },
      },
      required: ["path"],
    },
    destructive: true,
    irreversible: true,
  },
  {
    name: "vault_create_folder",
    description:
      "Cria uma pasta no vault (incluindo pastas pai se não existirem). Não-op se a pasta já existe.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Caminho da pasta a criar (ex: 'projetos/2026/q4').",
        },
      },
      required: ["path"],
    },
    destructive: true,
  },
];

/** Helper: pega ToolDefinition pelo nome. */
export function getToolDefinition(name: string): ToolDefinition | undefined {
  return TOOL_DEFINITIONS.find((t) => t.name === name);
}

/** Converte ToolDefinition pro formato OpenAI function calling. */
export function toOpenAIFunction(tool: ToolDefinition) {
  return {
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  };
}
