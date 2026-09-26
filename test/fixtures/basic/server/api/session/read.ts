import { defineEventHandler, useSession } from 'nuxt/server'
import { sessionConfig } from '../../utils/session'

export default defineEventHandler(async event => (await useSession(event, sessionConfig)).data)
