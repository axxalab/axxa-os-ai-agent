// src/agent/toolSchemas.ts
// Definições das tools — descrições pro LLM + JSON Schema dos params.
//
// Convenção: nome em snake_case (matchea OpenAI/Anthropic).
// Descrições em EN — o LLM lê pra decidir quando usar a tool (coerente com
// o system prompt do agent, que também é EN).

import type { ToolDefinition } from "./types";

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "vault_search",
    description:
      "SEMANTIC relevance search across the vault notes (uses the embeddings index; falls back to keyword search when there is no index). USE THIS FIRST to find notes relevant to a topic or question — far more efficient than listing folders and reading files one by one. Returns the most relevant excerpts with each one's path (use vault_read to open the full file afterwards).",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "What to look for — a topic, question or keywords.",
        },
        topK: {
          type: "number",
          description: "How many excerpts to return (1-20, default 5).",
        },
      },
      required: ["query"],
    },
    destructive: false,
  },
  {
    name: "vault_list",
    description:
      "Lists the files and folders inside a vault folder. Use it to discover what exists before creating/editing. No parameter = vault root.",
    parameters: {
      type: "object",
      properties: {
        folder: {
          type: "string",
          description:
            "Folder path (e.g. 'projects/2026'). Empty or absent = vault root.",
        },
      },
      required: [],
    },
    destructive: false,
  },
  {
    name: "vault_read",
    description:
      "Reads the full content of a vault file. Use it before editing to see what is there. Content is truncated at 200K chars when too large.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "File path in the vault (e.g. 'notes/agenda.md').",
        },
      },
      required: ["path"],
    },
    destructive: false,
  },
  {
    name: "vault_create",
    description:
      "Creates a new vault file with the given content. Fails if the file already exists (use vault_edit to modify). Creates folders along the path automatically when needed.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            "Path of the new file. Include the extension (e.g. '.md' for notes).",
        },
        content: {
          type: "string",
          description: "File content (markdown, text, code, etc).",
        },
      },
      required: ["path", "content"],
    },
    destructive: true,
  },
  {
    name: "vault_edit",
    description:
      "Edits an existing file by replacing a specific string. Literal find/replace (no regex). old_str must appear EXACTLY once in the file — the tool fails on 0 or multiple matches. Use vault_read first to see the exact content.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path of the file to edit.",
        },
        oldStr: {
          type: "string",
          description:
            "LITERAL string to replace. Include enough context to make it unique in the file (3-5 lines if possible).",
        },
        newStr: {
          type: "string",
          description: "String that replaces the old one.",
        },
      },
      required: ["path", "oldStr", "newStr"],
    },
    destructive: true,
  },
  {
    name: "vault_move",
    description:
      "Renames or moves a file/folder. Fails if the destination already exists (never overwrites).",
    parameters: {
      type: "object",
      properties: {
        from: { type: "string", description: "Current path." },
        to: { type: "string", description: "New path." },
      },
      required: ["from", "to"],
    },
    destructive: true,
  },
  {
    name: "vault_delete",
    description:
      "Deletes a file or an EMPTY folder from the vault. Irreversible operation — always asks the user for confirmation, even in YOLO mode. For folders with content, delete the files first.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "File/folder path." },
      },
      required: ["path"],
    },
    destructive: true,
    irreversible: true,
  },
  {
    name: "vault_create_folder",
    description:
      "Creates a vault folder (including parent folders when missing). No-op if the folder already exists.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path of the folder to create (e.g. 'projects/2026/q4').",
        },
      },
      required: ["path"],
    },
    destructive: true,
  },
  {
    name: "generate_image",
    description:
      "Gera uma imagem a partir de um prompt de texto e a renderiza NA CONVERSA (salva no vault). Use quando o usuário pedir uma imagem, ilustração, mockup, logo, ícone, capa, etc. O usuário confirma o modelo num modal antes de gerar — você NÃO escolhe o modelo. Escreva um prompt visual rico e específico. Não precisa trocar de modelo de chat.",
    parameters: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description:
            "Descrição visual detalhada da imagem (estilo, composição, cores, enquadramento). Em inglês costuma render melhor.",
        },
      },
      required: ["prompt"],
    },
    destructive: false,
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
