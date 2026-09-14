# GOAL — o campo de texto

Doze itens levantados na análise de 2026-09-14, na ordem em que serão feitos.
Cada um só fecha quando o **critério de aceite** for verificado; o registro de
como foi verificado fica na própria linha (✅ rodado no preview · 🧪 teste
automatizado · 📱 só no aparelho).

Regra: um item de cada vez, verificado antes do próximo. No fim, tudo é
re-testado junto.

---

## Bloco A — nunca perder texto digitado

### 1. O rascunho sobrevive a sair da tela
Hoje `draft` é state do ChatView, e `App.tsx` desmonta o ChatView ao ir pra
Projects/Skills — o texto morre junto. Também morre ao fechar a gaveta
(`AxxaView.onClose` → `root.unmount()`).

**Aceite:** escrever, ir pra Skills, voltar → o texto continua lá.

### 2. O rascunho NÃO segue pra outra conversa
Nada reseta o draft quando `currentChatId` muda: a mensagem da conversa A
aparece no campo da conversa B (e no "New chat").

**Aceite:** rascunho em A, abrir B → campo de B vazio; voltar pra A → o
rascunho de A está lá. "New chat" abre com campo vazio.

### 3. Envio que não engata devolve o texto
`submit()` limpa o campo ANTES do `await session.send()`, e `send()` tem
early-returns (sem API key na 1ª mensagem) que nem chegam a criar a mensagem do
usuário. O texto some das duas pontas.

**Aceite:** sem key, 1º envio → a bolha de erro aparece E o texto continua no
campo.

## Bloco B — o campo não pode comer a tela

### 4. O teto de altura conta o teclado
`max = innerHeight * 0.4` é 40% da tela INTEIRA; com o teclado aberto sobra
~55% dela. Além disso há duas fontes de verdade (JS e `max-height: 40vh`).

**Aceite:** uma função pura testada; o teto cai quando `--keyboard-height` > 0;
o CSS lê a var que o JS escreve (fonte única).

### 5. Recalcular quando a tela muda
O effect depende só de `[draft]` — girar o aparelho mantém a altura calculada
pra outra largura.

**Aceite:** mudar o tamanho da janela recalcula a altura sem tocar no texto.

## Bloco C — digitar tem que ser barato

### 6. Tecla não re-renderiza a conversa inteira
Medido: 2,33 ms/tecla com 5 mensagens → 8,23 ms/tecla com 120 (3,5×).

**Aceite:** custo por tecla praticamente igual com 5 e com 120 mensagens.

## Bloco D — o que o motor já aguenta

### 7. Anexos (nota e imagem)
`providers/base.ts` já tem `NoteAttachment`/`ImageAttachment` e os providers já
mandam; o `+` só lista skills.

**Aceite:** anexar nota e imagem pelo `+`, chip com remover, e o anexo chega no
payload do provider. Imagem só aparece em modelo `chat-vision`.

### 8. `[[` cita nota
Digitar `[[` sugere notas; escolher insere o wikilink E anexa a nota.

**Aceite:** `[[` abre a lista, filtra pelo que se digita, escolher insere o
texto e cria o chip.

### 9. Colar bloco gigante vira chip
Colar 5k caracteres hoje estica o campo até o teto.

**Aceite:** colar acima do limite vira anexo "Pasted text" com o tamanho; colar
pouco continua entrando como texto.

## Bloco E — atrito

### 10. Enter envia no desktop
Só Ctrl/Cmd+Enter envia. Falta Enter (desktop) com guarda de `isComposing`.

**Aceite:** desktop → Enter envia, Shift+Enter quebra linha, Enter durante
composição de acento NÃO envia. Mobile → Enter quebra linha.

### 11. Digitar durante a resposta enfileira
`submit()` cai fora com `isLoading` sem dizer nada.

**Aceite:** enviar durante a resposta enfileira, mostra o que está na fila com
opção de cancelar, e dispara sozinho quando a rodada termina.

### 12. Foco
O foco não volta pro campo ao fechar uma folha; e tocar em enviar tira o foco
(no Android isso fecha o teclado).

**Aceite:** fechar a folha devolve o foco a quem tinha; o botão de enviar não
rouba o foco do campo.

---

## Estado

| # | item | estado | como foi verificado |
|---|------|--------|---------------------|
| 1 | rascunho sobrevive à tela | ✔ | ✅ escrevi → Skills → voltei, texto intacto · 🧪 6 testes de store |
| 2 | rascunho por conversa | ✔ | ✅ A/B/A no preview: cada conversa com o seu, "nova" separada |
| 3 | envio que falha devolve texto | ✔ | ✅ `?nokey=1`: bolha de erro E texto no campo; com key limpa e envia |
| 4 | teto conta o teclado | ✔ | 🧪 11 testes · ✅ var 324px → 196px com teclado de 320 |
| 5 | recalcula no resize | ✔ | ✅ girar (812→375) muda o teto pra 150px na hora |
| 6 | tecla barata | ✔ | ✅ mediana por tecla 2,6ms (5 msgs) vs 2,7ms (120) — razão 1,04 |
| 7 | anexos | ✔ | ✅ nota + imagem viram chip, X remove, envio consome · 🧪 6 testes até o payload |
| 8 | `[[` cita nota | ✔ | ✅ lista filtra, insere `[[PROJECTS/FRAMEWORKS]]` e anexa · 🧪 16 testes |
| 9 | colar grande vira chip | ✔ | ✅ 5.2k vira "Pasted text (5.2k)", print colado vira imagem · 🧪 8 testes |
| 10 | Enter no desktop | ✔ | ✅ desktop envia, Shift e IME não, celular não, `[[` escolhe |
| 11 | fila durante a resposta | ✔ | ✅ duas na fila, saem em ordem, cancelar devolve, parar limpa · 🧪 4 testes |
| 12 | foco | ✔ | ✅ volta ao fechar a folha, não sobe sozinho · mecanismo do enviar ✅, efeito no teclado 📱 |

## O que a medida do item 6 ensinou

A primeira tentativa PIOROU o que queria consertar. Memoizar a linha da conversa
resolveu o React (0 renders por tecla, custo plano), mas trocar o `rAF` por
`useLayoutEffect` passou a forçar um layout do documento inteiro A CADA TECLA:
com 120 mensagens na tela isso deu **46ms por tecla** — pior que os 8,23ms do
começo. A medida composta oscilava tanto (7 / 35 / 54ms) que dava pra confundir
com ruído do ambiente; separando React (plano, 0,04ms) de layout, o culpado
apareceu.

Versão final: medida por FRAME (teclas seguidas viram uma medida só), com as
medidas de montagem e de resize síncronas — que são as raras e as que a altura
não pode errar. Resultado: 2,6ms com 5 mensagens, 2,7ms com 120.

## O que ficou de fora (de propósito)

- **Rascunho no disco.** Ele sobrevive a sair da tela e a fechar a gaveta (mora
  no store, que é módulo), mas não a recarregar o plugin. Persistir em
  `data.json` é o próximo passo se fizer falta.
- **Anexo na mensagem enviada.** Os chips somem quando a mensagem sai; a
  conversa não mostra o que foi junto. Precisaria de campo novo na mensagem
  persistida.
- **Setas na lista do `[[`.** Enter escolhe o primeiro (que é o mais provável
  pelo ranking); navegar com ↑/↓ ficou fora.
- **Teclado aberto ao enviar (item 12).** O `pointerdown` barrado é o mecanismo
  certo e está no lugar, mas só o aparelho confirma o efeito.
