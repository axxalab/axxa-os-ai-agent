// tests/helpers/streamMock.ts
// Harness pra testar o parsing de stream dos providers SEM rede: monta um
// `Response` fake cujo body é um ReadableStream que emite cada string como um
// "read" separado — assim dá pra reproduzir o caso clássico de um evento JSON
// partido entre dois reads (o que mais quebra calado em parser de SSE).

const enc = new TextEncoder();

/** ReadableStream<Uint8Array> — UM enqueue por chunk = um read() por chunk. */
export function bytesStream(chunks: string[]): ReadableStream<Uint8Array> {
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) controller.enqueue(enc.encode(chunks[i++]));
      else controller.close();
    },
  });
}

/** Response fake — só os campos que o streamChat dos providers realmente lê. */
export function fakeStreamResponse(
  chunks: string[],
  init: { status?: number; ok?: boolean } = {}
): Response {
  return {
    status: init.status ?? 200,
    ok: init.ok ?? true,
    body: bytesStream(chunks),
    json: async () => ({}),
  } as unknown as Response;
}

/** Monta uma linha SSE `data: {json}\n\n`. */
export function sse(obj: unknown): string {
  return `data: ${JSON.stringify(obj)}\n\n`;
}
