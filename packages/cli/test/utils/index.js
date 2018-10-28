import consola from 'consola'
export * from './mocking'
export { wrapAndRun } from '../../src/run'

jest.mock('consola')

consola.add = jest.fn()

export {
  consola
}
