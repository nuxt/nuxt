export interface WarmupState {
  /** set when the plugin's module body is evaluated */
  module?: boolean
  /** set when the plugin itself is run, which needs a render */
  plugin?: boolean
}

// the ssr graph and the server route are evaluated in the same process but in separate
// module graphs, so the state is shared through a global
export function warmupState (): WarmupState {
  return ((globalThis as Record<string, any>).__nuxtDevWarmup__ ??= {})
}
