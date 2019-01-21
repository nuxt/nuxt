
import chalk from 'chalk'

import listCommands from '../../src/list'
import getCommand from '../../src/commands'
import { indent, foldLines, colorize } from '../../src/utils/formatting'

jest.mock('chalk', () => ({ green: jest.fn(text => text) }))
jest.mock('../../src/commands')
jest.mock('../../src/utils/formatting')

describe('list', () => {
  beforeAll(() => {
    const commands = {
      dev: { usage: 'dev', description: 'dev desc' },
      build: { usage: 'build', description: 'build desc' },
      generate: { usage: 'generate', description: 'generate desc' },
      start: { usage: 'start', description: 'start desc' },
      help: { usage: 'help', description: 'help desc' }
    }
    indent.mockReturnValue(' ')
    colorize.mockImplementation(text => text)
    getCommand.mockImplementation(cmd => commands[cmd])
    process.stderr.write = jest.fn()
  })

  test('should list all commands', async () => {
    await listCommands()

    expect(indent).toBeCalledTimes(5)
    expect(indent).nthCalledWith(1, 7)
    expect(indent).nthCalledWith(2, 5)
    expect(indent).nthCalledWith(3, 2)
    expect(indent).nthCalledWith(4, 5)
    expect(indent).nthCalledWith(5, 6)

    expect(chalk.green).toBeCalledTimes(5)
    expect(chalk.green).nthCalledWith(1, 'dev')
    expect(chalk.green).nthCalledWith(2, 'build')
    expect(chalk.green).nthCalledWith(3, 'generate')
    expect(chalk.green).nthCalledWith(4, 'start')
    expect(chalk.green).nthCalledWith(5, 'help')

    const spaces = [14, 4]
    expect(foldLines).toBeCalledTimes(7)
    expect(foldLines).nthCalledWith(1, 'dev dev desc', ...spaces)
    expect(foldLines).nthCalledWith(2, 'build build desc', ...spaces)
    expect(foldLines).nthCalledWith(3, 'generate generate desc', ...spaces)
    expect(foldLines).nthCalledWith(4, 'start start desc', ...spaces)
    expect(foldLines).nthCalledWith(5, 'help help desc', ...spaces)
    expect(foldLines).nthCalledWith(6, 'Usage: nuxt <command> [--help|-h]', 2)
    expect(foldLines).nthCalledWith(7, 'Commands:', 2)

    expect(colorize).toBeCalledTimes(1)
    expect(process.stderr.write).toBeCalledTimes(1)
  })
})
