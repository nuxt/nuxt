import { defineEventHandler, getQuery, updateSession } from 'nuxt/server'
import { sessionConfig } from '../../utils/session'

export default defineEventHandler(async event => (await updateSession(event, sessionConfig, getQuery(event))).data)
