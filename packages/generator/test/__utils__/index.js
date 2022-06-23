import { resolve } from 'path'
import { isWindows } from 'std-env'

const rootDir = isWindows ? 'C:\\nuxt' : '/var/nuxt'

export const createNuxt = () => ({
  ready: jest.fn(),
  callHook: jest.fn(),
  server: {
    renderRoute: jest.fn(() => ({ html: 'rendered html' }))
  },
  options: {
    mode: 'universal',
    srcDir: resolve(rootDir, 'src'),
    buildDir: resolve(rootDir, 'build'),
    generate: { dir: resolve(rootDir, 'generate') },
    build: { publicPath: '__public' },
    dir: { static: resolve(rootDir, 'static') },
    render: {}
  }
})

export function hookCalls (nuxt, name) {
  return nuxt.callHook.mock.calls.filter(c => c[0] === name).map(c => c.splice(1))
}
