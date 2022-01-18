import { createApp, useBase } from 'h3'
import { createFetch, Headers } from 'ohmyfetch'
import destr from 'destr'
import { createCall, createFetch as createLocalFetch } from 'unenv/runtime/fetch/index'
import { baseURL } from '../app/paths'
import { timingMiddleware } from './timing'
import { handleError } from './error'
// @ts-ignore
import serverMiddleware from '#server-middleware'

const app = createApp({
  debug: destr(process.env.DEBUG),
  onError: handleError
})

app.use(timingMiddleware)
app.use(serverMiddleware)
app.use(() => import('../app/render').then(e => e.renderMiddleware), { lazy: true })

export const stack = app.stack
export const handle = useBase(baseURL(), app)
export const localCall = createCall(handle)
export const localFetch = createLocalFetch(localCall, globalThis.fetch)

export const $fetch = createFetch({ fetch: localFetch, Headers })

globalThis.$fetch = $fetch as any
