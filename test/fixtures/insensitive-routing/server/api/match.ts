import { defineEventHandler, getQuery, matchRouteRules } from 'nuxt/server'

export default defineEventHandler(event => matchRouteRules(String(getQuery(event).path)))
