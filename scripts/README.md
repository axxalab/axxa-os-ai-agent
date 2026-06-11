# Scripts

Geradores e utilitários. Os arquivos `*.generated.ts` são **auto-gerados** —
não editar à mão; rode o script.

| Script | Gera | Quando rodar |
|---|---|---|
| `genLogos.mjs` | `src/components/_shared/brandLogos.ts` | ao adicionar/trocar SVG em `assets/svg/` |
| `collect-hot.mjs` | `src/providers/hotData.generated.ts` | **semanal** (popularidade dos modelos) |
| `deploy.mjs` | copia o build pro vault de teste | manual, no dev |

## Coleta de popularidade ("hot") — automação semanal

`collect-hot.mjs` busca **dado real** de popularidade e regenera a tabela que
alimenta o rating 🔥 dos modelos (`src/providers/dataCollect.ts`).

**Fontes:**
- **Open models** → HuggingFace Hub API (`downloads` por org). Público, estável,
  sem key. É dado real de adoção.
- **Closed models** (gpt/claude/gemini/…) → baseline curado dentro do próprio
  script (`CLOSED`), porque não existe API pública de uso pra eles. Editar a
  lista `CLOSED` quando a linha de frente mudar.

**Design pra automação:** o script é **idempotente** — mesmo dado de entrada
gera um arquivo **idêntico** (sem timestamp; o histórico do git é o registro).
Logo, se a popularidade não mudou, não há diff e não há commit.

### Contrato pro agente (rodar toda quinta)

```bash
node scripts/collect-hot.mjs
# commita SÓ se o dado mudou:
git diff --quiet src/providers/hotData.generated.ts \
  || git commit -am "chore(data): weekly hot ranking update"
```

Pode ser ligado num GitHub Action (`schedule: cron "0 9 * * 4"` = quinta 09:00
UTC) ou no agente externo do dev. O `npm run collect:hot` é um atalho.

> Ao adicionar uma família de modelo nova, registre o padrão em `HF_FAMILIES`
> (se for open, com o `org` do HuggingFace) ou em `CLOSED` (se for fechado).
