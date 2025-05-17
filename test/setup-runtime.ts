import { vi } from 'vitest'

vi.mock('#app/compat/idle-callback', () => ({
  // oxlint-disable-next-line @typescript-eslint/no-unsafe-function-type
  requestIdleCallback: (cb: Function) => cb(),
  cancelIdleCallback: () => {},
}))
