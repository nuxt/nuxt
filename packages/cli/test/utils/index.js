import consola from 'consola'
export * from './mocking'

jest.mock('consola')

export {
  consola
}
