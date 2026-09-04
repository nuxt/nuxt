import { defineEventHandler } from 'h3'

export default defineEventHandler((event) => {
  return new Response(`og image for ${event.context.params?.slug}`, {
    headers: { 'content-type': 'text/plain' },
  })
})
