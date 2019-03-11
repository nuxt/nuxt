import renderConfig from '../../src/config/render'

describe('config: render', () => {
  test('should return false in default shouldPrefetch', () => {
    const { bundleRenderer: { shouldPrefetch } } = renderConfig()
    expect(shouldPrefetch()).toEqual(false)
  })

  test('should return true in script/style shouldPreload', () => {
    const { bundleRenderer: { shouldPreload } } = renderConfig()
    expect(shouldPreload(undefined, 'script')).toEqual(true)
    expect(shouldPreload(undefined, 'style')).toEqual(true)
  })

  test('should return false in other shouldPreload', () => {
    const { bundleRenderer: { shouldPreload } } = renderConfig()
    expect(shouldPreload(undefined, 'font')).toEqual(false)
  })
})
