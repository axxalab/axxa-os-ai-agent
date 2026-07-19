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

/** Resultado do "portão" de uma tool: roda direto ou abre o modal de confirmação. */
export type ToolGate = "auto" | "confirm";

/**
 * Decisão FINAL de gate, combinando o nível de permissão com o diff-approval.
 * Era inline no agent loop — agora pura e testável (segurança: bug aqui = ação
 * destrutiva sem perguntar).
 *
 * Regras (v0.1.237 — auditoria P1-04/P1-05):
 *   - irreversível (delete) → SEMPRE "confirm" (nem o "aprovar todas" pula).
 *   - "aprovar todas" (sessão) → "auto" pra qualquer ação reversível,
 *     independente de nível/diff — o botão do modal nunca é promessa vazia.
 *   - senão, o NÍVEL decide (evaluatePermission): ask confirma destrutivo;
 *     vault/yolo auto-aprovam como os labels prometem.
 *   O toggle "Approve changes (diff)" NÃO força mais o gate: ele passou a
 *   controlar o que a confirmação MOSTRA (preview de diff), não SE confirma —
 *   antes, com diff ON (default), ask/vault/yolo se comportavam idênticos e o
 *   dropdown mentia.
 *
 * ATENÇÃO (v0.1.228): este gate trata apenas a dimensão DESTRUTIVA. Tools com
 * "custo" mas não-destrutivas (ex: generate_image, destructive:false) NÃO são
 * confirmadas aqui — elas têm fluxo PRÓPRIO de confirmação (modal de modelo +
 * preço, fora do registry de vault) e são interceptadas no agent loop ANTES de
 * chegar a decideToolGate. Ou seja: este gate não é a fonte única de verdade
 * para "tem custo?". Ao adicionar uma tool com custo, garanta o gating no caller.
 */
export function decideToolGate(
  tool: ToolDefinition,
  level: PermissionLevel,
  opts: { approveAll: boolean }
): ToolGate {
  if (tool.irreversible) return "confirm";
  if (opts.approveAll) return "auto";
  return evaluatePermission(tool, level).autoApprove ? "auto" : "confirm";
}

/** Helper pra exibir o nível na UI. */
export const PERMISSION_LABELS: Record<PermissionLevel, string> = {
  ask: "Ask (confirma cada ação destrutiva)",
  vault: "Vault (read/write livre, delete pergunta)",
  yolo: "YOLO (sem confirmações, exceto delete)",
};
