import { defineEventHandler } from 'nitro/h3'

export default defineEventHandler(() => {
  throw new Error('boom from an api handler')
})
