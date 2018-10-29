import consola from 'consola'
export * from './mocking'
export { NuxtCommand } from '../../src'

jest.mock('consola')

consola.add = jest.fn()

export {
  consola
}
