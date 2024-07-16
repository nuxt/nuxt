/* eslint-disable no-var */
declare global {
  var __NUXT_VERSION__: string
  var __NUXT_ASYNC_CONTEXT__: boolean

  interface Navigator {
    connection?: {
      type: 'bluetooth' | 'cellular' | 'ethernet' | 'none' | 'wifi' | 'wimax' | 'other' | 'unknown'
      effectiveType: 'slow-2g' | '2g' | '3g' | '4g'
    }
  }

  interface Window {
    cookieStore?: {
      onchange: (event: any) => void
    }
  }
}

export {}
