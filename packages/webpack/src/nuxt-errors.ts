import { type ErrorUtils, createErrorUtils } from '@nuxt/kit'

export { ErrorCodes } from '@nuxt/kit'

export const buildErrorUtils: ErrorUtils = createErrorUtils({
  prefix: 'NUXT',
  docsBase: 'https://nuxt-cp7c9vdke-nuxt-js.vercel.app/docs/4.x/errors',
})
