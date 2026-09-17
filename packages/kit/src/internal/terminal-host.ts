export interface TerminalHostTask {
  update: (label: string) => void
  stop: (message?: string, outcome?: 'success' | 'failure') => void
}

export interface TerminalHostNotification {
  title?: string
  message: string
  level?: 'info' | 'warn'
}

export interface TerminalHostNotice {
  dismiss: () => void
  dismissed: Promise<void>
}

export interface TerminalHost {
  version: 1
  withTerminal: <T>(work: () => Promise<T>) => Promise<T>
  startTask: (label: string) => TerminalHostTask
  notify?: (notification: TerminalHostNotification) => TerminalHostNotice
}

const TERMINAL_HOST_KEY = Symbol.for('nuxt:terminal-host')

/**
 * Look up the terminal host published by the running CLI, if any.
 *
 * The contract is passed on `globalThis` rather than through an import because a single
 * process routinely contains several copies of `@nuxt/kit` and `@nuxt/cli`.
 */
export function useTerminalHost (): TerminalHost | undefined {
  const host = (globalThis as Record<symbol, unknown>)[TERMINAL_HOST_KEY] as TerminalHost | undefined
  if (!host || host.version !== 1 || typeof host.withTerminal !== 'function' || typeof host.startTask !== 'function') {
    return undefined
  }
  return host
}
