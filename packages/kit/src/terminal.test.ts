import { afterEach, describe, expect, it, vi } from 'vitest'

import { logger } from './logger.ts'
import { useTerminal } from './terminal.ts'
import type { TerminalHost } from './internal/terminal-host.ts'

const key = Symbol.for('nuxt:terminal-host')

function registerHost (host: Partial<TerminalHost> = {}) {
  const registered: TerminalHost = {
    version: 1,
    withTerminal: work => work(),
    startTask: () => ({ update: () => {}, stop: () => {} }),
    ...host,
  }
  ;(globalThis as Record<symbol, unknown>)[key] = registered
  return registered
}

afterEach(() => {
  delete (globalThis as Record<symbol, unknown>)[key]
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('useTerminal', () => {
  it('should run work directly when no host is present', async () => {
    const work = vi.fn().mockResolvedValue('done')
    await expect(useTerminal().withTerminal(work)).resolves.toBe('done')
    expect(work).toHaveBeenCalledOnce()
    expect(useTerminal().interactive).toBe(false)
  })

  it('should ignore a host with an incompatible version', () => {
    registerHost({ version: 2 as unknown as 1, withTerminal: vi.fn() })
    expect(useTerminal().interactive).toBe(false)
  })

  it('should borrow the terminal from a registered host', async () => {
    const borrows: number[] = []
    const withTerminal: TerminalHost['withTerminal'] = (work) => {
      borrows.push(1)
      return work()
    }
    registerHost({ withTerminal })

    await expect(useTerminal().withTerminal(() => Promise.resolve('done'))).resolves.toBe('done')
    expect(borrows).toHaveLength(1)
    expect(useTerminal().interactive).toBe(true)
  })

  it('should leave nested borrows to the host, which re-enters them', async () => {
    const borrows: number[] = []
    const withTerminal: TerminalHost['withTerminal'] = (work) => {
      borrows.push(1)
      return work()
    }
    registerHost({ withTerminal })

    const terminal = useTerminal()
    await expect(terminal.withTerminal(() => terminal.withTerminal(() => Promise.resolve('done')))).resolves.toBe('done')

    expect(borrows).toHaveLength(2)
  })

  describe('prompt', () => {
    it('should fall back to the logger prompt', async () => {
      const prompt = vi.spyOn(logger, 'prompt').mockResolvedValue(true)

      await expect(useTerminal().prompt('ok?', { type: 'confirm' })).resolves.toBe(true)
      expect(prompt).toHaveBeenCalledWith('ok?', { type: 'confirm' })
    })

    it('should prompt within a borrowed terminal', async () => {
      const order: string[] = []
      registerHost({
        withTerminal: async (work) => {
          order.push('borrow')
          const result = await work()
          order.push('release')
          return result
        },
      })
      vi.spyOn(logger, 'prompt').mockImplementation(() => { order.push('prompt'); return Promise.resolve(true) })

      await useTerminal().prompt('ok?', { type: 'confirm' })
      expect(order).toEqual(['borrow', 'prompt', 'release'])
    })

    it('should route a replaced prompt implementation through the host', async () => {
      const borrows: number[] = []
      const withTerminal: TerminalHost['withTerminal'] = (work) => {
        borrows.push(1)
        return work()
      }
      registerHost({ withTerminal })
      const replaced = vi.fn().mockResolvedValue(true)
      const original = logger.options.prompt
      logger.options.prompt = replaced

      try {
        await expect(useTerminal().prompt('ok?', { type: 'confirm' })).resolves.toBe(true)
        expect(replaced).toHaveBeenCalledOnce()
        expect(borrows).toHaveLength(1)
      } finally {
        logger.options.prompt = original
      }
    })
  })

  describe('startTask', () => {
    it('should log task progress when no host is present', () => {
      const start = vi.spyOn(logger, 'start').mockImplementation(() => {})
      const success = vi.spyOn(logger, 'success').mockImplementation(() => {})
      const fail = vi.spyOn(logger, 'fail').mockImplementation(() => {})

      const task = useTerminal().startTask('installing')
      task.update('still installing')
      task.stop('installed')
      task.stop('installed again')

      expect(start.mock.calls.flat()).toEqual(['installing', 'still installing'])
      expect(success).toHaveBeenCalledExactlyOnceWith('installed')
      expect(fail).not.toHaveBeenCalled()
    })

    it('should log a failed task when no host is present', () => {
      vi.spyOn(logger, 'start').mockImplementation(() => {})
      const fail = vi.spyOn(logger, 'fail').mockImplementation(() => {})

      useTerminal().startTask('installing').stop('nope', 'failure')

      expect(fail).toHaveBeenCalledExactlyOnceWith('nope')
    })

    it('should delegate to the host', () => {
      const task = { update: vi.fn(), stop: vi.fn() }
      registerHost({ startTask: vi.fn(() => task) })
      const start = vi.spyOn(logger, 'start').mockImplementation(() => {})

      useTerminal().startTask('installing').stop('installed')

      expect(task.stop).toHaveBeenCalledWith('installed')
      expect(start).not.toHaveBeenCalled()
    })
  })

  describe('notify', () => {
    it('should box the notification when no host is present', async () => {
      const box = vi.spyOn(logger, 'box').mockImplementation(() => {})

      const notice = useTerminal().notify({ title: 'Auth', message: 'code: 1234' })
      notice.dismiss()

      expect(box).toHaveBeenCalledExactlyOnceWith('Auth\n\ncode: 1234')
      await expect(notice.dismissed).resolves.toBeUndefined()
    })

    it('should fall back when the host does not implement notify', () => {
      registerHost()
      const box = vi.spyOn(logger, 'box').mockImplementation(() => {})

      useTerminal().notify({ message: 'code: 1234' })

      expect(box).toHaveBeenCalledExactlyOnceWith('code: 1234')
    })

    it('should delegate to the host when notify is implemented', () => {
      const notice = { dismiss: vi.fn(), dismissed: Promise.resolve() }
      const notify = vi.fn(() => notice)
      registerHost({ notify })
      const box = vi.spyOn(logger, 'box').mockImplementation(() => {})

      expect(useTerminal().notify({ message: 'code: 1234', level: 'warn' })).toBe(notice)
      expect(notify).toHaveBeenCalledWith({ message: 'code: 1234', level: 'warn' })
      expect(box).not.toHaveBeenCalled()
    })
  })
})
