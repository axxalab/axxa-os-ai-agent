// src/agent/permissions.ts
// PermissionsManager — decide se uma tool roda direto ou precisa modal.
//
// Regras (do mais conservador pro mais aberto):
//   - ask (default):  confirma TUDO destrutivo. Read/list passa direto.
//   - vault:          read/list/create/edit/move passam. Delete pede confirmação.
//   - yolo:           tudo passa. EXCETO delete (irreversível sempre pergunta).

import type {
  PermissionDecision,
  PermissionLevel,
  ToolDefinition,
} from "./types";

export function evaluatePermission(
  tool: ToolDefinition,
  level: PermissionLevel
): PermissionDecision {
  // Read/list nunca precisa confirmação
  if (!tool.destructive) {
    return { autoApprove: true };
  }

  // Irreversíveis (delete) SEMPRE confirmam — safety net
  if (tool.irreversible) {
    return { autoApprove: false };
  }

  switch (level) {
    case "yolo":
      // Tudo destrutivo passa (exceto irreversível, que já foi tratado acima)
      return { autoApprove: true };
    case "vault":
      // Vault permite create/edit/move — só pede pra delete (já tratado).
      // Como tudo que chegou aqui é destrutivo NÃO irreversível, autoaprova.
      return { autoApprove: true };
    case "ask":
    default:
      // Confirma cada ação destrutiva
      return { autoApprove: false };
  }
}

/** Helper pra exibir o nível na UI. */
export const PERMISSION_LABELS: Record<PermissionLevel, string> = {
  ask: "Ask (confirma cada ação destrutiva)",
  vault: "Vault (read/write livre, delete pergunta)",
  yolo: "YOLO (sem confirmações, exceto delete)",
};
