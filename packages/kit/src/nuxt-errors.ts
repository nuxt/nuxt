import { type ErrorUtils, createErrorUtils } from './errors.ts'

export * as ErrorCodes from './error-codes.ts'

export const buildErrorUtils: ErrorUtils = createErrorUtils({
  prefix: 'NUXT',
  docsBase: 'https://nuxt-cp7c9vdke-nuxt-js.vercel.app/docs/4.x/errors',
})
