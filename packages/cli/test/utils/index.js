import consola from 'consola'
export * from './mocking'
export { NuxtCommand } from '../../src'

consola.mockTypes(() => jest.fn())

export {
  consola
}
