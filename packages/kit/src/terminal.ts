import { logger } from './logger.ts'
import type { NuxtPromptOptions } from './logger.ts'
import { useTerminalHost } from './internal/terminal-host.ts'

/** A unit of long-running work, rendered on the host's status surface where available. */
export interface NuxtTerminalTask {
  /** Change the label of the running task. */
  update: (label: string) => void
  /** Finish the task, optionally with a closing message. Defaults to a successful outcome. */
  stop: (message?: string, outcome?: 'success' | 'failure') => void
}

export interface NuxtTerminalNotification {
  title?: string
  message: string
  level?: 'info' | 'warn'
}

export interface NuxtTerminalNotice {
  /** Retract the notice. */
  dismiss: () => void
  /** Settles once the notice is gone: acknowledged by the user or retracted. */
  dismissed: Promise<void>
}

export interface NuxtTerminal {
  /**
   * Whether an interactive host (such as the `nuxt dev` TUI) is present. `false` means the
   * primitives below fall back to plain logging on the current process streams.
   */
  readonly interactive: boolean
  /**
   * Borrow the terminal for the duration of `work`: any host UI is suspended and stdin is
   * released, so `work` may read from stdin and write directly to the terminal.
   *
   * Concurrent callers are serialised by the host; a nested call from within a borrow runs
   * immediately.
   */
  withTerminal: <T>(work: () => Promise<T>) => Promise<T>
  /** Ask the user a question, taking over the terminal for as long as the prompt is open. */
  prompt: (message: string, options?: NuxtPromptOptions) => Promise<any>
  /** Start a task, to be finished with `task.stop()`. */
  startTask: (label: string) => NuxtTerminalTask
  /** Show a message and hold it on screen until it is acknowledged or retracted. */
  notify: (notification: NuxtTerminalNotification) => NuxtTerminalNotice
}

/**
 * Access the terminal, cooperating with the host UI (such as the `nuxt dev` TUI) when one is
 * running, and falling back to logging when it is not.
 *
 * Use this instead of writing to `process.stdout` or prompting directly, so that prompts are
 * answerable, tasks are rendered in one place, and nothing is lost to a captured stream.
 */
export function useTerminal (): NuxtTerminal {
  const host = useTerminalHost()

  return {
    interactive: !!host,

    withTerminal: work => host ? host.withTerminal(work) : work(),

    prompt: (message, options) => host
      ? host.withTerminal(() => logger.prompt(message, options))
      : logger.prompt(message, options),

    startTask (label) {
      if (host) {
        return host.startTask(label)
      }
      logger.start(label)
      let stopped = false
      return {
        update (label) {
          if (!stopped) {
            logger.start(label)
          }
        },
        stop (message, outcome) {
          if (stopped) {
            return
          }
          stopped = true
          if (message) {
            logger[outcome === 'failure' ? 'fail' : 'success'](message)
          }
        },
      }
    },

    notify (notification) {
      if (host?.notify) {
        return host.notify(notification)
      }
      logger.box([notification.title, notification.message].filter(Boolean).join('\n\n'))
      return { dismiss: () => {}, dismissed: Promise.resolve() }
    },
  }
}
