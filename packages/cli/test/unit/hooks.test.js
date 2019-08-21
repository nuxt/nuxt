import { NuxtCommand } from '../utils'

describe('dev', () => {
  let dev

  beforeAll(async () => {
    dev = await import('../../src/commands/dev').then(m => m.default)
  })

  afterEach(() => jest.clearAllMocks())

  test('config hook', async () => {
    const hooks = {
      config: jest.fn()
    }

    await NuxtCommand.run(dev, [], hooks)

    expect(hooks.config).toHaveBeenCalledWith(expect.objectContaining({
      _cli: true
    }))
  })
})
