import { createErrorUtils } from '@nuxt/kit'

export { ErrorCodes } from '@nuxt/kit'

export const buildErrorUtils = createErrorUtils({
  module: 'NUXT',
  docsBase: 'https://nuxt-cp7c9vdke-nuxt-js.vercel.app/docs/4.x/errors',
})
