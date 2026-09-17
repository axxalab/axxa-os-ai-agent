// src/core/chatPreview.ts
// A ÚLTIMA fala de uma conversa, em uma linha.
//
// É o que o cartão de uma sessão de agente mostra embaixo do título: o que
// aconteceu por último ali. Título mais modelo dizem o que a sessão É; isto
// diz onde ela PAROU — que é a pergunta de quem está decidindo se volta.
//
// Sai do markdown gravado (ver chatPersistence.renderBody), e sai na leitura
// que a listagem já faz: nada aqui abre arquivo por conta própria.

/** Quanto do texto se guarda. O cartão corta em duas linhas no CSS; isto é
 *  pra não carregar uma conversa inteira na memória por cartão. */
const TETO = 240;

/**
 * A última seção (`## You` ou `## Assistant`) virada em uma linha só.
 *
 * Devolve "" quando não há nada aproveitável — conversa recém-criada, arquivo
 * só com frontmatter, ou uma última fala que era só uma imagem/ferramenta. Aí
 * o cartão simplesmente não mostra a linha, em vez de mostrar um vazio com
 * altura.
 */
export function previewFromMarkdown(content: string): string {
  const secoes = content.split(/^## (?:You|Assistant)\s*$/m);
  // A primeira fatia é o cabeçalho (frontmatter + `# Título`), nunca uma fala.
  if (secoes.length < 2) return "";
  for (let i = secoes.length - 1; i >= 1; i--) {
    const texto = previewFromText(secoes[i]);
    if (texto) return texto;
  }
  return "";
}

/**
 * O mesmo, a partir de UMA fala que já está na memória.
 *
 * É o caminho de quem acabou de gravar: a sessão tem as mensagens na mão e
 * não precisa reler o arquivo que ela mesma escreveu. Sem isto, gravar
 * apagaria a linha do cartão até a próxima varredura de pasta.
 */
export function previewFromText(bruto: string): string {
  return limpar(bruto).slice(0, TETO);
}

/** Tira do texto tudo que só existe pro arquivo, não pra quem lê o cartão. */
function limpar(bruto: string): string {
  return (
    bruto
      // Comentários do formato: a meta da mensagem e os passos do agente em
      // base64 (que são longos e não dizem nada assim).
      .replace(/<!--[\s\S]*?-->/g, " ")
      // Cerca de código: o que importa é o código, não as crases.
      .replace(/^```.*$/gm, " ")
      // Marcas de início de linha (#, >, -, *, 1.) — viram ruído numa linha só.
      .replace(/^\s{0,3}(?:[#>]+|[-*+]|\d+\.)\s+/gm, " ")
      // Imagem/anexo não têm o que mostrar em texto.
      .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
      // Link vira o texto dele.
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/\s+/g, " ")
      .trim()
  );
}
