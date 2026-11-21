import { describe, expect, it } from 'vitest'

import { esbuild } from '../src/presets/esbuild.ts'
import type { WebpackConfigContext } from '../src/utils/config.ts'

function excludeFor (transpile: RegExp[] = []) {
  const ctx = {
    isServer: true,
    transpile,
    config: { optimization: { minimizer: [] }, module: { rules: [] } },
    nuxt: { options: { webpack: { loaders: { esbuild: {} } } } },
  } as unknown as WebpackConfigContext
  esbuild(ctx)
  return (ctx.config.module!.rules![0] as { exclude: (file: string) => boolean }).exclude
}

describe('esbuild preset', () => {
  it('transpiles a template whose virtual id encodes a build directory in node_modules', () => {
    expect(excludeFor()('/app/_virtual_virtual%3Anuxt%3Anode_modules%252F.cache%252Fnuxt%252F.nuxt%252Fisland-renderer.mjs')).toBe(false)
  })

  it('excludes dependencies unless they are transpiled', () => {
    expect(excludeFor()('/app/node_modules/pkg/index.mjs')).toBe(true)
    expect(excludeFor([/pkg/])('/app/node_modules/pkg/index.mjs')).toBe(false)
    expect(excludeFor([/pkg/])('C:\\app\\node_modules\\pkg\\index.mjs')).toBe(false)
  })
})
