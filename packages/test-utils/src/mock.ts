import consola from 'consola'
import { useTestContext } from './context'

export function mockFn () {
  const ctx = useTestContext()
  return ctx.mockFn
}

export function mockLogger (): Record<string, Function> {
  const mocks: any = {}
  consola.mockTypes((type) => {
    mocks[type] = mockFn()
    return mocks[type]
  })
  return mocks
}
