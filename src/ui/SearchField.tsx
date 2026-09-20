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
//
// Ele também sabe ser GATILHO: com `onOpen`, a mesma pílula vira um botão que
// abre a folha de busca (ver SearchSheet.tsx) em vez de receber texto ali
// mesmo. É um componente só porque é o mesmo objeto — o que muda é onde a
// digitação acontece, não o que a pessoa vê e toca.

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
  onOpen,
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
  /** Quando existe, a pílula vira BOTÃO: tocar abre a folha de busca, e é lá
   *  que se digita. */
  onOpen?: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // `autoFocus` pode virar true DEPOIS da montagem (a folha de busca amarra
    // o valor à abertura dela) — por isso ele é dependência, e não uma leitura
    // de uma vez só.
    if (!autoFocus) return;
    // `autoFocus` do React chama focus() sem preventScroll — e isso rola o
    // ancestral, que é o pulo que a folha levava ao entrar na busca.
    ref.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  const procurando = value.trim().length > 0;

  // Gatilho: mesma pílula, mesma lupa, mesmo lugar — mas sem campo. O texto
  // mostra a busca em curso quando há uma, senão o convite.
  if (onOpen) {
    return (
      <button
        type="button"
        className="axxa-search-field is-trigger"
        aria-label={label ?? placeholder}
        onClick={onOpen}
      >
        <Icon name="search" size={18} />
        <span className={procurando ? "axxa-search-text" : "axxa-search-text is-empty"}>
          {procurando ? value : placeholder}
        </span>
        {procurando && found !== undefined && (
          <span className="axxa-search-found">
            {found === 1 ? "1 found" : `${found} found`}
          </span>
        )}
      </button>
    );
  }

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
