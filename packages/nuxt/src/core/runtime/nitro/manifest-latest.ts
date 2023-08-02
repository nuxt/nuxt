import { defineEventHandler } from 'h3'
// @ts-expect-error Virtual file
import { buildTimestamp, hashId } from '#app-manifest'

export default defineEventHandler(() => {
  if (!process.env.prerender && !process.dev) { return }
  return {
    id: hashId,
    timestamp: buildTimestamp
  }
})
