export const createNuxt = () => ({
  options: {
    globalName: 'global_name',
    globals: [],
    build: {},
    router: {}
  },
  ready: jest.fn(),
  hook: jest.fn(),
  callHook: jest.fn(),
  resolver: {
    requireModule: jest.fn(() => ({ template: 'builder-template' })),
    resolveAlias: jest.fn(src => `resolveAlias(${src})`)
  }
})
