import consola from 'consola'
export * from './mocking'

jest.mock('consola')

consola.add = jest.fn()

export {
  consola
}
