# O squircle

Forma de canto usada nos botões quadrados do app. Não é `border-radius`: é uma
máscara SVG de quatro curvas Bézier, sem um único trecho reto.

Contrato trazido do **Clipei Front Lab** (`resources/js/clipador/lib/squircle.ts`),
onde a forma está em ~45 arquivos. Este documento existe pra a forma chegar
aqui **intacta** — e pra as armadilhas dela chegarem junto, que é a parte que
some quando se copia só o CSS.

## A forma

Cada quadrante é uma cúbica que vai do meio de um lado ao meio do seguinte.
Não existe aresta reta nem "início do raio": a curvatura começa no ponto médio
e nunca para. É por isso que ela parece mais cheia que um círculo e mais macia
que um quadrado arredondado — é a família do ícone de app do iOS.

```
M50 0C84 0 100 16 100 50C100 84 84 100 50 100C16 100 0 84 0 50C0 16 16 0 50 0Z
```

**Copie a string inteira, sem reescrever os números de controle.** Arredondar
um `84` pra `85` muda a curvatura.

## Onde ela mora aqui

Em `styles/main.css`, como token declarado **uma vez**:

```css
--axxa-squircle: url("data:image/svg+xml,…");
```

Declarar uma vez não é estética: inline, cada elemento carrega a própria cópia
da string, e numa lista longa isso é uma cópia por item. Com o token, todos
apontam pra mesma URL e o SVG é decodificado uma vez só.

O `fill='black'` é de propósito: máscara só olha a opacidade, e um `#` dentro
de um data URI em CSS precisaria virar `%23`.

## Quem usa

Só caixa **quadrada**:

| elemento | tamanho |
|---|---|
| `.axxa-round-btn` (+ e microfone do composer) | 32×32 |
| `.axxa-send` (enviar / parar) | 32×32 |
| `.axxa-icon-btn` (botões da barra de cima) | 44×44 |
| `.axxa-history-more` (⋯ da conversa) | 28×28 |
| `.axxa-rag-refresh` (↻ do índice) | 26×26 |

Além disso existe a classe `.axxa-squircle`, pra quando aparecer um quadrado
novo.

## Por que só quadrado

`preserveAspectRatio='none'` + `mask-size: 100% 100%` esticam o desenho junto
com o elemento. Num quadrado ele é o squircle; num retângulo largo vira uma
pastilha, porque não há lado reto pra absorver a diferença.

Os limites, como o demo do documento original os mede (a prosa dele fala em
"uns 1,2:1"; o código do demo é mais preciso):

| proporção | veredito |
|---|---|
| até 1,05 : 1 | a forma está correta |
| até 1,35 : 1 | a distorção existe, mas passa despercebida |
| acima de 1,35 : 1 | virou pastilha — use `border-radius` |

Os cinco botões daqui são 1,00 : 1 — medidos, não presumidos. Cartões de
conversa, cartão de uso, módulos e cartões de começar passam de 1,7 : 1, e por
isso ficaram no `border-radius`.

## O que a máscara quebra

Máscara não é recorte de borda: ela **apaga pixels**. Tudo que o navegador
desenha fora da caixa some junto.

- **`border` não acompanha.** A borda é pintada no retângulo e depois
  mascarada: aparece comida nos cantos. Não existe borda de squircle.
- **`box-shadow` e `outline` somem.** Pra sombra, use um pai não mascarado.
  Pra foco de teclado, um pai com `outline` ou um `::after` fora do elemento
  mascarado.
- **Filho fora do fluxo escapa.** Um `<img>` dentro do contêiner mascarado é
  mascarado junto (isso funciona), mas `position: fixed` foge.

Antes de aplicar em qualquer elemento novo, confira se ele tem borda, sombra
ou outline — é uma falha **silenciosa**, não dá erro.

## O padrão de anel

Como `border` não serve, o contorno sai de dois elementos: o pai mascarado
ganha `padding` e a cor do anel como fundo; o filho mascarado fica por cima.

```html
<div class="axxa-squircle" style="padding: 3px; background: var(--cor-do-anel)">
  <img class="axxa-squircle" src="…" />
</div>
```

## Suporte

| navegador | situação |
|---|---|
| Chrome / Edge | funciona sem prefixo — mas mantenha o `-webkit-`, que é o que cobre WebView antigo do Android |
| Safari (macOS e iOS) | **exige** `-webkit-mask-*`. Sem ele, o elemento vira retângulo em silêncio |
| Firefox | funciona sem prefixo |

O `border-radius` de cada elemento ficou onde estava: enquanto a máscara
funciona ele é ignorado, e onde ela não aplicar ele é a forma de reserva.

## A variante de topo

O Clipei tem uma segunda forma (`.squircle-top`, só dois cantos de cima, com
máscara de quatro camadas) pra casca da barra inferior de navegação. Não foi
trazida: aqui não existe barra ancorada no rodapé que precise disso. Se um dia
precisar, ela não sai da mesma `<path>` — é outra máscara.
