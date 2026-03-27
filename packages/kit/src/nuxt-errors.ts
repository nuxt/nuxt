import { createErrorUtils } from './errors.ts'
import { logger } from './logger.ts'

export * as ErrorCodes from './error-codes.ts'

export const buildErrorUtils = createErrorUtils({
  module: 'NUXT',
  docsBase: 'https://nuxt.com/e',
  logger,
})
