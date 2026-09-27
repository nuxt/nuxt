import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'pathe'
import { afterEach, describe, expect, it } from 'vitest'

import { getH3ImportsPreset, v2ImportsPreset, withImportTypeShims } from './imports.ts'

const dirs: string[] = []
function shimDir () {
  const dir = mkdtempSync(join(tmpdir(), 'nitro-import-shims-'))
  dirs.push(dir)
  return join(dir, 'shims')
}

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('withImportTypeShims', () => {
  it('points a preset resolved through an `exports` subpath at a shim', async () => {
    const dir = shimDir()
    const { presets, writeShims } = withImportTypeShims([await getH3ImportsPreset()], dir)
    await writeShims()

    expect(presets[0]!.typeFrom).toBe(join(dir, 'nitro_h3.ts'))
    expect(readdirSync(dir)).toStrictEqual(['nitro_h3.ts'])
  })

  it('re-exports the resolved file by relative path, extension intact', async () => {
    const dir = shimDir()
    const { writeShims } = withImportTypeShims([await getH3ImportsPreset()], dir)
    await writeShims()

    const [, specifier] = /export \* from '([^']+)'/.exec(readFileSync(join(dir, 'nitro_h3.ts'), 'utf-8')) || []

    // a bare specifier would not resolve under pnpm's isolated layout, and stripping the extension
    // would miss the sibling declaration file
    expect(specifier).toMatch(/^\.\.?\//)
    expect(specifier).toMatch(/\.mjs$/)
    expect(existsSync(resolve(dir, specifier!))).toBe(true)
  })

  it('leaves a preset Nuxt resolves itself alone', () => {
    const absolute = { from: '/project/server/utils/thing', imports: ['thing'] }
    const bare = { from: 'nitro', imports: ['defineRouteMeta'] }

    const { presets } = withImportTypeShims([absolute, bare], shimDir())

    expect(presets.map(preset => preset.typeFrom)).toStrictEqual([undefined, undefined])
  })

  it('writes nothing until asked, so the shims survive a cleared build directory', () => {
    const dir = shimDir()
    withImportTypeShims(v2ImportsPreset, dir)

    expect(existsSync(dir)).toBe(false)
  })

  it('shims a preset if and only if it is reached through a subpath', async () => {
    const dir = shimDir()
    const all = [...v2ImportsPreset, await getH3ImportsPreset()]
    const { presets, writeShims } = withImportTypeShims(all, dir)
    await writeShims()

    // derived rather than listed, so adding a preset does not need this test updating: a subpath is
    // what Nitro derives the type path from wrongly, and `nitro` itself resolves to a file in its
    // own package
    const bySubpath = Object.fromEntries(all.map(preset => [preset.from, preset.from.includes('/')]))
    expect(Object.fromEntries(presets.map(preset => [preset.from, !!preset.typeFrom]))).toStrictEqual(bySubpath)
    expect(readdirSync(dir)).toHaveLength(Object.values(bySubpath).filter(Boolean).length)
  })
})
