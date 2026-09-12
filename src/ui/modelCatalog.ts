// src/ui/modelCatalog.ts
// Organiza a lista crua que o provider devolve em algo digerível: PAPEL (o que
// o modelo faz) e, dentro dele, FAMÍLIA (a linhagem).
//
// Nada disso é inventado aqui — o motor já sabe as três coisas:
//   getModelCard().category  → categoria semântica do modelo
//   categoryToRole()         → colapsa em chat / reasoning / image / …
//   getModelFamily()         → Opus, GPT-5, o-series, Llama… (com ícone e cor)
// Este arquivo só junta, conta e ordena, pra UI não precisar saber de nada.
//
// O papel vira o segmented control (um filtro); a família vira as seções
// dentro da lista filtrada.

import { getModelCard } from "../providers/modelDescriptions";
import { getModelFamily, getFamilyRank } from "../providers/modelFamily";
import {
  categoryToRole,
  ROLE_ICONS,
  ROLE_LABELS,
  ROLE_ORDER,
  type RoleId,
} from "../providers/modelRoles";

export interface CatalogFamily {
  id: string;
  label: string;
  icon: string;
  color: string;
  models: string[];
}

export interface CatalogRole {
  id: RoleId;
  label: string;
  icon: string;
  /** Total de modelos do papel (soma das famílias). */
  count: number;
  families: CatalogFamily[];
}

/**
 * Agrupa os modelos por papel → família. Só devolve papéis que TÊM modelo —
 * um filtro vazio é ruído, e a régua é a mesma do segmented: cabe na tela.
 * Famílias saem na ordem canônica da tabela (linhagem mais nova primeiro) e os
 * modelos dentro de cada uma em ordem alfabética.
 */
export function buildModelCatalog(
  provider: string,
  models: string[]
): CatalogRole[] {
  const byRole = new Map<RoleId, Map<string, CatalogFamily>>();

  for (const model of models) {
    const role = categoryToRole(getModelCard(provider, model).category);
    const fam = getModelFamily(model);
    const families = byRole.get(role) ?? new Map<string, CatalogFamily>();
    const entry = families.get(fam.id) ?? {
      id: fam.id,
      label: fam.label,
      icon: fam.icon,
      color: fam.color,
      models: [],
    };
    entry.models.push(model);
    families.set(fam.id, entry);
    byRole.set(role, families);
  }

  const out: CatalogRole[] = [];
  for (const role of ROLE_ORDER) {
    const families = byRole.get(role);
    if (!families) continue;
    const list = Array.from(families.values()).sort(
      (a, b) => getFamilyRank(a.id) - getFamilyRank(b.id)
    );
    for (const f of list) f.models.sort();
    out.push({
      id: role,
      label: ROLE_LABELS[role],
      icon: ROLE_ICONS[role],
      count: list.reduce((n, f) => n + f.models.length, 0),
      families: list,
    });
  }
  return out;
}
