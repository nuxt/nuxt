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
