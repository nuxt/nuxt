import { createErrorUtils } from '@nuxt/kit'

export { ErrorCodes } from '@nuxt/kit'
export type { ErrorInfo as NuxtErrorOptions } from '@nuxt/kit'

export const buildErrorUtils = createErrorUtils({
  prefix: 'NUXT',
  docsBase: 'https://nuxt-cp7c9vdke-nuxt-js.vercel.app/docs/4.x/errors',
})
