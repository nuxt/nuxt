import consola from 'consola'
import chalk from 'chalk'
import env from 'std-env'

const isWin = env.windows

describe.win = isWin ? describe : describe.skip
test.win = isWin ? test : test.skip

describe.posix = !isWin ? describe : describe.skip
test.posix = !isWin ? test : test.skip

chalk.enabled = false

jest.setTimeout(60000)

consola.mockTypes(() => jest.fn())

function errorTrap(...args) {
  // eslint-disable-next-line no-console
  console.error(...args)
  // eslint-disable-next-line no-console
  console.warn('Closing proccess due to unhandled error!')
  process.exit(1)
}
process.on('unhandledRejection', errorTrap)
process.on('uncaughtException', errorTrap)
