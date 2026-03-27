import { createErrorUtils } from '@nuxt/kit'

export { ErrorCodes } from '@nuxt/kit'

export const buildErrorUtils = createErrorUtils({
  module: 'NUXT',
  docsBase: 'https://nuxt.com/e',
})
