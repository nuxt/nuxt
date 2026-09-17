import type { H3Event } from 'h3'

// module utility handed an event by user code: nitro v2 exposed `$fetch` on it
export async function queryPing (event: H3Event) {
  const { pong } = await (event as H3Event & { $fetch: (url: string) => Promise<{ pong: string }> }).$fetch('/api/ping')
  return { pong, viaCaptureError: typeof (event as H3Event & { captureError?: unknown }).captureError === 'function' }
}
