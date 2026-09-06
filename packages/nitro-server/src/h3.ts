/**
 * h3 compatibility layer for Nuxt runtime code.
 *
 * @deprecated Removed in Nuxt 5. Import the portable server surface from `nuxt/server`,
 * which is not tied to an h3 or Nitro major. For the helpers `nuxt/server` does not cover,
 * import from `nitro/h3` directly and accept that the code is pinned to the h3 major the
 * configured server builder ships.
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
