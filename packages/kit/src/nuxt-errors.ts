import { createErrorUtils } from './errors.ts'
import { logger } from './logger.ts'

export * as ErrorCodes from './error-codes.ts'

export const buildErrorUtils = createErrorUtils({
  prefix: 'NUXT',
  docsBase: 'https://nuxt-cp7c9vdke-nuxt-js.vercel.app/docs/4.x/errors',
  logger,
})
