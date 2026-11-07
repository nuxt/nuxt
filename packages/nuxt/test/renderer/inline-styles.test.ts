import { runInNewContext } from 'node:vm'
import { afterEach, describe, expect, it, vi } from 'vitest'

const styleMap = vi.hoisted(() => ({}) as Record<string, () => Promise<string[]>>)

vi.mock('../../src/runtime/server/renderer/build-files', () => ({
  getSSRStyles: () => Promise.resolve(styleMap),
}))

const { renderSplitInlineStyles } = await import('../../src/runtime/server/renderer/inline-styles.ts')

describe('renderSplitInlineStyles', () => {
  afterEach(() => {
    for (const key in styleMap) { delete styleMap[key] }
    vi.unstubAllGlobals()
  })

  it('splits entry styles from the rest', async () => {
    styleMap.entry = () => Promise.resolve(['.shared{}', '.entry{}'])
    styleMap.page = () => Promise.resolve(['.shared{}', '.page{}'])
    expect(await renderSplitInlineStyles(['entry', 'page'], ['entry'])).toEqual([
      [{ innerHTML: '.shared{}' }, { innerHTML: '.entry{}' }],
      [{ innerHTML: '.page{}' }],
    ])
  })

  it.each([
    ['caches loaded styles in production', false, 1],
    ['reloads styles on every render in development', true, 3],
  ])('%s', async (_, dev, loads) => {
    vi.stubGlobal('__TEST_DEV__', dev)
    const loader = vi.fn(() => Promise.resolve(['.page{}']))
    styleMap.page = loader
    for (let i = 0; i < 3; i++) {
      expect(await renderSplitInlineStyles(['page'], [])).toEqual([[], [{ innerHTML: '.page{}' }]])
    }
    expect(loader).toHaveBeenCalledTimes(loads)
  })

  it('retries a loader that rejected', async () => {
    const loader = vi.fn()
      .mockRejectedValueOnce(new Error('failed'))
      .mockResolvedValue(['.page{}'])
    styleMap.page = loader
    await expect(renderSplitInlineStyles(['page'], [])).rejects.toThrow('failed')
    expect(await renderSplitInlineStyles(['page'], [])).toEqual([[], [{ innerHTML: '.page{}' }]])
  })

  it.each([false, true])('awaits a promise from another realm (dev: %s)', async (dev) => {
    vi.stubGlobal('__TEST_DEV__', dev)
    styleMap.page = () => runInNewContext('Promise.resolve([".page{}"])')
    expect(await renderSplitInlineStyles(['page'], [])).toEqual([[], [{ innerHTML: '.page{}' }]])
  })
})
