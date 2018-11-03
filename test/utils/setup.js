import consola from 'consola'
import chalk from 'chalk'

const isWin = process.platform === 'win32'
describe.skip.win = isWin ? describe.skip : describe
test.skip.win = isWin ? test.skip : test

chalk.enabled = false

jest.setTimeout(60000)

consola.mockTypes(() => jest.fn())
