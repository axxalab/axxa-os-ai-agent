// src/ui/SearchField.tsx
// O campo de busca do app — UM só.
//
// Existiam dois, parecidos e diferentes: o da home de cada módulo (pílula com
// lupa e a contagem de achados na ponta) e o da folha de notas (retângulo com
// lupa e mais nada). Dois campos para a mesma ação é como eles divergem — foi
// o que aconteceu com a margem lateral, que virou 12 de um lado e 16 do outro
// até alguém notar o degrau.
//
// Quem usa escolhe só o que É diferente: o texto de dentro, se o teclado abre
// sozinho (na folha sim, porque ela abriu PARA buscar; na home não, porque
// ela abriu pra escolher) e quantos achados mostrar.

import { useEffect, useRef } from "react";
import { Icon } from "./Icon";

export function SearchField({
  value,
  placeholder,
  onChange,
  found,
  invalid,
  autoFocus,
  label,
}: {
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
  /** Quantos itens a busca achou. `undefined` esconde a contagem. */
  found?: number;
  /** A expressão não compila como regex — caiu em busca literal. */
  invalid?: boolean;
  /** Abre o teclado ao aparecer. */
  autoFocus?: boolean;
  /** Pra leitor de tela ("Search Chat", "Search notes"). */
  label?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!autoFocus) return;
    // `autoFocus` do React chama focus() sem preventScroll — e isso rola o
    // ancestral, que é o pulo que a folha levava ao entrar na busca.
    ref.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  const procurando = value.trim().length > 0;
  return (
    <label className={invalid ? "axxa-search-field is-bad" : "axxa-search-field"}>
      <Icon name="search" size={18} />
      <input
        ref={ref}
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={label ?? placeholder}
        onChange={(e) => onChange(e.currentTarget.value)}
      />
      {procurando && found !== undefined && (
        <span className="axxa-search-found">
          {/* A contagem aparece SEMPRE que se está buscando — na expressão
              quebrada também, com o aviso de que ali virou busca literal.
              Trocar o número pelo aviso deixava a pessoa sem saber se achou
              alguma coisa. */}
          {invalid ? "literal · " : ""}
          {found === 1 ? "1 found" : `${found} found`}
        </span>
      )}
    </label>
  );
}
