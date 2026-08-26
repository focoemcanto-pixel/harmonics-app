export async function processQueue(items, handler, delay = 5000) {
  const queue = Array.isArray(items) ? items : [];

  for (let index = 0; index < queue.length; index += 1) {
    const item = queue[index];

    try {
      await handler(item);
    } catch (err) {
      console.error('[QUEUE_ERROR]', err);
    }

    // Aguarda somente ENTRE os envios. Antes havia espera também após o último item,
    // aumentando o tempo total da requisição sem nenhum benefício e deixando o
    // disparo de uma escala parecer travado/lento.
    if (index < queue.length - 1 && delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
