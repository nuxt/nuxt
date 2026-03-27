import { createBuildErrorUtils } from './errors.ts'

export const { formatBuildError, throwBuildError, warnBuild, errorBuild } = /* @__PURE__ */ createBuildErrorUtils({
  module: 'NUXT',
  docsBase: 'https://nuxt.com/e',
})
