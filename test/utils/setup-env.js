import consola from 'consola'
import env from 'std-env'
import exit from 'exit'

const isWin = env.windows

describe.win = isWin ? describe : describe.skip
test.win = isWin ? test : test.skip

describe.posix = !isWin ? describe : describe.skip
test.posix = !isWin ? test : test.skip

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
    const expectedPath = isWin ? winPath : posixPath
    const pass = received === expectedPath
    return {
      pass,
      message: () =>
        `expected path ${received} to be ${expectedPath}`
    }
  }
})
