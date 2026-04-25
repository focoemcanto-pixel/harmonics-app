export async function processQueue(items, handler, delay = 5000) {
  for (const item of items) {
    try {
      await handler(item);
    } catch (err) {
      console.error('[QUEUE_ERROR]', err);
    }

    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}
