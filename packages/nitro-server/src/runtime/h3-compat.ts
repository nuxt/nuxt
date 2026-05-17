/**
 * h3 compatibility layer for Nuxt runtime code.
 */

// export named re-exports to help rolldown statically link consumers
export {
  H3Error,
  H3Event,
  createError,
  deleteCookie,
  getCookie,
  getRequestURL,
  sanitizeStatusCode,
  setCookie,
} from 'h3'
export type { EventHandlerRequest } from 'h3'

export * from 'h3'
