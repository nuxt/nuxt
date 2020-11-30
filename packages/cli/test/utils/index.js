import path from 'path'
import consola from 'consola'

export * from './mocking'
export { NuxtCommand } from '../../src'

consola.mockTypes(() => jest.fn())

const localPath = modulePath => path.resolve(process.cwd(), 'node_modules', modulePath)

export {
  consola,
  localPath
}
