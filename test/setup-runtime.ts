import { vi } from 'vitest'

vi.mock('#app/compat/idle-callback', () => ({
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  requestIdleCallback: vi.fn((cb: Function) => cb()),
  cancelIdleCallback: () => {},
}))
