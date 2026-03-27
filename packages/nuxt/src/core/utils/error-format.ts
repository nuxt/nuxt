import { createBuildErrorUtils } from '@nuxt/kit'

export { ErrorCodes } from '@nuxt/kit'
export type { NuxtErrorOptions } from '@nuxt/kit'

export const { formatBuildError, throwBuildError, warnBuild, errorBuild } = /* @__PURE__ */ createBuildErrorUtils({
  module: 'NUXT',
  docsBase: 'https://nuxt.com/e',
})
