import { defineEventHandler } from 'h3'

export default defineEventHandler(() => globalThis.__islandRequestSpy ?? null)
