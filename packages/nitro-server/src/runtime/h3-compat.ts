/**
 * h3 compatibility layer for Nuxt runtime code.
 */

// export named re-exports to help rolldown statically link consumers
export {
  HTTPError,
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  H3Error,
  H3Event,
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  createError,
  deleteCookie,
  getCookie,
  getRequestURL,
  sanitizeStatusCode,
  setCookie,
} from 'nitro/h3'
export type { EventHandlerRequest } from 'nitro/h3'

export * from 'nitro/h3'
