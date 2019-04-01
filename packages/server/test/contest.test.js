import ServerContext from '../src/context'

describe('server: ServerContext', () => {
  test('should construct context', () => {
    const server = {
      nuxt: { id: 'test-contest-nuxt' },
      globals: { id: 'test-contest-globals' },
      options: { id: 'test-contest-options' },
      resources: { id: 'test-contest-resources' }
    }
    const context = new ServerContext(server)
    expect(context.nuxt).toBe(server.nuxt)
    expect(context.globals).toEqual(server.globals)
    expect(context.options).toEqual(server.options)
    expect(context.resources).toEqual(server.resources)
  })
})
