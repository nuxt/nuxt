import commonConfig from '../../src/config/_common'

describe('config: common', () => {
  test('should return globals with given globalName', () => {
    const globalName = 'nuxt_global'
    const { globals } = commonConfig()
    expect(globals.id(globalName)).toEqual('__nuxt_global')
    expect(globals.nuxt(globalName)).toEqual('$nuxt_global')
    expect(globals.context(globalName)).toEqual('__NUXT_GLOBAL__')
    expect(globals.pluginPrefix(globalName)).toEqual('nuxt_global')
    expect(globals.readyCallback(globalName)).toEqual('onNuxt_globalReady')
    expect(globals.loadedCallback(globalName)).toEqual('_onNuxt_globalLoaded')
  })
})
