export const createNuxt = () => ({
  ready: jest.fn(),
  callHook: jest.fn(),
  server: {
    renderRoute: jest.fn(() => ({ html: 'rendered html' }))
  },
  options: {
    srcDir: '/var/nuxt/src',
    buildDir: '/var/nuxt/build',
    generate: { dir: '/var/nuxt/generate' },
    build: { publicPath: '__public' },
    dir: { static: '/var/nuxt/static' }
  }
})
