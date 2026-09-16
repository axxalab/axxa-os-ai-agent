// src/ui/Segmented.tsx
// O segmented control do app — um trilho, um thumb que desliza, N opções.
//
// Ele já existia: era o seletor de modo da tela inicial de uma conversa, com
// as três colunas escritas na mão no CSS. Agora a home filtra a lista de
// conversas com o MESMO controle, e um segmented de quatro colunas num
// componente separado seria o mesmo desenho contado duas vezes — foi assim
// que o campo de busca acabou existindo em duas versões.
//
// O número de colunas vira token (`--axxa-seg-n`) e o thumb se acha sozinho.

import type { CSSProperties } from "react";

export interface SegmentOption {
  id: string;
  label: string;
  /** Tem algo pedindo atenção aí dentro. É um PONTO, não um número: a conta
   *  exata já está em cada cartão da lista, e aqui o que importa é saber em
   *  qual aba ela está escondida. */
  dot?: boolean;
}

export function Segmented({
  options,
  value,
  label,
  onChange,
}: {
  options: SegmentOption[];
  value: string;
  /** O que este controle está escolhendo — pro leitor de tela. */
  label: string;
  onChange: (id: string) => void;
}) {
  // Valor que não está na lista (a última conversa daquele modo saiu, por
  // exemplo) não deixa o thumb num limbo: ele volta pra primeira coluna.
  const idx = Math.max(
    options.findIndex((o) => o.id === value),
    0
  );

  return (
    <div
      className="axxa-modes"
      role="group"
      aria-label={label}
      style={
        {
          "--axxa-seg": idx,
          "--axxa-seg-n": options.length,
        } as CSSProperties
      }
    >
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className={o.id === value ? "axxa-mode is-active" : "axxa-mode"}
          aria-pressed={o.id === value}
          onClick={() => onChange(o.id)}
        >
          <span>{o.label}</span>
          {o.dot && <span className="axxa-seg-dot" aria-hidden="true" />}
        </button>
      ))}
    </div>
  );
}
