// src/ui/Sheet.tsx
// Bottom sheet do composer — a folha que sobe de baixo pra escolher provider,
// modelo e effort. Substitui o Menu nativo do Obsidian nesses três seletores
// (o Menu continua servindo pras ações do histórico, que são um menu mesmo).
//
// Anatomia (na referência do app da Claude): puxador, X à esquerda com o
// título centralizado, e o conteúdo em CARDS agrupados — linhas com título +
// legenda, divisória entre elas, a selecionada em accent com um check.
//
// Fecha no scrim, no X e no Esc. Renderiza dentro da .axxa-root (que é
// position: relative), então cobre só o painel da AXXA — nunca o app inteiro.

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { Icon } from "./Icon";
import { SearchField } from "./SearchField";
import { screen, tap, warn } from "./haptics";

/** Quanto puxar além da borda pra o gesto valer. Menos que isso é solavanco
 *  de rolagem, não intenção. */
const PULL_THRESHOLD = 72;

export function Sheet({
  title,
  open,
  onClose,
  onBack,
  startFull,
  focusOnOpen = true,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  /** Quando existe, a folha está num nível interno: o X vira seta de voltar
   *  (e o X migra pra direita, pra fechar continuar a um toque). */
  onBack?: () => void;
  /** Nasce no tamanho grande. É o caso da busca: ela abre com o teclado, e o
   *  teclado já come metade — abrir pequena deixaria dois resultados à vista
   *  e obrigaria a um arrasto antes de ler qualquer coisa. */
  startFull?: boolean;
  /** Por padrão o painel toma o foco ao abrir (é o que faz o teclado físico
   *  navegar a folha). Quem tem um campo lá dentro que abre COM teclado passa
   *  `false`: senão o painel rouba o foco do campo — o efeito do pai roda
   *  depois do efeito do filho, e o campo apagava. */
  focusOnOpen?: boolean;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  /** peek = altura do conteúdo (teto baixo) · full = quase a tela toda. */
  const [size, setSize] = useState<"peek" | "full">(startFull ? "full" : "peek");
  const startY = useRef<number | null>(null);
  const dragY = useRef(0);
  /** O gesto lê o tamanho por REF: os listeners nativos são registrados uma vez
   *  por abertura, e um `size` capturado no fecho ficaria velho — foi o que fez
   *  a folha grande FECHAR onde devia só encolher. */
  const sizeRef = useRef(size);
  sizeRef.current = size;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // O foco é da ABERTURA, e só dela. Junto do listener acima ele dependia de
  // `onClose`, que muda de identidade a cada render do pai — então o painel
  // roubava o foco de volta a cada tecla digitada na busca (o teclado fechava
  // sozinho), e cada roubada era mais uma chance de rolar a tela.
  //
  // `preventScroll` é o que tira o PULO: sem ele o navegador rola o ancestral
  // pra "revelar" o painel, que nesse instante ainda está em translateY(100%),
  // fora da tela.
  useEffect(() => {
    if (!open) return;
    if (focusOnOpen) panelRef.current?.focus({ preventScroll: true });
    // A lista começa do começo: reabrir no meio de onde parou parece que a
    // folha nasceu torta.
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [open, focusOnOpen]);

  // Fechou: volta pro tamanho de nascença, senão a próxima abre do tamanho
  // que a anterior ficou depois do arrasto.
  useEffect(() => {
    if (!open) setSize(startFull ? "full" : "peek");
  }, [open, startFull]);

  // Abrir e fechar são eventos de TELA, não toques: pulso um tico mais longo.
  // Só na TROCA: o efeito também roda na montagem, e com quatro folhas
  // montadas junto com o chat isso virava uma saraivada de pulsos na abertura
  // do app — sem nada ter acontecido.
  const montado = useRef(false);
  useEffect(() => {
    if (!montado.current) {
      montado.current = true;
      return;
    }
    screen();
  }, [open]);

  // ── arrasto no puxador ──────────────────────────────────────────────────
  // Pra cima cresce, pra baixo encolhe e, já pequena, fecha. Enquanto arrasta
  // a folha acompanha o dedo (com resistência pra cima, que é o limite).
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    startY.current = e.clientY;
    dragY.current = 0;
    // Mesma razão do microfone: capturar é bom, mas lançar aqui mataria o
    // arrasto inteiro. Sem captura o gesto segue funcionando sobre o puxador.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* segue sem captura */
    }
    panelRef.current?.classList.add("is-dragging");
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (startY.current === null) return;
    const dy = e.clientY - startY.current;
    dragY.current = dy;
    const el = panelRef.current;
    // dy > 0 (pra baixo) segue o dedo; pra cima só 35%, que é o "encosto".
    if (el) el.style.transform = `translateY(${Math.max(dy, dy * 0.35)}px)`;
  };

  const onPointerUp = () => {
    if (startY.current === null) return;
    const dy = dragY.current;
    startY.current = null;
    const el = panelRef.current;
    if (el) {
      el.style.transform = "";
      el.classList.remove("is-dragging");
    }
    if (dy < -48) {
      setSize("full");
      tap();
    } else if (dy > 48) {
      if (size === "full") setSize("peek");
      else onClose();
      tap();
    }
  };

  // ── arrasto no CONTEÚDO (puxar além da borda fecha) ─────────────────────
  // Listener NATIVO, e não prop do React, por um motivo só: `touchmove` precisa
  // ser não-passivo pra poder chamar preventDefault. Com pointer events o
  // navegador assumia o gesto no scroller e disparava `pointercancel` — a
  // folha andava dois píxeis e voltava (a "tremida"), sem nunca fechar.
  useEffect(() => {
    const el = bodyRef.current;
    const panel = panelRef.current;
    if (!open || !el || !panel) return;

    let y0: number | null = null;
    let dy = 0;
    let borda: "top" | "bottom" | null = null;

    const comecar = (y: number) => {
      const noTopo = el.scrollTop <= 0;
      const noFim = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
      // Lista que cabe inteira está nas DUAS bordas; puxar pra baixo é o gesto
      // que todo mundo tenta primeiro, então ela conta como "no topo".
      borda = noTopo ? "top" : noFim ? "bottom" : null;
      y0 = y;
      dy = 0;
    };

    /** Devolve true quando o gesto é NOSSO (aí o move é engolido). */
    const mover = (y: number): boolean => {
      if (y0 === null || borda === null) return false;
      const d = y - y0;
      const puxando =
        (borda === "top" && d > 0) || (borda === "bottom" && d < 0);
      if (!puxando) {
        dy = 0;
        panel.style.transform = "";
        return false;
      }
      dy = d;
      panel.classList.add("is-dragging");
      // Pra baixo segue o dedo; pra cima cede pouco — não há pra onde ir, o
      // gesto ali é só a intenção de fechar.
      panel.style.transform = `translateY(${d > 0 ? d : d * 0.25}px)`;
      return true;
    };

    const soltar = () => {
      const b = borda;
      const d = dy;
      y0 = null;
      borda = null;
      dy = 0;
      panel.style.transform = "";
      panel.classList.remove("is-dragging");
      // Uma direção, um significado — o mesmo do puxador, e o mesmo em toda
      // folha: PRA CIMA cresce, PRA BAIXO diminui e, já pequena, fecha.
      if (b === "top" && d > PULL_THRESHOLD) {
        if (sizeRef.current === "full") setSize("peek");
        else onClose();
        tap();
      } else if (b === "bottom" && d < -PULL_THRESHOLD) {
        setSize("full");
        tap();
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) comecar(e.touches[0].clientY);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      if (mover(e.touches[0].clientY) && e.cancelable) e.preventDefault();
    };
    // Mouse (desktop e preview): o navegador não sequestra, pointer basta.
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") comecar(e.clientY);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "touch") mover(e.clientY);
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerType !== "touch") soltar();
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", soltar);
    el.addEventListener("touchcancel", soltar);
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", soltar);
      el.removeEventListener("touchcancel", soltar);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
  }, [open, onClose]);

  return (
    <div
      className={open ? "axxa-sheet-layer is-open" : "axxa-sheet-layer"}
      aria-hidden={!open}
    >
      <div className="axxa-scrim" onClick={onClose} />
      <div
        ref={panelRef}
        className={size === "full" ? "axxa-sheet is-full" : "axxa-sheet"}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div
          className="axxa-sheet-drag"
          title="Drag to resize"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="axxa-sheet-grab" aria-hidden="true" />
        </div>
        <header className="axxa-sheet-head">
          <button
            type="button"
            className="axxa-icon-btn"
            aria-label={onBack ? "Back" : "Close"}
            onClick={onBack ?? onClose}
          >
            <Icon name={onBack ? "chevron-left" : "x"} />
          </button>
          <h3 className="axxa-sheet-title">{title}</h3>
          {/* Espelha a largura do botão pra manter o título no centro óptico —
              e no nível interno esse lugar é do X. */}
          {onBack ? (
            <button
              type="button"
              className="axxa-icon-btn"
              aria-label="Close"
              onClick={onClose}
            >
              <Icon name="x" />
            </button>
          ) : (
            <span className="axxa-sheet-head-spacer" aria-hidden="true" />
          )}
        </header>
        <div ref={bodyRef} className="axxa-sheet-body">
          {children}
        </div>
      </div>
    </div>
  );
}

/** Cartão que agrupa linhas (divisória entre elas, cantos arredondados). */
/** A fileira de três do topo da folha — os caminhos principais, grandes o
 *  bastante pra acertar com o polegar. O que é secundário desce pra lista. */
export function SheetTiles({ children }: { children: ReactNode }) {
  return <div className="axxa-sheet-tiles">{children}</div>;
}

export function SheetTile({
  icon,
  label,
  /** Explicação curta quando o caminho não está disponível agora. */
  hint,
  disabled,
  onClick,
}: {
  icon: string;
  label: string;
  hint?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={disabled ? "axxa-sheet-tile is-off" : "axxa-sheet-tile"}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon name={icon} size={26} />
      <span className="axxa-sheet-tile-label">{label}</span>
      {hint && <span className="axxa-sheet-tile-hint">{hint}</span>}
    </button>
  );
}

/** Campo de busca no topo de uma folha (lista de notas). Fica ACIMA da lista
 *  de propósito: com o teclado aberto, o que sobra de tela é o topo. */
/**
 * A busca da folha É a busca do app (SearchField) — mesmo componente, mesma
 * pílula, mesma contagem de achados. O que a folha acrescenta é o respiro
 * até a lista.
 *
 * O teclado NÃO abre sozinho por padrão: numa folha ele cobre metade da
 * lista, e quem abriu a folha de modelos abriu pra ESCOLHER. Quem entrou num
 * nível que só existe pra buscar (as notas) pede `autoFocus` e aí sim.
 */
export function SheetSearch({
  value,
  placeholder,
  onChange,
  found,
  invalid,
  autoFocus,
}: {
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
  found?: number;
  /** A expressão não compila como regex — caiu em busca literal. */
  invalid?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <div className="axxa-sheet-search">
      <SearchField
        value={value}
        placeholder={placeholder}
        found={found}
        invalid={invalid}
        autoFocus={autoFocus}
        onChange={onChange}
      />
    </div>
  );
}

export function SheetGroup({
  children,
  label,
}: {
  children: ReactNode;
  /** Título acima do cartão. Sem ele, o grupo não se apresenta — é o caso de
   *  quando só existe um. */
  label?: string;
}) {
  if (!label) return <div className="axxa-sheet-group">{children}</div>;
  return (
    <div className="axxa-sheet-block">
      <span className="axxa-sheet-group-label">{label}</span>
      <div className="axxa-sheet-group">{children}</div>
    </div>
  );
}

/**
 * Abas de TEXTO dentro da folha (as categorias de modelo).
 *
 * Rolam na horizontal em vez de dividir a largura em partes iguais: com cinco
 * ou seis categorias num aparelho de 375px, um segmentado fixo espreme
 * "Reasoning" até virar "Reas…". Aqui cada aba tem o tamanho do nome dela e a
 * fileira anda — e a contagem ao lado diz quanto tem lá dentro antes do toque.
 */
export function SheetTabs({
  items,
  activeId,
  onPick,
  label,
}: {
  items: { id: string; label: string; count: number }[];
  activeId: string;
  onPick: (id: string) => void;
  label: string;
}) {
  return (
    <div className="axxa-sheet-tabs" role="group" aria-label={label}>
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          className={
            it.id === activeId
              ? "axxa-sheet-tab is-active"
              : "axxa-sheet-tab"
          }
          aria-pressed={it.id === activeId}
          onClick={() => onPick(it.id)}
        >
          <span>{it.label}</span>
          <span className="axxa-sheet-tab-count">{it.count}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Segmented control DENTRO da folha — hoje, os providers. Colunas iguais
 * (são todos logos, mesma largura), então o thumb é só o índice ativo: nada
 * de medir nó, ao contrário do das Settings, onde os rótulos têm larguras
 * diferentes.
 */
export function SheetSeg({
  items,
  activeId,
  onPick,
  onBlocked,
  label,
}: {
  items: {
    id: string;
    icon: string;
    label: string;
    /** Bolinha de conexão. Bloqueado (off/fail) também não é clicável. */
    health?: "off" | "unknown" | "ok" | "fail";
    /** Por que está bloqueado — vira o tooltip. */
    blocked?: string | null;
  }[];
  activeId: string;
  onPick: (id: string) => void;
  /** Tocou num bloqueado. `insistiu` = é o segundo toque seguido no MESMO
   *  item — o momento de explicar em vez de só recusar. */
  onBlocked?: (id: string, motivo: string, insistiu: boolean) => void;
  label: string;
}) {
  const index = Math.max(
    items.findIndex((i) => i.id === activeId),
    0
  );
  /** Último bloqueado tocado, pra saber quando o toque é insistência. */
  const [insistindo, setInsistindo] = useState<string | null>(null);
  return (
    <div
      className="axxa-sheet-seg"
      role="group"
      aria-label={label}
      style={
        {
          "--axxa-seg": index,
          "--axxa-seg-count": items.length,
        } as CSSProperties
      }
    >
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          className={
            "axxa-sheet-seg-item" +
            (it.id === activeId ? " is-active" : "") +
            (it.blocked ? " is-blocked" : "")
          }
          aria-pressed={it.id === activeId}
          aria-label={it.label}
          title={it.blocked ? `${it.label} — ${it.blocked}` : it.label}
          /* `aria-disabled` em vez de `disabled`: o botão continua RECEBENDO o
             toque (senão não dá pra explicar por que ele não funciona), mas
             não troca de provider. */
          aria-disabled={!!it.blocked && it.id !== activeId}
          onClick={() => {
            const travado = !!it.blocked && it.id !== activeId;
            if (!travado) {
              setInsistindo(null);
              onPick(it.id);
              return;
            }
            warn();
            onBlocked?.(it.id, it.blocked ?? "", insistindo === it.id);
            setInsistindo(it.id);
          }}
        >
          <span className="axxa-sheet-seg-mark">
            <Icon name={it.icon} size={20} />
            {it.health && (
              <span
                className={`axxa-seg-dot is-${it.health}`}
                aria-hidden="true"
              />
            )}
          </span>
        </button>
      ))}
    </div>
  );
}

/**
 * Linha que ABRE outro nível na mesma folha (o "Show list ›"). Não escolhe
 * nada: navega. Por isso o chevron pra direita, e não um check.
 */
export function SheetNavRow({
  title,
  note,
  icon,
  onClick,
}: {
  title: string;
  note?: string;
  /** Ícone Lucide num brasão redondo à esquerda (como na referência). */
  icon?: string;
  onClick: () => void;
}) {
  // O valor vai ao LADO do chevron, não numa segunda linha: a linha de
  // navegação não precisa de duas alturas pra dizer "Effort · Med".
  return (
    <button type="button" className="axxa-sheet-row is-nav" onClick={onClick}>
      {icon && (
        <Icon
          name={icon}
          size={20}
          className="axxa-sheet-row-icon is-badge"
        />
      )}
      <span className="axxa-sheet-row-title">{title}</span>
      {note && <span className="axxa-sheet-row-value">{note}</span>}
      <Icon name="chevron-right" size={18} className="axxa-sheet-chev" />
    </button>
  );
}

/**
 * Linha que LIGA e DESLIGA, no mesmo cartão das que navegam.
 *
 * O interruptor fica à direita, onde o chevron estaria: quem lê a fileira de
 * cima pra baixo aprende num golpe o que cada linha faz — seta leva a outro
 * lugar, chave muda alguma coisa aqui mesmo.
 *
 * A linha INTEIRA é o alvo, não só a chavinha: num telefone, acertar 34px de
 * chave é pior do que acertar a linha toda, e o estado é o mesmo.
 */
export function SheetToggleRow({
  title,
  note,
  icon,
  on,
  onToggle,
}: {
  title: string;
  note?: string;
  icon?: string;
  on: boolean;
  onToggle: (on: boolean) => void;
}) {
  return (
    <button
      type="button"
      className="axxa-sheet-row is-nav"
      role="switch"
      aria-checked={on}
      onClick={() => onToggle(!on)}
    >
      {icon && (
        <Icon name={icon} size={20} className="axxa-sheet-row-icon is-badge" />
      )}
      <span className="axxa-sheet-row-title">{title}</span>
      {note && <span className="axxa-sheet-row-value">{note}</span>}
      {/* `aria-hidden`: quem anuncia o estado é o `role="switch"` da linha —
          a chave é o desenho dele, não um segundo controle. */}
      <span
        className={on ? "axxa-switch is-on" : "axxa-switch"}
        aria-hidden="true"
      >
        <span className="axxa-switch-bola" />
      </span>
    </button>
  );
}

/** Linha de recado dentro do cartão (lista vazia, aviso). */
export function SheetNote({ children }: { children: ReactNode }) {
  return <p className="axxa-sheet-note">{children}</p>;
}

export function SheetRow({
  title,
  note,
  tag,
  selected,
  dense,
  icon,
  iconTone,
  badge,
  chevron,
  action,
  onClick,
}: {
  title: string;
  /** Legenda em uma linha, abaixo do título. */
  note?: string;
  /** Etiqueta ao lado do título ("Default"). */
  tag?: string;
  selected?: boolean;
  /** Uma linha só (nome à esquerda, legenda à direita). Pra lista longa —
   *  onze ações em duas linhas cada viram rolagem sem fim. */
  dense?: boolean;
  /** Ícone Lucide à esquerda. Só onde ele DIZ algo que o texto não diz (ler,
   *  procurar, apagar); lista de modelos continua sem — lá o ícone era
   *  decoração e por isso saiu. */
  icon?: string;
  /** "danger" pinta o ícone de vermelho (ação que falhou). */
  iconTone?: "danger";
  /** Ícone dentro de um círculo (linhas de destino, como no "+"). */
  badge?: boolean;
  /** Seta à direita — a linha leva pra outro lugar. */
  chevron?: boolean;
  /** Botão SEPARADO na ponta direita (a estrela de favorito). Fica fora do
   *  botão da linha porque botão dentro de botão não existe — e porque são
   *  duas ações diferentes: uma escolhe, a outra marca. */
  action?: {
    icon: string;
    label: string;
    on?: boolean;
    onClick: () => void;
  };
  onClick: () => void;
}) {
  const linha = (
    <button
      type="button"
      className={
        "axxa-sheet-row" +
        (selected ? " is-active" : "") +
        (dense ? " is-dense" : "")
      }
      aria-pressed={selected === true}
      onClick={onClick}
    >
      {icon && (
        <Icon
          name={icon}
          size={badge ? 20 : dense ? 16 : 18}
          className={
            (badge ? "axxa-sheet-row-icon is-badge" : "axxa-sheet-row-icon") +
            (iconTone === "danger" ? " is-danger" : "")
          }
        />
      )}
      {dense ? (
        <>
          <span className="axxa-sheet-row-title">
            {title}
            {tag && <span className="axxa-sheet-tag">{tag}</span>}
          </span>
          {note && <span className="axxa-sheet-row-value">{note}</span>}
        </>
      ) : (
        <span className="axxa-sheet-row-main">
          <span className="axxa-sheet-row-title">
            {title}
            {tag && <span className="axxa-sheet-tag">{tag}</span>}
          </span>
          {note && <span className="axxa-sheet-row-note">{note}</span>}
        </span>
      )}
      {selected && <Icon name="check" size={20} className="axxa-sheet-check" />}
      {chevron && (
        <Icon name="chevron-right" size={18} className="axxa-sheet-chev" />
      )}
    </button>
  );
  if (!action) return linha;
  return (
    <div className="axxa-sheet-row-wrap">
      {linha}
      <button
        type="button"
        className={
          action.on
            ? "axxa-sheet-row-action is-on"
            : "axxa-sheet-row-action"
        }
        aria-label={action.label}
        aria-pressed={action.on === true}
        title={action.label}
        onClick={action.onClick}
      >
        <Icon name={action.icon} size={18} />
      </button>
    </div>
  );
}
