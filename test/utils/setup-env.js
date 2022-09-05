import consola from 'consola'
import { isWindows } from 'std-env'
import exit from 'exit'

describe.win = isWindows ? describe : describe.skip
test.win = isWindows ? test : test.skip

describe.posix = !isWindows ? describe : describe.skip
test.posix = !isWindows ? test : test.skip

jest.setTimeout(60000)

consola.mockTypes(() => jest.fn())

function errorTrap (error) {
  process.stderr.write('\n' + error.stack + '\n')
  exit(1)
}

process.on('unhandledRejection', errorTrap)
process.on('uncaughtException', errorTrap)

expect.extend({
  toBePath (received, posixPath, winPath) {
    const expectedPath = isWindows ? winPath : posixPath
    const pass = received === expectedPath
    return {
      pass,
      message: () =>
        `expected path ${received} to be ${expectedPath}`
    }
  }
})
