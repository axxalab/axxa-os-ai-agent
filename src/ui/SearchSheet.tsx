// src/ui/SearchSheet.tsx
// A TELA de busca do app: o campo no topo, o teclado já aberto, e os
// resultados ocupando o resto.
//
// Buscar dentro da página tinha um problema de espaço que não dava pra
// resolver na própria página: o teclado come metade da tela, e a metade que
// sobra é justamente onde NÃO estão os resultados — eles ficam embaixo do
// campo, atrás do teclado. Numa folha própria o campo encosta no topo e a
// lista cresce contra o teclado, que é a única arrumação em que se vê o que
// se está procurando enquanto se digita.
//
// Ela é a MESMA folha do resto do app (Sheet.tsx) e o MESMO campo (SearchField
// via SheetSearch) — o que ela acrescenta é a regra de que buscar é uma tela,
// não um filtro no canto.

import type { ReactNode } from "react";
import { Sheet, SheetSearch } from "./Sheet";

export function SearchSheet({
  open,
  title,
  placeholder,
  value,
  onChange,
  onClose,
  found,
  invalid,
  children,
}: {
  open: boolean;
  /** O que está sendo buscado ("Chats", "Notes") — vira o título da folha. */
  title: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
  found?: number;
  invalid?: boolean;
  /** Os resultados. Quem busca sabe desenhar o que achou. */
  children: ReactNode;
}) {
  return (
    <Sheet
      title={title}
      open={open}
      onClose={onClose}
      startFull
      // O painel NÃO toma o foco: quem tem que tomar é o campo. O efeito do
      // pai roda depois do efeito do filho, então sem isto o painel apagava o
      // teclado que o campo tinha acabado de abrir.
      focusOnOpen={false}
    >
      {/* `autoFocus` amarrado à ABERTURA, não fixo em `true`: a folha fica
          montada o tempo todo (é assim que ela desliza), então um `autoFocus`
          constante disparava uma vez só, no nascimento do app, com a folha
          ainda escondida — e focar o que está escondido não faz nada. Virando
          de false pra true no instante em que ela abre, o efeito roda de novo,
          agora com o campo na tela.
          E ele existe porque esta folha só serve PRA buscar: abrir sem teclado
          custaria um toque a mais pra fazer a única coisa que ela faz. */}
      <SheetSearch
        value={value}
        placeholder={placeholder}
        found={found}
        invalid={invalid}
        autoFocus={open}
        onChange={onChange}
      />
      <div className="axxa-search-results">{children}</div>
    </Sheet>
  );
}
