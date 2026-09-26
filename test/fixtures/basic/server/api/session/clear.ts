import { clearSession, defineEventHandler } from 'nuxt/server'
import { sessionConfig } from '../../utils/session'

export default defineEventHandler(async (event) => {
  await clearSession(event, sessionConfig)
  return { cleared: true }
})
