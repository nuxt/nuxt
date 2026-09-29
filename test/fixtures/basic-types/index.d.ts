declare module 'nuxt/schema' {
  interface PublicRuntimeConfig {
    ids: (1 | 2 | 3)[]
  }
}

// Mirrors how modules type app config: a partial input surface, and the fully
// resolved runtime shape that `useAppConfig()` returns.
declare module '@nuxt/schema' {
  interface AppConfigInput {
    themed?: {
      colors?: { primary?: string, neutral?: string }
      slots?: { root?: string, body?: string }
      variants?: string[]
      format?: (value: string) => string
    }
  }
  interface CustomAppConfig {
    themed: {
      colors: { primary: string, neutral: string }
      slots: { root: string, body: string }
      variants: string[]
      format: (value: string) => string
    }
  }
}

export {}
