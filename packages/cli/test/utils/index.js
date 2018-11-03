import consola from 'consola'
export * from './mocking'
export { NuxtCommand } from '../../src'

for (const type in consola._types) {
  consola[type] = jest.fn()
}

export {
  consola
}
