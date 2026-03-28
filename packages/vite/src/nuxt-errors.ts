import { createErrorUtils } from '@nuxt/kit'

export { ErrorCodes } from '@nuxt/kit'

export const buildErrorUtils = createErrorUtils({
  prefix: 'NUXT',
  docsBase: 'https://nuxt.com/e',
})
