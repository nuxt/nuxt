declare module 'webpack' {
  export type MultiStats = never
  interface Compiler {
    watching?: any
  }
}

export {}
