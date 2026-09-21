// src/ui/SheetForm.tsx
// As peças de FORMULÁRIO da folha: rótulo, campo, texto longo, grade de
// ícones, cores e o botão que conclui.
//
// A folha já sabia oferecer escolhas (Sheet.tsx: linhas, abas, segmentos) —
// tudo coisa de quem ESCOLHE entre o que já existe. Criar um skill ou um
// projeto é outro verbo: é escrever o que ainda não existe. Estas peças são
// esse verbo, e moram aqui em vez de dentro do Sheet porque o Sheet é a
// casca: ele sobe, arrasta e fecha; o que vai dentro é assunto de quem usa.
//
// Uma regra atravessa todas: o rótulo fica ACIMA do campo, nunca dentro dele.
// Rótulo que vive de placeholder some na hora em que a pessoa começa a
// digitar — justamente quando ela ainda precisa dele.

import type { ReactNode } from "react";
import { Icon } from "./Icon";

/** Rótulo + explicação + o campo. A unidade do formulário. */
export function SheetField({
  label,
  hint,
  children,
}: {
  label: string;
  /** Uma linha dizendo o que aquilo faz. Só onde o nome não basta. */
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="axxa-field">
      <span className="axxa-field-label">{label}</span>
      {hint && <span className="axxa-field-hint">{hint}</span>}
      {children}
    </label>
  );
}

export function SheetInput({
  value,
  placeholder,
  autoFocus,
  onChange,
}: {
  value: string;
  placeholder?: string;
  autoFocus?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <input
      className="axxa-input"
      type="text"
      value={value}
      placeholder={placeholder}
      // A folha do formulário abre com `focusOnOpen={false}` pra este campo
      // poder pegar o foco — o efeito do pai roda depois do do filho, e sem
      // isso o painel rouba o cursor (a mesma armadilha da busca).
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.currentTarget.value)}
    />
  );
}

export function SheetTextarea({
  value,
  placeholder,
  rows = 6,
  onChange,
}: {
  value: string;
  placeholder?: string;
  rows?: number;
  onChange: (v: string) => void;
}) {
  return (
    <textarea
      className="axxa-textarea"
      value={value}
      placeholder={placeholder}
      rows={rows}
      onChange={(e) => onChange(e.currentTarget.value)}
    />
  );
}

/**
 * Escolha única em pílulas — os modos, as opções curtas.
 *
 * É lista, não segmented: o segmented divide a largura em partes iguais e
 * promete que todas as opções cabem na linha. Aqui elas quebram pra segunda
 * linha sem drama.
 */
export function SheetChoices({
  items,
  value,
  onPick,
  label,
}: {
  items: Array<{ id: string; label: string; icon?: string }>;
  value: string;
  onPick: (id: string) => void;
  label: string;
}) {
  return (
    <div className="axxa-choices" role="group" aria-label={label}>
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          className={it.id === value ? "axxa-choice is-on" : "axxa-choice"}
          aria-pressed={it.id === value}
          onClick={() => onPick(it.id)}
        >
          {it.icon && <Icon name={it.icon} size={16} />}
          <span>{it.label}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * A grade de ícones.
 *
 * Todos à vista de uma vez, sem rolagem interna: uma grade que rola dentro de
 * uma folha que também rola é um lugar onde o dedo nunca sabe o que vai
 * acontecer.
 */
export function SheetIconGrid({
  icons,
  value,
  onPick,
  /** Pinta o selecionado com a cor do projeto, quando há uma. */
  tint,
}: {
  icons: readonly string[];
  value: string;
  onPick: (icon: string) => void;
  tint?: string;
}) {
  return (
    <div className="axxa-icongrid" role="group" aria-label="Icon">
      {icons.map((ic) => (
        <button
          key={ic}
          type="button"
          className={ic === value ? "axxa-icontile is-on" : "axxa-icontile"}
          aria-label={ic}
          aria-pressed={ic === value}
          style={ic === value && tint ? { color: tint } : undefined}
          onClick={() => onPick(ic)}
        >
          <Icon name={ic} size={20} />
        </button>
      ))}
    </div>
  );
}

/**
 * As cores, em azulejos da forma da casa — os mesmos 44px dos ícones logo
 * abaixo. Eram bolinhas de 30px: forma que o app não usa em lugar nenhum e
 * alvo menor que o mínimo de toque, então escolher uma cor era mira.
 *
 * A marcada ganha um ANEL, não um check: o check taparia justamente a cor que
 * se está escolhendo. E o anel é feito do jeito que a forma exige — pai
 * mascarado com padding e a cor do anel no fundo, filho mascarado por cima
 * (docs/SQUIRCLE.md, "O padrão de anel"): `box-shadow` não serve, a máscara
 * apaga tudo que é desenhado fora da caixa.
 */
export function SheetSwatches({
  colors,
  value,
  onPick,
  resolve,
}: {
  colors: readonly string[];
  value: string;
  onPick: (color: string) => void;
  /** Traduz o id da cor pra um valor CSS ("default" → cor do tema). */
  resolve: (color: string) => string;
}) {
  return (
    <div className="axxa-swatches" role="group" aria-label="Color">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          className={c === value ? "axxa-swatch is-on" : "axxa-swatch"}
          aria-label={c}
          aria-pressed={c === value}
          onClick={() => onPick(c)}
        >
          <span
            className="axxa-swatch-fill"
            style={{ backgroundColor: resolve(c) }}
          />
        </button>
      ))}
    </div>
  );
}

/**
 * O botão que conclui, grudado no fim do conteúdo da folha.
 *
 * Ele NUNCA fica desligado por falta de preenchimento: botão apagado não diz
 * o que falta, e quem chegou até o fim da folha merece uma frase em vez de um
 * botão morto. O que falta vira `problema` — a folha explica e não grava.
 */
export function SheetSubmit({
  label,
  icon = "check",
  problema,
  onSubmit,
}: {
  label: string;
  icon?: string;
  /** O que impede de salvar agora; null = pronto. */
  problema?: string | null;
  onSubmit: () => void;
}) {
  return (
    <div className="axxa-form-foot">
      {problema && (
        <p className="axxa-form-problem" role="status">
          <Icon name="info" size={15} />
          <span>{problema}</span>
        </p>
      )}
      <button
        type="button"
        className="axxa-form-submit"
        aria-disabled={!!problema}
        onClick={onSubmit}
      >
        <Icon name={icon} size={18} />
        <span>{label}</span>
      </button>
    </div>
  );
}
