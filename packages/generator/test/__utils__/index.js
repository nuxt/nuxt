export const createNuxt = () => ({
  ready: jest.fn(),
  callHook: jest.fn(),
  server: {
    renderRoute: jest.fn(() => ({ html: 'rendered html' }))
  },
  options: {
    mode: 'universal',
    srcDir: '/var/nuxt/src',
    buildDir: '/var/nuxt/build',
    generate: { dir: '/var/nuxt/generate' },
    build: { publicPath: '__public' },
    dir: { static: '/var/nuxt/static' },
    render: {}
  }
})

export function hookCalls (nuxt, name) {
  return nuxt.callHook.mock.calls.filter(c => c[0] === name).map(c => c.splice(1))
}
