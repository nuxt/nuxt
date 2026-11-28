import { describe, expect, it } from 'vitest'
import { basename } from 'pathe'
import { reorderLocalLayersByExtends } from '../src/loader/config.ts'

type Layers = Parameters<typeof reorderLocalLayersByExtends>[0]

function layer (cwd: string, rootDir: string) {
  return { cwd, config: { rootDir } } as unknown as Layers[number]
}

describe('reorderLocalLayersByExtends', () => {
  it('uses canonical loading directories when a layer overrides rootDir', () => {
    const layers = [
      layer('/root', '/root'),
      layer('/root/layers/a', '/root/layers/a'),
      layer('/root/layers/b', '/custom'),
    ] as Layers
    reorderLocalLayersByExtends(
      layers,
      ['/root/layers/a', '/root/layers/b'],
      new Set(['/root/layers/a', '/root/layers/b']),
      [['/root/layers/b', '/root/layers/a']],
    )
    expect(layers.map(l => basename(l.cwd!))).toEqual(['root', 'b', 'a'])
  })

  it('keeps distinct loading directories in separate slots when they share rootDir', () => {
    const layers = [
      layer('/root', '/root'),
      layer('/root/layers/a', '/root/layers/a'),
      layer('/root/layers/b', '/custom'),
      layer('/root/layers/c', '/custom'),
    ] as Layers
    reorderLocalLayersByExtends(
      layers,
      ['/root/layers/a', '/root/layers/b', '/root/layers/c'],
      new Set(['/root/layers/a', '/root/layers/b', '/root/layers/c']),
      [['/root/layers/b', '/root/layers/a'], ['/root/layers/c', '/root/layers/b']],
    )
    expect(layers.map(l => basename(l.cwd!))).toEqual(['root', 'c', 'b', 'a'])
  })
})
