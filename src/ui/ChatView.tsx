// src/ui/ChatView.tsx
// A tela do chat: barra do topo (menu · título · nova conversa), o corpo
// (StarterScreen enquanto vazio, timeline depois) e o composer. O MODO se
// escolhe na tela inicial; provider e modelo ficam nos pills do composer e
// somem quando a sessão trava (1º envio) — o effort continua livre sempre.
//
// O histórico de conversas NÃO mora aqui: é o menu lateral (Drawer.tsx).

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  arrayBufferToBase64,
  Notice,
  Platform,
  requestUrl,
} from "obsidian";
import type AxxaPlugin from "../main";
import {
  NEW_CHAT_DRAFT,
  useChatStore,
  type ActivityMeta,
  type ChatMessage,
} from "../store/chat";
import type { ChatSession } from "../core/session";
import {
  PROVIDERS,
  providerBlockedReason,
  providerHealth,
} from "../core/providersMeta";
import {
  getModelCard,
  prettyModelName,
} from "../providers/modelDescriptions";
import {
  EFFORT_LEVELS,
  EFFORT_LABELS,
  EFFORT_DESCRIPTIONS,
  type EffortLevel,
} from "../core/effort";
import type { AIToolStep } from "../agent/types";
import { agentActivitySpec } from "../core/helpers";
import type { Skill } from "../skills/skills";
import { Markdown } from "./Markdown";
import { Icon } from "./Icon";
import { useVoice } from "./useVoice";
import { speak, stopSpeaking } from "./readAloud";
import { commit, screen, warn } from "./haptics";
import { composerMaxHeight, readKeyboardHeight } from "./composerSize";
import { decideScroll, shouldShowJump } from "./follow";
import { pasteIsBig, pastedNote } from "./pasteAttachment";
import {
  htmlTitle,
  htmlToText,
  isImageExt,
  linkNote,
  normalizeUrl,
  rankArtifacts,
  vaultArtifacts,
  attachmentLabel,
  attachmentThumb,
  artifactIcon,
  GENERATION_DIR,
  type ArtifactLike,
} from "./attachSources";
import { getModelCapabilities } from "../providers/modelCapabilities";
import { ConfirmModal, PromptModal, openPluginSettings } from "./modals";
import { VoiceDock } from "./VoiceBar";
import {
  Sheet,
  SheetGroup,
  SheetNavRow,
  SheetNote,
  SheetRow,
  SheetSearch,
  SheetSeg,
  SheetTile,
  SheetTiles,
} from "./Sheet";
import {
  rankNotes,
  readNote,
  vaultNotes,
  wikilinkQuery,
  type NoteLike,
} from "./notePicker";
import type { MessageAttachment } from "../providers/base";
import { StarterScreen } from "./StarterScreen";
import { ThinkingLine } from "./Thinking";
import type { ComposerInject } from "./App";
import { moduleLabel, modulePlaceholder } from "./modules";

/** Título da folha do "+" em cada nível. */
const PLUS_SHEET_TITLE: Record<string, string> = {
  root: "Add context",
  notes: "Attach note",
  skills: "Use a skill",
  artifacts: "Attach artifact",
};

/** Título da folha de modelos em cada nível. */
const MODEL_SHEET_TITLE: Record<string, string> = {
  root: "Select model",
  list: "Show list",
  effort: "Effort",
};

export function ChatView({
  plugin,
  session,
  inject,
  moduloExterno,
  onSairDoExterno,
  onOpenMenu,
  onUseSkill,
}: {
  plugin: AxxaPlugin;
  session: ChatSession;
  inject: ComposerInject | null;
  /** Módulo estranho que está sendo visto, se houver (ver App). */
  moduloExterno: string | null;
  /** Sair dele — o seletor de modo leva de volta pros módulos de casa. */
  onSairDoExterno: () => void;
  onOpenMenu: () => void;
  onUseSkill: (skill: Skill) => void;
}) {
  const messages = useChatStore((s) => s.messages);
  const isLoading = useChatStore((s) => s.isLoading);
  const loadingChat = useChatStore((s) => s.loadingChat);
  const streamingId = useChatStore((s) => s.streamingMessageId);
  const currentChatId = useChatStore((s) => s.currentChatId);

  const currentChatTitle = useChatStore((s) => s.currentChatTitle);
  // Anexos pendentes (nota, imagem, texto colado) — chips acima do campo.
  const attachments = useChatStore((s) => s.attachments);
  const addAttachment = useChatStore((s) => s.addAttachment);
  const removeAttachment = useChatStore((s) => s.removeAttachment);
  // Mensagem escrita durante a resposta, esperando a vez.
  const queued = useChatStore((s) => s.queued);
  const pushQueued = useChatStore((s) => s.pushQueued);
  const removeQueued = useChatStore((s) => s.removeQueued);
  // Lido do store pra re-renderizar quando a sessão trava/destrava.
  const locked = useChatStore((s) => s.sessionProvider) !== null;
  const cfg = session.config;

  // O rascunho é do CHAT, não da tela: ele mora no store (ver drafts lá) pra
  // sobreviver a sair pra Projects/Skills e pra não vazar de uma conversa pra
  // outra.
  const draftKey = currentChatId ?? NEW_CHAT_DRAFT;
  const draft = useChatStore((s) => s.drafts[draftKey] ?? "");
  const writeDraft = useChatStore((s) => s.setDraft);
  const setDraft = useCallback(
    (next: string | ((prev: string) => string)) =>
      writeDraft(
        draftKey,
        typeof next === "function"
          ? next(useChatStore.getState().drafts[draftKey] ?? "")
          : next
      ),
    [draftKey, writeDraft]
  );
  /** Qual bottom sheet do composer está aberta. */
  const [sheet, setSheet] = useState<"model" | "effort" | "plus" | null>(
    null
  );
  /** Provider que a folha de modelos está MOSTRANDO — não é o da sessão até
   *  alguém tocar num modelo. Dá pra espiar o catálogo de outro provider sem
   *  trocar nada por engano. */
  const [pickProvider, setPickProvider] = useState(cfg.provider);
  /** Nível da folha de modelos: os favoritos, ou a lista inteira. */
  const [modelView, setModelView] = useState<"root" | "list" | "effort">(
    "root"
  );
  /** O que já foi reconhecido nesta gravação (parcial ou final). */
  const [liveText, setLiveText] = useState("");
  /** `[[` aberto no rascunho: onde começou e o que já foi digitado. */
  const [mention, setMention] = useState<{ start: number; query: string } | null>(
    null
  );
  /** Nível da folha do "+": a raiz, ou uma das listas. */
  const [plusView, setPlusView] = useState<
    "root" | "notes" | "skills" | "artifacts"
  >("root");
  const [noteQuery, setNoteQuery] = useState("");
  /** Três seletores nativos: galeria, câmera e PDF. São inputs separados
   *  porque `capture` muda o comportamento do aparelho — o mesmo input não
   *  pode ser as duas coisas. */
  const imageRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  /** Ações do agente abertas na folha (null = fechada) e qual delas está
   *  aberta no segundo nível. */
  const [tools, setTools] = useState<TurnAction[] | null>(null);
  const [toolAt, setToolAt] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = useRef<HTMLElement>(null);
  /** A função que publica a altura do composer — chamada pelo observer e por
   *  todo render. */
  const publicarRef = useRef<(() => void) | null>(null);
  /** O campo estava em foco quando a folha abriu? Só aí faz sentido devolver
   *  o foco quando ela fecha (quem abriu a folha sem estar escrevendo não quer
   *  o teclado subindo do nada). */
  const focoAntesDaFolha = useRef(false);
  /** rAF da medida de altura em voo (0 = nenhuma agendada). */
  const medindoRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Skill "Use" / sugestão: entra no rascunho, abaixo do que já estava escrito.
  useEffect(() => {
    if (!inject) return;
    setDraft((d) => (d.trim() ? `${d}\n\n${inject.text}` : inject.text));
    textareaRef.current?.focus({ preventScroll: true });
  }, [inject]);

  // Composer cresce com o texto. Mede com height:0 (altura definida) — com
  // `auto` o textarea é um flex item e pode ser medido esticado, o que fazia
  // o composer abrir tomando meia tela.
  //
  // O TETO vem de composerSize: 40% do que dá pra ver, não da tela inteira. E
  // o cálculo refaz quando a tela muda (teclado abrindo, aparelho girando) —
  // antes ele só dependia do texto, então uma altura calculada pra outra
  // largura ficava congelada depois de girar.
  // useLayoutEffect, não useEffect + rAF: a medida acontece ANTES da pintura,
  // então não existe o frame em que o campo aparece com a altura antiga. (E o
  // rAF simplesmente não roda quando a janela está oculta, o que deixava a
  // altura congelada ao voltar pro app.)
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const fit = () => {
      const max = composerMaxHeight(
        window.innerHeight,
        readKeyboardHeight(document),
        window.visualViewport?.height
      );
      // UMA fonte de verdade: o CSS lê esta var no max-height, então JS e CSS
      // não podem mais discordar sobre o teto.
      el.style.setProperty("--axxa-composer-max", `${max}px`);
      el.style.height = "0px";
      el.style.height = `${Math.min(el.scrollHeight, max)}px`;
    };
    // Medir custa um layout do documento INTEIRO. Por tecla, numa conversa de
    // 120 mensagens, isso media 46ms — digitar travava. Por FRAME, o layout é
    // o que ia acontecer de qualquer jeito, e teclas seguidas se juntam numa
    // medida só. A primeira medida (e as de resize, que são raras) continuam
    // síncronas, pra altura nunca aparecer errada num quadro.
    if (!el.style.height) fit();
    else if (!medindoRef.current) {
      medindoRef.current = window.requestAnimationFrame(() => {
        medindoRef.current = 0;
        fit();
      });
    }
    const vv = window.visualViewport;
    window.addEventListener("resize", fit);
    vv?.addEventListener("resize", fit);
    return () => {
      window.removeEventListener("resize", fit);
      vv?.removeEventListener("resize", fit);
    };
  }, [draft]);

  useEffect(
    () => () => {
      if (medindoRef.current) window.cancelAnimationFrame(medindoRef.current);
    },
    []
  );

  // As narrações ("Listed root — 7 items") de uma rodada JÁ TERMINADA saem da
  // conversa e vão pra folha, junto das tool calls: elas são o passo a passo,
  // e passo a passo é auditoria. A que ainda está rodando FICA — é ela que diz
  // que tem coisa acontecendo.
  const { hiddenIds, actionsByResponse } = useMemo(() => {
    const hiddenIds = new Set<string>();
    const actionsByResponse = new Map<string, TurnAction[]>();
    let bucket: ChatMessage[] = [];
    for (const m of messages) {
      if (m.type === "ai-comment" && m.activity) {
        bucket.push(m);
        hiddenIds.add(m.id);
        continue;
      }
      if (m.type === "ai-response") {
        const narradas: TurnAction[] = bucket
          .map((c) =>
            c.type === "ai-comment" && c.activity
              ? ({ kind: "activity", activity: c.activity } as TurnAction)
              : null
          )
          .filter((a): a is TurnAction => a !== null);
        const passos: TurnAction[] = (m.agentSteps ?? []).map((step) => ({
          kind: "step",
          step,
        }));
        const todas = [...narradas, ...passos];
        if (todas.length > 0) actionsByResponse.set(m.id, todas);
        for (const c of bucket) hiddenIds.add(c.id);
        bucket = [];
      } else if (m.type === "user") {
        bucket = [];
      }
    }
    return { hiddenIds, actionsByResponse };
  }, [messages]);

  // A rodada EM CURSO: tudo que já aconteceu desde a última fala do usuário,
  // sem resposta ainda. Vira UMA linha "pensando" — não uma pilha de
  // narrações, que é o que empurrava a conversa pra fora da tela.
  const liveTurn = useMemo(() => {
    const bucket: TurnAction[] = [];
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.type === "ai-response" || m.type === "user") break;
      if (m.type === "ai-comment" && m.activity) {
        bucket.unshift({ kind: "activity", activity: m.activity });
      }
    }
    return bucket;
  }, [messages]);

  // O indicador some quando o TEXTO começa a sair: a partir daí quem mostra
  // que tem coisa acontecendo é a própria resposta aparecendo.
  const ultima = messages[messages.length - 1];
  const jaEscrevendo =
    ultima?.type === "ai-response" &&
    ultima.id === streamingId &&
    ultima.content.length > 0;
  const pensandoAgora = (isLoading || liveTurn.length > 0) && !jaEscrevendo;

  // Quando esta espera começou — é daqui que sai o relógio da linha. Em ref
  // pra não reiniciar a cada render; zera quando a espera acaba.
  const desdeRef = useRef(0);
  if (pensandoAgora && desdeRef.current === 0) desdeRef.current = Date.now();
  if (!pensandoAgora && desdeRef.current !== 0) desdeRef.current = 0;
  const pensandoDesde = desdeRef.current || Date.now();
  // O rótulo é a ação MAIS RECENTE — é ela que está acontecendo agora.
  // ── acompanhar o fim, ou deixar a pessoa ler ────────────────────────────
  // A tela só corre atrás do texto novo enquanto o usuário está no fim. Subiu
  // pra reler? Fica parado onde ele deixou até ele voltar — antes, cada pedaço
  // de resposta o arrancava de volta pro rodapé.
  const [seguindo, setSeguindo] = useState(true);
  /** Em ref também: os observers são registrados uma vez e não podem ler um
   *  `seguindo` velho. */
  const seguindoRef = useRef(true);
  seguindoRef.current = seguindo;
  /** Resposta que terminou LONGE dos olhos — é ela que acende. */
  const [avisoId, setAvisoId] = useState<string | null>(null);

  /** Altura da conversa na última vez que olhamos — é ela que diz se o
   *  usuário estava no fim ANTES do texto novo entrar. */
  const alturaAnteriorRef = useRef(0);
  /** Tem dedo (ou roda) mexendo na rolagem agora? Enquanto tem, a tela NÃO
   *  desce sozinha. */
  const gestoRef = useRef(false);

  const stickToBottom = () => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  /**
   * O coração disto: decide, a cada mudança, se a tela desce ou fica.
   *
   * Roda no observer de conteúdo, no effect das mensagens e na rolagem — as
   * três levam à MESMA conta, feita sobre o DOM na hora. Não há estado
   * paralelo pra dessincronizar, e não depende do evento de scroll chegar.
   */
  const reavaliar = () => {
    const el = scrollRef.current;
    if (!el) return;
    // Conversa VAZIA é a tela do módulo, não um fio pra acompanhar: ela cresce
    // pra baixo com as conversas gravadas, e a lógica de seguir o fim entendia
    // esse crescimento como mensagem nova — a tela abria rolada até o último
    // item, com a saudação e o seletor de modo fora de vista.
    if (useChatStore.getState().messages.length === 0) {
      alturaAnteriorRef.current = el.scrollHeight;
      return;
    }
    const { pin, seguindo: noFim } = decideScroll({
      gesto: gestoRef.current,
      alturaAnterior: alturaAnteriorRef.current,
      alturaAtual: el.scrollHeight,
      scrollTop: el.scrollTop,
      clientHeight: el.clientHeight,
    });
    if (pin) el.scrollTop = el.scrollHeight;
    alturaAnteriorRef.current = el.scrollHeight;
    if (noFim !== seguindoRef.current) {
      seguindoRef.current = noFim;
      setSeguindo(noFim);
    }
    if (noFim) setAvisoId(null);
  };

  /** Volta pro fim e volta a acompanhar (o toque no aviso e o envio). */
  const voltarPraBaixo = () => {
    gestoRef.current = false;
    seguindoRef.current = true;
    setSeguindo(true);
    setAvisoId(null);
    stickToBottom();
    const el = scrollRef.current;
    if (el) alturaAnteriorRef.current = el.scrollHeight;
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    alturaAnteriorRef.current = el.scrollHeight;
    // Conteúdo mudando: o markdown é renderizado com atraso (throttle), então
    // a altura cresce DEPOIS do render do React — o effect de `messages`
    // sozinho chegaria cedo demais.
    const obs = new MutationObserver(reavaliar);
    obs.observe(el, { childList: true, subtree: true, characterData: true });

    // ── o gesto ────────────────────────────────────────────────────────────
    // O dedo sai da tela mas a inércia continua: quem diz que o gesto acabou é
    // a rolagem PARAR, não o touchend. Por isso o cronômetro reinicia a cada
    // evento de rolagem enquanto ele está armado.
    let assentar = 0;
    const comecarGesto = () => {
      gestoRef.current = true;
      window.clearTimeout(assentar);
      assentar = 0;
    };
    const terminarGesto = () => {
      window.clearTimeout(assentar);
      assentar = window.setTimeout(() => {
        assentar = 0;
        gestoRef.current = false;
        reavaliar();
      }, 320);
    };
    const aoRolar = () => {
      // Rolando com o cronômetro armado = inércia viva: adia o veredito.
      if (assentar) terminarGesto();
      reavaliar();
    };

    el.addEventListener("scroll", aoRolar, { passive: true });
    el.addEventListener("touchstart", comecarGesto, { passive: true });
    el.addEventListener("touchend", terminarGesto, { passive: true });
    el.addEventListener("touchcancel", terminarGesto, { passive: true });
    el.addEventListener("wheel", comecarGesto, { passive: true });
    el.addEventListener("wheel", terminarGesto, { passive: true });
    const mouseDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") comecarGesto();
    };
    const mouseUp = (e: PointerEvent) => {
      if (e.pointerType !== "touch") terminarGesto();
    };
    el.addEventListener("pointerdown", mouseDown);
    window.addEventListener("pointerup", mouseUp);

    return () => {
      obs.disconnect();
      window.clearTimeout(assentar);
      el.removeEventListener("scroll", aoRolar);
      el.removeEventListener("touchstart", comecarGesto);
      el.removeEventListener("touchend", terminarGesto);
      el.removeEventListener("touchcancel", terminarGesto);
      el.removeEventListener("wheel", comecarGesto);
      el.removeEventListener("wheel", terminarGesto);
      el.removeEventListener("pointerdown", mouseDown);
      window.removeEventListener("pointerup", mouseUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(reavaliar, [messages, streamingId]);

  // O composer flutua sobre a conversa, então a área de mensagens precisa
  // saber a altura dele pra reservar espaço embaixo. Ela MUDA o tempo todo
  // (anexo, fila, campo crescendo, modo de voz), então é medida, não chutada.
  useEffect(() => {
    const el = composerRef.current;
    const raiz = el?.closest(".axxa-root") as HTMLElement | null;
    if (!el || !raiz) return;
    const publicar = () => {
      // A ALTURA dele: é o quanto a conversa precisa avançar por baixo (margem
      // negativa) e devolver por dentro (padding).
      raiz.style.setProperty(
        "--axxa-composer-h",
        `${Math.max(0, Math.round(el.getBoundingClientRect().height))}px`
      );
      // Cresceu embaixo de quem estava no fim: desce junto.
      reavaliar();
    };
    publicarRef.current = publicar;
    publicar();
    const obs = new ResizeObserver(publicar);
    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // O observer só entrega no ciclo de pintura — com a janela oculta ele não
  // roda, e a reserva ficava velha. Medir também a CADA render cobre o que
  // muda por estado (anexo, fila, modo de voz) sem depender disso.
  useLayoutEffect(() => {
    publicarRef.current?.();
  });

  // Trocar de conversa (ou abrir uma nova) começa no fim, acompanhando: o
  // estado de leitura era da conversa anterior. Sem isto, abrir outro chat
  // depois de ter subido pra ler deixava a tela parada no meio dele.
  //
  // Conversa VAZIA é o contrário: é a tela do módulo, e ela começa EM CIMA —
  // na saudação e no seletor, com as conversas gravadas logo abaixo. Ir pro
  // fim ali é abrir na última linha da lista.
  useEffect(() => {
    if (useChatStore.getState().messages.length === 0) {
      gestoRef.current = false;
      seguindoRef.current = true;
      setSeguindo(true);
      setAvisoId(null);
      const el = scrollRef.current;
      if (el) {
        el.scrollTop = 0;
        alturaAnteriorRef.current = el.scrollHeight;
      }
      return;
    }
    voltarPraBaixo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChatId]);

  // Terminou de responder enquanto a pessoa estava lendo lá em cima: a
  // mensagem acende e o aviso aparece. Sem isso, a resposta fica pronta e
  // ninguém avisa — o usuário volta do nada pra conferir.
  const respondendoRef = useRef(false);
  useEffect(() => {
    const respondendoAgora = isLoading || streamingId !== null;
    const terminou = respondendoRef.current && !respondendoAgora;
    respondendoRef.current = respondendoAgora;
    if (!terminou) return;
    if (seguindoRef.current) return;
    const ultima = [...messages]
      .reverse()
      .find((m) => m.type === "ai-response");
    if (!ultima) return;
    setAvisoId(ultima.id);
    // O aviso é visual E tátil: quem está lendo não está olhando pro rodapé.
    commit();
  }, [isLoading, streamingId, messages]);

  const mostrarAviso = shouldShowJump(
    seguindo,
    isLoading || streamingId !== null,
    avisoId !== null
  );

  // Teclado abrindo: a área da conversa encolhe, então reancora no fim
  // depois da animação (o inset em si é do useKeyboardInset).
  const onComposerFocus = () => {
    if (!seguindoRef.current) return;
    stickToBottom();
    window.setTimeout(stickToBottom, 350);
  };

  /** Reavalia se o cursor está dentro de um `[[` aberto. Roda a cada digitada
   *  e a cada movimento do cursor — sair de dentro do link fecha a lista. */
  const conferirMencao = (el: HTMLTextAreaElement) => {
    const achou = wikilinkQuery(el.value, el.selectionStart ?? el.value.length);
    setMention(achou);
  };

  /** Escolher na lista do `[[`: troca o que foi digitado pelo wikilink E
   *  anexa a nota — citar sem mandar o conteúdo junto seria só um texto. */
  const escolherMencao = (n: NoteLike) => {
    const el = textareaRef.current;
    if (!el || !mention) return;
    const cursor = el.selectionStart ?? draft.length;
    const link = `[[${n.path.replace(/\.md$/, "")}]]`;
    const antes = draft.slice(0, mention.start);
    const novo = antes + link + draft.slice(cursor);
    setDraft(novo);
    setMention(null);
    void anexarNota(n.path);
    // O cursor vai pra DEPOIS do link, senão a pessoa continua digitando
    // dentro do que acabou de inserir. Depois do commit do React.
    const fim = antes.length + link.length;
    window.setTimeout(() => {
      el.focus({ preventScroll: true });
      el.setSelectionRange(fim, fim);
    }, 0);
  };

  /** Tocou num provider que ainda não está ligado. O primeiro toque explica
   *  em uma linha; o segundo, já que a pessoa insistiu, abre o caminho — sem
   *  transformar cada toque errado num modal. */
  const aoTocarBloqueado = async (
    id: string,
    motivo: string,
    insistiu: boolean
  ) => {
    const nome = PROVIDERS.find((p) => p.id === id)?.name ?? id;
    if (!insistiu) {
      new Notice(`${nome} — ${motivo}`);
      return;
    }
    const ir = await new ConfirmModal(plugin.app, {
      title: `${nome} is not set up`,
      body: `${motivo}

Open Settings › Providers to add it, then run the connection test.`,
      confirmLabel: "Open settings",
    }).openAndWait();
    if (ir) {
      closeSheet();
      openPluginSettings(plugin);
    }
  };

  /** PDF: vai como anexo mesmo quando o modelo não lê — nesse caso o motor
   *  registra o arquivo na conversa em vez de mandar, e o aviso já apareceu na
   *  linha do menu. */
  const anexarPdf = (file: File) => {
    const leitor = new FileReader();
    leitor.onload = () => {
      const dataUrl = String(leitor.result ?? "");
      if (!dataUrl.startsWith("data:")) return;
      addAttachment({ type: "pdf", name: file.name, dataUrl });
    };
    leitor.onerror = () => new Notice("Could not read that file.");
    leitor.readAsDataURL(file);
  };

  /** Link: busca a página e anexa o TEXTO dela. Sem isto, colar uma URL só
   *  dava ao modelo o endereço — e ele não navega. */
  const anexarLink = async () => {
    const digitado = await new PromptModal(plugin.app, {
      title: "Attach link",
      label: "Address",
      placeholder: "https://…",
      submitLabel: "Fetch",
    }).openAndWait();
    const url = normalizeUrl(digitado ?? "");
    if (!url) {
      if (digitado) new Notice("That doesn't look like an address.");
      return;
    }
    const aviso = new Notice(`Fetching ${url}…`, 0);
    try {
      // `requestUrl` do Obsidian: sem CORS, que é o que faz isso funcionar no
      // celular.
      const res = await requestUrl({ url });
      const texto = htmlToText(res.text ?? "");
      if (!texto) {
        new Notice("Nothing readable at that address.");
        return;
      }
      addAttachment(linkNote(url, htmlTitle(res.text ?? ""), texto));
    } catch {
      new Notice("Could not reach that address.");
    } finally {
      aviso.hide();
    }
  };

  /** Artefato: o que o plugin gerou volta pra conversa. Imagem vira anexo de
   *  imagem de verdade (o modelo VÊ); o resto entra como referência. */
  const anexarArtefato = async (a: ArtifactLike) => {
    try {
      if (isImageExt(a.extension) && modeloVeImagem) {
        const bin = await plugin.app.vault.adapter.readBinary(a.path);
        const mime = a.extension.toLowerCase() === "png" ? "image/png" : "image/jpeg";
        addAttachment({
          type: "image",
          dataUrl: `data:${mime};base64,${arrayBufferToBase64(bin)}`,
          mimeType: mime,
          name: `${a.basename}.${a.extension}`,
        });
        return;
      }
      addAttachment({
        type: "note",
        path: a.path,
        content: `Arquivo gerado pelo plugin: ${a.path}`,
      });
    } catch {
      new Notice("Could not read that file.");
    }
  };

  /** Colar. Duas coisas que o campo não fazia:
   *   - imagem da área de transferência (print) vira anexo
   *   - bloco grande vira anexo em vez de virar parede de texto */
  const aoColar = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const dados = e.clipboardData;
    if (!dados) return;

    const imagens = Array.from(dados.files ?? []).filter((f) =>
      f.type.startsWith("image/")
    );
    if (imagens.length > 0) {
      e.preventDefault();
      if (!modeloVeImagem) {
        new Notice("This model can't read images.");
        return;
      }
      for (const img of imagens) anexarImagem(img);
      return;
    }

    const texto = dados.getData("text");
    if (pasteIsBig(texto)) {
      e.preventDefault();
      addAttachment(pastedNote(texto));
    }
  };

  /** Anexa uma nota do vault (lida agora — é o conteúdo que vai no prompt). */
  const anexarNota = async (path: string) => {
    const nota = await readNote(plugin.app, path);
    if (!nota) {
      new Notice(`Note not found: ${path}`);
      return;
    }
    addAttachment({ type: "note", path: nota.path, content: nota.content });
  };

  /** Imagem do aparelho: vira data URL, que é o formato que os providers
   *  multimodais aceitam. */
  const anexarImagem = (file: File) => {
    const leitor = new FileReader();
    leitor.onload = () => {
      const dataUrl = String(leitor.result ?? "");
      if (!dataUrl.startsWith("data:")) return;
      addAttachment({
        type: "image",
        dataUrl,
        mimeType: file.type || undefined,
        name: file.name,
      });
    };
    leitor.onerror = () => new Notice("Could not read that image.");
    leitor.readAsDataURL(file);
  };

  // Identidade ESTÁVEL: uma arrow nova a cada render derrubaria o memo da
  // MessageRow, que é o ponto todo do item.
  const abrirAcoes = useCallback((acoes: TurnAction[]) => {
    setTools(acoes);
    // Lista de UM item é uma parada a mais sem informação: abre direto no
    // detalhe.
    setToolAt(acoes.length === 1 ? 0 : null);
  }, []);

  const submit = async () => {
    const text = draft.trim();
    if (!text) return;
    // Mandar (ou enfileirar) é dizer "acabei de ler, estou aqui embaixo": a
    // tela volta pro fim, senão a mensagem recém-escrita — e o chip da fila —
    // nascem fora do campo de visão.
    voltarPraBaixo();
    // Escrever durante a resposta não pode ser um clique no vazio: a mensagem
    // entra na FILA e sai sozinha quando a rodada terminar.
    if (isLoading) {
      commit();
      pushQueued(text);
      writeDraft(draftKey, "");
      return;
    }
    commit();
    // A chave é lida AGORA: o 1º envio de uma conversa nova ganha um id no meio
    // do send, e limpar depois apagaria o rascunho da conversa errada.
    const chave = draftKey;
    // Limpa NA HORA. `send()` só resolve quando a rodada INTEIRA termina — se
    // a limpeza esperar por isso, o texto fica no campo durante toda a
    // resposta e, quando ela acaba, apaga o que a pessoa escreveu no meio.
    writeDraft(chave, "");
    const foi = await session.send(text);
    // Devolve se o envio nem engatou (sem key na 1ª mensagem, por exemplo).
    // Essa desistência é síncrona, então a volta é imediata — e só acontece se
    // o campo continuar vazio, pra não passar por cima de outra frase.
    if (!foi && !(useChatStore.getState().drafts[chave] ?? "").trim()) {
      writeDraft(chave, text);
    }
  };

  // Abrir uma sheet tira o foco do campo — senão o teclado sobe por cima dela.
  const openSheet = (which: "model" | "effort" | "plus") => {
    focoAntesDaFolha.current =
      document.activeElement === textareaRef.current;
    textareaRef.current?.blur();
    // A folha de modelos abre sempre no provider da sessão, e no primeiro nível.
    if (which === "model") {
      setPickProvider(cfg.provider);
      setModelView("root");
    }
    if (which === "plus") {
      setPlusView("root");
      setNoteQuery("");
    }
    setSheet(which);
  };
  const closeSheet = () => {
    setSheet(null);
    // Volta pra onde a pessoa estava: escolher um modelo no meio de uma frase
    // não pode custar um toque a mais pra continuar escrevendo.
    if (focoAntesDaFolha.current) {
      focoAntesDaFolha.current = false;
      window.setTimeout(
        () => textareaRef.current?.focus({ preventScroll: true }),
        0
      );
    }
  };

  // A lista de notas do "+" (e, mais pra frente, do `[[`). Só calcula quando a
  // folha está aberta nesse nível — varrer o vault a cada render seria caro
  // num vault grande.
  const notasAchadas = useMemo(() => {
    if (sheet !== "plus" || plusView !== "notes") return [];
    return rankNotes(vaultNotes(plugin.app), noteQuery);
  }, [sheet, plusView, noteQuery, plugin.app]);

  /** Sugestões do `[[` — poucas, porque elas cobrem a conversa. */
  const mentionHits = useMemo(
    () => (mention ? rankNotes(vaultNotes(plugin.app), mention.query, 6) : []),
    [mention, plugin.app]
  );

  /** O que ESTE modelo aceita como entrada. Imagem e PDF não somem do menu
   *  quando ele não lê — aparecem indisponíveis, que é diferente de não
   *  existir. */
  const caps = getModelCapabilities(cfg.provider, cfg.model);
  const modeloVeImagem =
    caps.vision ||
    getModelCard(cfg.provider, cfg.model).category === "chat-vision";
  const modeloLePdf = caps.pdf === true;

  /** O que o próprio plugin gerou (imagens, áudio, vídeo). */
  const artefatos = useMemo(() => {
    if (sheet !== "plus" || plusView !== "artifacts") return [];
    return rankArtifacts(vaultArtifacts(plugin.app));
  }, [sheet, plusView, plugin.app]);

  // Os dois blocos do cartão de modelos. Favoritar já implica Show, então o
  // segundo bloco tira os favoritos pra ninguém aparecer duas vezes.
  const favorites = (
    plugin.settings.favoriteModels?.[pickProvider] ?? []
  ).slice(0, 5);
  const rest = session
    .modelOptions(pickProvider)
    .filter((m) => !favorites.includes(m));

  // ── modo de voz ─────────────────────────────────────────────────────────
  // O gravador mora em useVoice; aqui fica só o GESTO do botão (segurar pra
  // gravar, arrastar pra cancelar, pra cima pra travar) e o rascunho.
  // O texto reconhecido aparece ACIMA do dock enquanto se fala (é o que a
  // referência faz) e só vira rascunho quando a gravação termina. Antes ele ia
  // direto pro textarea — que fica colapsado durante a gravação, então ninguém
  // via nada enquanto falava.
  const voice = useVoice({
    apiKey: () => plugin.providerCredential("openai"),
    model: () => plugin.settings.voiceModel,
    language: () => plugin.settings.voiceLanguage,
    onTranscript: setLiveText,
    // Acabou a gravação: o texto entra no rascunho, depois do que já estava
    // escrito. Quem avisa é o hook, num aviso só — ver `onFinal`.
    onFinal: (texto) => {
      setLiveText("");
      if (!texto) return;
      setDraft((d) => (d.trim() ? `${d.trim()} ${texto}` : texto));
    },
    onNotice: (m) => {
      new Notice(m);
    },
    onCancel: () => setLiveText(""),
  });

  // Um CLIQUE começa a gravar; o dock cuida do resto (✕ joga fora, ✓ usa o
  // texto). O gesto de segurar/arrastar saiu: dependia de o microfone abrir
  // antes do dedo sair, e essa corrida travava a tela no aparelho.
  //
  // A troca começa NO CLIQUE, não quando o gravador fica pronto: abrir o
  // microfone ocupa a thread principal, e a animação de altura é main-thread —
  // disparada junto, ela era atropelada e virava um pulo. Assim ela roda
  // enquanto o microfone abre, e o dock já aparece (onda parada) de imediato.
  const [arming, setArming] = useState(false);
  const startVoice = async () => {
    if (arming || voice.state !== "idle") return;
    setLiveText("");
    setArming(true);
    screen();
    const ok = await voice.start();
    if (!ok) {
      setArming(false);
      warn();
    }
  };
  useEffect(() => {
    if (voice.state === "idle") setArming(false);
  }, [voice.state]);

  /** Tocar num modelo comita as DUAS coisas: o provider da folha e o modelo. */
  const chooseModel = (model: string) => {
    if (pickProvider !== cfg.provider) session.setProvider(pickProvider);
    session.setModel(model);
    closeSheet();
  };

  const empty = messages.length === 0 && !loadingChat;
  const effort = cfg.effort as EffortLevel;

  return (
    <div className="axxa-chat">
      <header className="axxa-topbar">
        <button
          type="button"
          className="axxa-icon-btn"
          aria-label="Open menu"
          onClick={onOpenMenu}
        >
          <Icon name="menu" />
        </button>
        <div className="axxa-topbar-title">
          <span className="axxa-topbar-name">
            {currentChatId ? currentChatTitle || "Untitled" : "New chat"}
          </span>
          {locked && (
            <span className="axxa-topbar-meta">
              {moduleLabel(cfg.mode)} · {cfg.model}
            </span>
          )}
        </div>
        <button
          type="button"
          className="axxa-icon-btn"
          aria-label="New chat"
          disabled={empty && !currentChatId}
          onClick={() => session.newChat()}
        >
          <Icon name="square-pen" />
        </button>
      </header>

      <div className="axxa-messages" ref={scrollRef}>
        {loadingChat && <p className="axxa-empty-line">Loading…</p>}
        {empty ? (
          <StarterScreen
            plugin={plugin}
            session={session}
            moduloExterno={moduloExterno}
            onSairDoExterno={onSairDoExterno}
          />
        ) : (
          messages
            .filter((m) => !hiddenIds.has(m.id))
            .map((m) => (
            <MessageRow
              key={m.id}
              msg={m}
              plugin={plugin}
              streaming={m.id === streamingId}
              glow={m.id === avisoId}
              actions={actionsByResponse.get(m.id)}
              onOpenTools={abrirAcoes}
            />
          ))
        )}

        {/* O "pensando": UMA linha — o asterisco que respira, o tempo e o
            verbo da vez. Enquanto a rodada corre é ela que diz que tem coisa
            acontecendo; quando a resposta chega ela sai e o chip da mensagem
            assume. O que rodou fica a um toque, na folha. */}
        {pensandoAgora && (
          <ThinkingLine
            count={liveTurn.length}
            since={pensandoDesde}
            onOpen={() => {
              if (liveTurn.length === 0) return;
              setTools(liveTurn);
              setToolAt(liveTurn.length === 1 ? 0 : null);
            }}
          />
        )}
      </div>

      {/* Composer: UM bloco só — campo em cima, barra de controles embaixo,
          sem régua horizontal separando nada. */}
      <section className="axxa-composer" ref={composerRef}>
          {/* Quem subiu pra ler precisa de um caminho de volta — e de saber que
              a resposta ficou pronta lá embaixo. Ancorado no composer (que é
              position: relative), flutuando logo acima dele. */}
          {mostrarAviso && (
            <button
              type="button"
              className={avisoId ? "axxa-jump is-done" : "axxa-jump"}
              onClick={voltarPraBaixo}
            >
              <Icon name="arrow-down" size={15} />
              {avisoId ? "Answer ready" : "Jump to latest"}
            </button>
          )}
          {/* `[[` — as notas aparecem ACIMA do campo, como no editor do
              Obsidian. Escolher insere o link e anexa a nota. Fica dentro do
              composer pra subir junto com ele quando o teclado abre. */}
          {mention && mentionHits.length > 0 && (
            <div className="axxa-mention">
              {mentionHits.map((n) => (
                <button
                  key={n.path}
                  type="button"
                  className="axxa-mention-row"
                  // mousedown antes do blur: o blur fecharia a lista antes do
                  // clique chegar.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    escolherMencao(n);
                  }}
                >
                  <Icon name="file-text" size={15} />
                  <span className="axxa-mention-name">{n.basename}</span>
                  <span className="axxa-mention-path">{n.path}</span>
                </button>
              ))}
            </div>
          )}
          {/* A TROCA: o composer de texto desce e o dock de áudio sobe no
              lugar. As duas linhas do grid (1fr/0fr) animam a altura — é o que
              faz um encolher enquanto o outro cresce, em vez de um sumir e o
              outro aparecer. */}
          {/* Os anexos e a fila ficam ACIMA do cartão, não dentro dele: o
              cartão é onde se escreve, e o que vai junto da mensagem é outra
              coisa. Cada um mostra a MINIATURA de verdade quando tem o que
              mostrar; senão, o emoji do que ele é. */}
          {(attachments.length > 0 || queued.length > 0) && (
            <div className="axxa-pills-row">
              {queued.map((q, i) => (
                <span className="axxa-pill-chip is-queued" key={`q${i}`}>
                  <Icon name="clock" size={14} />
                  <span className="axxa-pill-chip-label">{q}</span>
                  <button
                    type="button"
                    className="axxa-pill-chip-x"
                    aria-label="Cancel queued message"
                    onClick={() => {
                      removeQueued(i);
                      setDraft((d) => (d.trim() ? d : q));
                    }}
                  >
                    <Icon name="x" size={13} />
                  </button>
                </span>
              ))}
              {attachments.map((a, i) => {
                const thumb = attachmentThumb(a);
                return (
                  <span className="axxa-pill-chip" key={`a${i}`}>
                    {thumb.kind === "image" ? (
                      <img
                        className="axxa-pill-chip-thumb"
                        src={thumb.url}
                        alt=""
                      />
                    ) : (
                      <span className="axxa-pill-chip-emoji" aria-hidden="true">
                        {thumb.char}
                      </span>
                    )}
                    <span className="axxa-pill-chip-label">
                      {attachmentLabel(a)}
                    </span>
                    <button
                      type="button"
                      className="axxa-pill-chip-x"
                      aria-label="Remove attachment"
                      onClick={() => removeAttachment(i)}
                    >
                      <Icon name="x" size={13} />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          <div
            className="axxa-swap"
            data-mode={voice.state !== "idle" || arming ? "voice" : "text"}
          >
            <div className="axxa-swap-row">
            <div className="axxa-input">
              {/* O que vai junto da mensagem. Fica ACIMA do texto porque é
                  contexto do que está sendo escrito — e cada um sai com um
                  toque, senão anexar vira armadilha. */}
              <textarea
                ref={textareaRef}
                rows={1}
                value={draft}
                placeholder={modulePlaceholder(cfg.mode)}
                onFocus={onComposerFocus}
                onChange={(e) => {
                  setDraft(e.currentTarget.value);
                  conferirMencao(e.currentTarget);
                }}
                onSelect={(e) => conferirMencao(e.currentTarget)}
                onPaste={aoColar}
                onBlur={() => setMention(null)}
                onKeyDown={(e) => {
                  // Com a lista do `[[` aberta, Esc fecha ela — não o teclado.
                  if (e.key === "Escape" && mention) {
                    e.preventDefault();
                    setMention(null);
                    return;
                  }
                  if (e.key !== "Enter") return;
                  // Enter com a lista aberta ESCOLHE (é o que o editor do
                  // Obsidian faz) — mandar a mensagem no meio de um `[[` seria
                  // mandar o link pela metade.
                  if (mention && mentionHits.length > 0) {
                    e.preventDefault();
                    escolherMencao(mentionHits[0]);
                    return;
                  }
                  if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    void submit();
                    return;
                  }
                  // Acento/IME/teclado de swipe compõem texto e mandam Enter no
                  // meio: enviar aí cortaria a palavra. `isComposing` é o sinal
                  // padrão pra isso.
                  if (e.nativeEvent.isComposing) return;
                  // No celular Enter é quebra de linha e quem envia é o botão;
                  // no desktop é o contrário, com Shift+Enter pra quebrar.
                  if (!Platform.isMobile && !e.shiftKey) {
                    e.preventDefault();
                    void submit();
                  }
                }}
              />

              {/* + à esquerda, o modelo ao lado, e à direita voz e enviar. */}
              <div className="axxa-input-bar">
                <button
                  type="button"
                  className="axxa-round-btn"
                  aria-label="Add to chat"
                  onClick={() => openSheet("plus")}
                >
                  <Icon name="plus" size={22} />
                </button>
                {/* Seletores nativos: galeria, câmera e PDF. */}
                <input
                  ref={imageRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const f = e.currentTarget.files?.[0];
                    if (f) anexarImagem(f);
                    e.currentTarget.value = "";
                  }}
                />
                <input
                  ref={cameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  hidden
                  onChange={(e) => {
                    const f = e.currentTarget.files?.[0];
                    if (f) anexarImagem(f);
                    e.currentTarget.value = "";
                  }}
                />
                <input
                  ref={pdfRef}
                  type="file"
                  accept="application/pdf"
                  hidden
                  onChange={(e) => {
                    const f = e.currentTarget.files?.[0];
                    if (f) anexarPdf(f);
                    e.currentTarget.value = "";
                  }}
                />

                <div className="axxa-pills">
                  <Pill
                    label={prettyModelName(cfg.model) || "no model"}
                    logo={
                      PROVIDERS.find((p) => p.id === cfg.provider)?.icon
                    }
                    onClick={() => openSheet("model")}
                  />
                </div>

                {plugin.settings.voiceEnabled && (
                  <button
                    type="button"
                    className="axxa-round-btn"
                    aria-label="Voice mode"
                    onClick={() => void startVoice()}
                  >
                    <Icon name="mic" size={20} />
                  </button>
                )}

                {isLoading ? (
                  <>
                    {/* Com texto escrito durante a resposta, aparece um segundo
                        botão: enfileirar. Sem ele o celular não teria como —
                        o lugar do enviar está ocupado pelo parar. */}
                    {draft.trim() && (
                      <button
                        type="button"
                        className="axxa-round-btn"
                        aria-label="Send when this finishes"
                        onPointerDown={(e) => e.preventDefault()}
                        onClick={() => void submit()}
                      >
                        <Icon name="arrow-up" size={20} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="axxa-send is-stop"
                      aria-label="Stop"
                      onPointerDown={(e) => e.preventDefault()}
                      onClick={() => session.stop()}
                    >
                      <Icon name="square" size={18} />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="axxa-send"
                    aria-label="Send"
                    disabled={!draft.trim()}
                    // Sem isto o toque tira o foco do campo e o Android fecha o
                    // teclado a cada mensagem enviada.
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => void submit()}
                  >
                    <Icon name="arrow-up" size={20} />
                  </button>
                )}
              </div>
            </div>
            </div>

            <div className="axxa-swap-row">
              <div className="axxa-voice-side">
                {liveText && <p className="axxa-voice-live">{liveText}</p>}
                <VoiceDock voice={voice} />
              </div>
            </div>
          </div>
      </section>

      {/* Bottom sheets do composer — modelo · effort. */}
      {/* Dois níveis na MESMA folha, como o app da Claude: em cima os
          favoritos (o atalho), e "Show list" é uma linha que abre a lista
          inteira aqui dentro — com seta pra voltar. Sem favorito não há de
          onde descer, então a lista já vem no primeiro nível. */}
      <Sheet
        title={MODEL_SHEET_TITLE[modelView]}
        open={sheet === "model"}
        onClose={closeSheet}
        onBack={modelView === "root" ? undefined : () => setModelView("root")}
      >
        {modelView === "root" && !locked && (
          <SheetSeg
            label="Provider"
            activeId={pickProvider}
            onPick={setPickProvider}
            onBlocked={aoTocarBloqueado}
            items={PROVIDERS.map((p) => ({
              id: p.id,
              icon: p.icon,
              label: p.name,
              health: providerHealth(plugin, p.id),
              blocked: providerBlockedReason(plugin, p.id),
            }))}
          />
        )}

        {modelView === "effort" ? (
          <SheetGroup>
            {EFFORT_LEVELS.map((l) => (
              <SheetRow
                key={l}
                title={EFFORT_LABELS[l]}
                note={EFFORT_DESCRIPTIONS[l]}
                tag={l === plugin.settings.defaultEffort ? "Default" : undefined}
                selected={l === cfg.effort}
                onClick={() => {
                  session.setEffort(l);
                  closeSheet();
                }}
              />
            ))}
          </SheetGroup>
        ) : modelView === "list" ? (
          <SheetGroup>
            {rest.map((m) => (
              <ModelRow
                key={m}
                provider={pickProvider}
                model={m}
                selected={m === cfg.model && pickProvider === cfg.provider}
                onClick={() => chooseModel(m)}
              />
            ))}
          </SheetGroup>
        ) : (
          <>
            {locked ? (
              <SheetGroup>
                <SheetNote>
                  This chat is locked to {prettyModelName(cfg.model)} — start a
                  new chat to pick another model. Effort still changes freely.
                </SheetNote>
              </SheetGroup>
            ) : (
            <SheetGroup>
              {(favorites.length > 0 ? favorites : rest).map((m) => (
                <ModelRow
                  key={m}
                  provider={pickProvider}
                  model={m}
                  selected={m === cfg.model && pickProvider === cfg.provider}
                  onClick={() => chooseModel(m)}
                />
              ))}
              {favorites.length === 0 && rest.length === 0 && (
                <SheetNote>
                  Nothing marked to show for this provider yet — pick what
                  appears here in Settings → Providers.
                </SheetNote>
              )}
            </SheetGroup>
            )}
            {/* Navegação num cartão só, abaixo dos modelos: a lista inteira e
                o effort. Os dois abrem OUTRO nível desta mesma folha. */}
            <SheetGroup>
              {!locked && favorites.length > 0 && rest.length > 0 && (
                <SheetNavRow
                  title="Show list"
                  note={`${rest.length} more ${
                    rest.length === 1 ? "model" : "models"
                  }`}
                  onClick={() => setModelView("list")}
                />
              )}
              <SheetNavRow
                icon="timer"
                title="Effort"
                note={EFFORT_LABELS[effort] ?? cfg.effort}
                onClick={() => setModelView("effort")}
              />
            </SheetGroup>
          </>
        )}
      </Sheet>

      {/* O "+" abre o que dá pra ACRESCENTAR à conversa. Hoje são as skills —
          o mesmo atalho da tela inicial, alcançável no meio do papo. */}
      {/* O "+": três caminhos grandes em cima (nota, câmera, imagem) e o
          resto em lista — PDF, link, skill, artefato. Desenho da referência:
          cartões vazados na fileira, e as linhas num cartão cheio com brasão
          redondo e seta. */}
      <Sheet
        title={PLUS_SHEET_TITLE[plusView]}
        open={sheet === "plus"}
        onClose={closeSheet}
        onBack={plusView === "root" ? undefined : () => setPlusView("root")}
      >
        {plusView === "notes" ? (
          <>
            <SheetSearch
              value={noteQuery}
              placeholder="Search notes…"
              onChange={setNoteQuery}
            />
            <SheetGroup>
              {notasAchadas.map((n) => (
                <SheetRow
                  key={n.path}
                  dense
                  icon="file-text"
                  title={n.basename}
                  note={n.path}
                  onClick={() => {
                    void anexarNota(n.path);
                    closeSheet();
                  }}
                />
              ))}
              {notasAchadas.length === 0 && (
                <SheetNote>No note matches that.</SheetNote>
              )}
            </SheetGroup>
          </>
        ) : plusView === "skills" ? (
          <SheetGroup>
            {plugin.skills.map((sk) => (
              <SheetRow
                key={sk.id}
                title={sk.name}
                note={sk.description}
                onClick={() => {
                  onUseSkill(sk);
                  closeSheet();
                }}
              />
            ))}
            {plugin.skills.length === 0 && (
              <SheetNote>
                No skills yet — they live as notes in your vault, and show up
                here once you create one.
              </SheetNote>
            )}
          </SheetGroup>
        ) : plusView === "artifacts" ? (
          <SheetGroup>
            {artefatos.map((a) => (
              <SheetRow
                key={a.path}
                dense
                icon={artifactIcon(a.extension)}
                title={a.basename}
                note={a.path}
                onClick={() => {
                  void anexarArtefato(a);
                  closeSheet();
                }}
              />
            ))}
            {artefatos.length === 0 && (
              <SheetNote>
                Nothing generated yet — images, audio and video made here land
                in {GENERATION_DIR} and show up in this list.
              </SheetNote>
            )}
          </SheetGroup>
        ) : (
          <>
            <SheetTiles>
              <SheetTile
                icon="file-text"
                label="Notes"
                onClick={() => {
                  setNoteQuery("");
                  setPlusView("notes");
                }}
              />
              <SheetTile
                icon="camera"
                label="Camera"
                disabled={!modeloVeImagem}
                hint={modeloVeImagem ? undefined : "unavailable"}
                onClick={() => {
                  closeSheet();
                  cameraRef.current?.click();
                }}
              />
              <SheetTile
                icon="image"
                label="Image"
                disabled={!modeloVeImagem}
                hint={modeloVeImagem ? undefined : "unavailable"}
                onClick={() => {
                  closeSheet();
                  imageRef.current?.click();
                }}
              />
            </SheetTiles>

            <SheetGroup>
              <SheetRow
                badge
                chevron
                icon="file-type-2"
                title="PDF"
                note={
                  modeloLePdf
                    ? "From this device"
                    : "This model can't read PDFs"
                }
                onClick={() => {
                  closeSheet();
                  pdfRef.current?.click();
                }}
              />
              <SheetRow
                badge
                chevron
                icon="link"
                title="Link"
                note="Fetch a page as context"
                onClick={() => {
                  closeSheet();
                  void anexarLink();
                }}
              />
              <SheetRow
                badge
                chevron
                icon="sparkles"
                title="Skill"
                note={
                  plugin.skills.length > 0
                    ? `${plugin.skills.length} in your vault`
                    : "None yet"
                }
                onClick={() => setPlusView("skills")}
              />
              <SheetRow
                badge
                chevron
                icon="box"
                title="Artifact"
                note="Images, audio and video made here"
                onClick={() => setPlusView("artifacts")}
              />
            </SheetGroup>
          </>
        )}
      </Sheet>

      {/* O que o agente fez: lista numa folha, e cada ação abre a sua com
          argumentos e resultado — o mesmo vai-e-volta da folha de modelos. */}
      <Sheet
        title={
          toolAt !== null && tools
            ? actionTitle(tools[toolAt])
            : `Ran ${tools?.length ?? 0} ${
                (tools?.length ?? 0) === 1 ? "action" : "actions"
              }`
        }
        open={tools !== null}
        onClose={() => {
          setTools(null);
          setToolAt(null);
        }}
        onBack={
          toolAt !== null && (tools?.length ?? 0) > 1
            ? () => setToolAt(null)
            : undefined
        }
      >
        {toolAt !== null && tools ? (
          <ToolDetail action={tools[toolAt]} />
        ) : (
          <SheetGroup>
            {(tools ?? []).map((a, i) => (
              <SheetRow
                key={i}
                dense
                icon={actionIcon(a)}
                iconTone={actionFailed(a) ? "danger" : undefined}
                title={actionTitle(a)}
                note={actionNote(a)}
                tag={actionFailed(a) ? "failed" : undefined}
                onClick={() => setToolAt(i)}
              />
            ))}
          </SheetGroup>
        )}
      </Sheet>

      <Sheet title="Effort" open={sheet === "effort"} onClose={closeSheet}>
        <SheetGroup>
          {EFFORT_LEVELS.map((l) => (
            <SheetRow
              key={l}
              title={EFFORT_LABELS[l]}
              note={EFFORT_DESCRIPTIONS[l]}
              tag={l === plugin.settings.defaultEffort ? "Default" : undefined}
              selected={l === cfg.effort}
              onClick={() => {
                session.setEffort(l);
                closeSheet();
              }}
            />
          ))}
        </SheetGroup>
      </Sheet>
    </div>
  );
}

/** Linha de modelo: brasão da família + nome + o que ele faz. */
function ModelRow({
  provider,
  model,
  selected,
  onClick,
}: {
  provider: string;
  model: string;
  selected: boolean;
  onClick: () => void;
}) {
  const card = getModelCard(provider, model);
  return (
    <SheetRow
      title={prettyModelName(model)}
      note={card.goodFor ?? card.description}
      selected={selected}
      onClick={onClick}
    />
  );
}

/** O pill do modelo. O LOGO do provider no lugar do chevron: a seta dizia
 *  "isto abre" (que o toque já ensina na primeira vez), enquanto o logo diz
 *  QUEM está respondendo — que é a informação que muda. */
function Pill({
  label,
  logo,
  onClick,
}: {
  label: string;
  logo?: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="axxa-pill" onClick={onClick}>
      {logo && <Icon name={logo} size={16} className="axxa-pill-logo" />}
      <span className="axxa-pill-label">{label}</span>
    </button>
  );
}

function activityText(a: ActivityMeta): string {
  if (a.phase === "pending") return a.pendingText;
  if (a.phase === "done") return a.doneText ?? a.pendingText;
  return a.failedText ?? "Failed";
}

/** O que o agente fez numa rodada: a chamada de tool OU a narração dela. As
 *  duas coisas moram na mesma folha porque, pra quem lê, são a mesma pergunta:
 *  "o que ele fez aí?". */
export type TurnAction =
  | { kind: "step"; step: AIToolStep }
  | { kind: "activity"; activity: ActivityMeta }
  /** O raciocínio do modelo. Mesma natureza: texto gerado que interessa ter,
   *  não ter na frente. */
  | { kind: "reasoning"; text: string };

function actionTitle(a: TurnAction): string {
  if (a.kind === "step") return a.step.name;
  if (a.kind === "activity") return activityText(a.activity);
  return "Reasoning";
}

function actionNote(a: TurnAction): string | undefined {
  if (a.kind === "step") return toolSummary(a.step);
  if (a.kind === "reasoning") return `${a.text.length} chars`;
  return undefined;
}

function actionFailed(a: TurnAction): boolean {
  if (a.kind === "step") return !a.step.ok;
  if (a.kind === "activity") return a.activity.phase === "failed";
  return false;
}

/** O ícone DIZ o que a ação foi — olho pra leitura, radar pra busca, lixeira
 *  pra apagar. Um check repetido em toda linha não informava nada: o estado já
 *  está na etiqueta "failed" e no detalhe. O mapa é o MESMO que o motor usa na
 *  narração (agentActivitySpec), então a folha e a timeline não divergem. */
function actionIcon(a: TurnAction): string {
  if (a.kind === "reasoning") return "brain";
  if (a.kind === "activity") {
    return a.activity.phase === "failed"
      ? a.activity.iconFailed ?? "circle-alert"
      : a.activity.iconPending;
  }
  if (!a.step.ok) return "circle-alert";
  return agentActivitySpec(a.step.name, a.step.arguments ?? {}).iconPending;
}

/** Resumo de uma linha dos argumentos — o suficiente pra reconhecer a ação. */
function toolSummary(step: AIToolStep): string {
  const args = Object.entries(step.arguments ?? {});
  if (args.length === 0) return step.ok ? "done" : "failed";
  const [chave, valor] = args[0];
  const texto = typeof valor === "string" ? valor : JSON.stringify(valor);
  return `${chave}: ${texto}`.slice(0, 80);
}

/** Detalhe de uma ação: o que foi pedido e o que voltou. */
function ToolDetail({ action }: { action: TurnAction }) {
  const ok = !actionFailed(action);
  return (
    <div className="axxa-tool-detail">
      {action.kind !== "reasoning" && (
        <p className={ok ? "axxa-tool-state is-ok" : "axxa-tool-state"}>
          <Icon name={ok ? "circle-check" : "circle-alert"} size={15} />
          {ok ? "Completed" : "Failed"}
        </p>
      )}
      {action.kind === "step" ? (
        <>
          <p className="axxa-tool-label">Arguments</p>
          <pre className="axxa-tool-block">
            {JSON.stringify(action.step.arguments ?? {}, null, 2)}
          </pre>
          <p className="axxa-tool-label">Result</p>
          <pre className="axxa-tool-block">
            {action.step.result || "(empty)"}
          </pre>
        </>
      ) : action.kind === "activity" ? (
        <>
          <p className="axxa-tool-label">What happened</p>
          <pre className="axxa-tool-block">
            {action.activity.detail || activityText(action.activity)}
          </pre>
        </>
      ) : (
        <pre className="axxa-tool-block is-prose">{action.text}</pre>
      )}
    </div>
  );
}

/** Ouvir a resposta. O motor já tinha o TTS; faltava o botão. */
function ReadAloudButton({
  plugin,
  text,
}: {
  plugin: AxxaPlugin;
  text: string;
}) {
  const [speaking, setSpeaking] = useState(false);
  return (
    <button
      type="button"
      className={speaking ? "axxa-msg-listen is-on" : "axxa-msg-listen"}
      aria-label={speaking ? "Stop" : "Read aloud"}
      onClick={async () => {
        if (speaking) {
          stopSpeaking();
          setSpeaking(false);
          return;
        }
        setSpeaking(true);
        await speak(plugin, text);
        setSpeaking(false);
      }}
    >
      <Icon name={speaking ? "square" : "volume-2"} size={15} />
      <span>{speaking ? "Stop" : "Listen"}</span>
    </button>
  );
}

/** Uma linha da conversa. `memo` de propósito: sem ele, cada TECLA do
 *  composer re-renderizava a conversa inteira — medido em 2,33ms com 5
 *  mensagens contra 8,23ms com 120. O que muda numa mensagem já pronta é
 *  só o que vem por prop, então comparar props basta. */
const MessageRow = memo(function MessageRow({
  msg,
  plugin,
  streaming,
  glow,
  actions,
  onOpenTools,
}: {
  msg: ChatMessage;
  plugin: AxxaPlugin;
  streaming: boolean;
  /** Terminou enquanto o usuário lia lá em cima: acende uma vez. */
  glow?: boolean;
  /** Tudo que o agente fez nesta rodada — narrações + tool calls. */
  actions?: TurnAction[];
  onOpenTools?: (actions: TurnAction[]) => void;
}) {
  switch (msg.type) {
    case "user":
      return (
        <div className="axxa-msg axxa-msg-user">
          <div className="axxa-msg-text">{msg.content}</div>
        </div>
      );
    case "ai-response":
      return (
        <div
          className={
            "axxa-msg axxa-msg-ai" +
            (msg.isError ? " axxa-msg-error" : "") +
            (glow ? " is-done" : "")
          }
        >
          {msg.reasoning && (
            <button
              type="button"
              className="axxa-tools-chip"
              onClick={() =>
                onOpenTools?.([{ kind: "reasoning", text: msg.reasoning ?? "" }])
              }
            >
              <span>Reasoning</span>
              <Icon name="chevron-right" size={15} />
            </button>
          )}
          {msg.isError ? (
            <div className="axxa-msg-text">{msg.content}</div>
          ) : (
            <Markdown
              app={plugin.app}
              text={msg.content}
              streaming={streaming}
            />
          )}
          {plugin.settings.ttsEnabled && !msg.isError && msg.content.trim() && (
            <ReadAloudButton plugin={plugin} text={msg.content} />
          )}
          {msg.truncated && <small className="axxa-msg-note">truncated</small>}
          {actions && actions.length > 0 && (
            // O que o agente FEZ vira um chip: quem quer ver abre a folha, e
            // quem não quer não leva um <details> no meio da leitura.
            <button
              type="button"
              className="axxa-tools-chip"
              onClick={() => onOpenTools?.(actions)}
            >
              <span>
                Ran {actions.length}{" "}
                {actions.length === 1 ? "action" : "actions"}
              </span>
              <Icon name="chevron-right" size={15} />
            </button>
          )}
        </div>
      );
    case "ai-comment":
      return (
        <div className="axxa-msg axxa-msg-comment">
          <Icon
            name={
              msg.activity?.phase === "failed"
                ? "alert-triangle"
                : msg.activity?.phase === "done"
                  ? "check"
                  : "loader"
            }
            size={13}
          />
          <span>
            {msg.activity ? activityText(msg.activity) : msg.content}
            {msg.activity && msg.content ? ` — ${msg.content}` : ""}
          </span>
          {msg.activity?.detail && (
            // Mesmo caminho de tudo o mais: abre na folha. Um <details> aqui
            // empurrava a conversa toda pra baixo no meio de uma rodada.
            <button
              type="button"
              className="axxa-tools-chip is-inline"
              onClick={() =>
                msg.activity &&
                onOpenTools?.([{ kind: "activity", activity: msg.activity }])
              }
            >
              <span>details</span>
              <Icon name="chevron-right" size={14} />
            </button>
          )}
        </div>
      );
    case "ai-options":
      return (
        <div className="axxa-msg axxa-msg-options">
          <div>{msg.prompt}</div>
          <div className="axxa-suggestions">
            {msg.options.map((o, i) => (
              <button
                key={i}
                type="button"
                className={
                  msg.selectedIndex === i ? "axxa-chip is-active" : "axxa-chip"
                }
                disabled={msg.selectedIndex !== undefined}
                onClick={() => useChatStore.getState().selectOption(msg.id, i)}
              >
                {o}
              </button>
            ))}
          </div>
        </div>
      );
    default:
      return null;
  }
});
