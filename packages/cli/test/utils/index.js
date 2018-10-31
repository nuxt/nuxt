import consola from 'consola'
export * from './mocking'
export { NuxtCommand } from '../../src'

jest.mock('consola')

consola.addReporter = jest.fn()
consola.withTag = () => consola

export {
  consola
}
