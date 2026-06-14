// src/views/chatTypes.ts
// Tipos compartilhados entre o AxxaApp e os hooks extraídos do motor (Frente 2).
import type { MessageAttachment } from "../providers/base";

// Anexo pendente no composer (multi-tipo) — id estável p/ UI, não persiste no .md.
export interface PendingAttachmentEntry {
  id: string;
  attachment: MessageAttachment;
  name: string;
}
