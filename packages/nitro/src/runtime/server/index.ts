import '../app/config'
import { createApp, useBase } from 'h3'
import { createFetch } from 'ohmyfetch'
import destr from 'destr'
import { createCall, createFetch as createLocalFetch } from 'unenv/runtime/fetch'
import { timingMiddleware } from './timing'
import { handleError } from './error'
// @ts-ignore
import serverMiddleware from '~serverMiddleware'

const app = createApp({
  debug: destr(process.env.DEBUG),
  onError: handleError
})

app.use(timingMiddleware)
app.use(serverMiddleware)
app.use(() => import('../app/render').then(e => e.renderMiddleware), { lazy: true })

export const stack = app.stack
export const handle = useBase(process.env.ROUTER_BASE, app)
export const localCall = createCall(handle)
export const localFetch = createLocalFetch(localCall, globalThis.fetch)

export const $fetch = createFetch({ fetch: localFetch })

globalThis.$fetch = $fetch
