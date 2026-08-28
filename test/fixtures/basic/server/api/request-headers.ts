import { defineEventHandler, getRequestHeader } from 'nuxt/server'

export default defineEventHandler(event => ({
  cookie: getRequestHeader(event, 'cookie') ?? null,
  authorization: getRequestHeader(event, 'authorization') ?? null,
  accept: getRequestHeader(event, 'accept') ?? null,
}))
