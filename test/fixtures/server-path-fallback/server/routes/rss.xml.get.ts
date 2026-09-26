import { defineEventHandler } from 'h3'

export default defineEventHandler(() => {
  return new Response('<rss>feed contents</rss>', {
    headers: { 'content-type': 'application/xml' },
  })
})
