import { getHeader } from 'h3'
import type { H3Event } from 'h3'

export function describeEvent (event: H3Event) {
  return {
    hasNodeBridge: !!event.node,
    hasNitroContext: !!(event.context as Record<string, unknown>).nitro,
    userAgent: getHeader(event, 'user-agent') ?? null,
  }
}
