import { defineEventHandler } from 'nuxt/server'

export default defineEventHandler(async (event) => {
  if (!event.url.pathname.startsWith('/api/portable-body')) {
    return
  }

  const cloned = await event.req.clone().json() as { name?: string }
  const parsed = await event.req.json() as { name?: string }

  event.context.portableBody = { cloned: cloned.name ?? null, parsed: parsed.name ?? null }
})
