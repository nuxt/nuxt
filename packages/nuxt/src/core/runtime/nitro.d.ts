// Type augmentations for nitropack types used in runtime
declare module 'nitropack' {
  interface NitroRouteRules {
    isr?: number | boolean
    swr?: number | boolean
  }
}

declare module 'nitropack/types' {
  interface NitroRouteRules {
    isr?: number | boolean
    swr?: number | boolean
  }
}

export {}
