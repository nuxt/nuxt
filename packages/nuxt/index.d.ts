/* eslint-disable no-var */
declare global {
  var __NUXT_VERSION__: string
  var __NUXT_PREPATHS__: string[] | string | undefined
  var __NUXT_PATHS__: string[] | string | undefined

  interface Navigator {
    connection?: {
      type: 'bluetooth' | 'cellular' | 'ethernet' | 'none' | 'wifi' | 'wimax' | 'other' | 'unknown'
      effectiveType: 'slow-2g' | '2g' | '3g' | '4g'
    }
  }
}

export {}
