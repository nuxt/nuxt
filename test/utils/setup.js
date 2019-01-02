import consola from 'consola'
import chalk from 'chalk'
import env from 'std-env'

describe.skip.win = env.windows ? describe.skip : describe
test.skip.win = env.windows ? test.skip : test

chalk.enabled = false

jest.setTimeout(60000)

consola.mockTypes(() => jest.fn())
