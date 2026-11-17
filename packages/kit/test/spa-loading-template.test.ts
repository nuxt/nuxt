import { mkdir } from 'node:fs/promises'
import { join } from 'pathe'
import type { Nuxt, NuxtOptions } from '@nuxt/schema'
import { describe, expect, it } from 'vitest'

import { resolveSpaLoadingTemplate } from '../src/internal/spa-loading-template.ts'
import { withTempDir } from './utils.ts'

const nuxtIn = (srcDir: string, spaLoadingTemplate: NuxtOptions['spaLoadingTemplate'], layerDirs = [srcDir]) => ({
  options: { srcDir, dir: { app: 'app' }, spaLoadingTemplate, _layers: layerDirs.map(layerDir => ({ config: { srcDir: layerDir, dir: { app: 'app' } } })) },
}) as unknown as Nuxt

describe('resolveSpaLoadingTemplate', () => {
  it.each([
    ['nothing when disabled', false, { 'app/spa-loading-template.html': 'custom' }, ''],
    ['the app template when enabled', true, { 'app/spa-loading-template.html': ' custom\n' }, 'custom'],
    ['a configured template path', 'loader.html', { 'loader.html': 'configured' }, 'configured'],
    ['nothing for a missing configured path', 'missing.html', {}, ''],
  ] as const)('renders %s', (_, option, files, expected) => withTempDir(files, async (dir) => {
    expect(await resolveSpaLoadingTemplate(nuxtIn(dir, option))).toBe(expected)
  }))

  it('falls back to the built-in template when the app template cannot be read', () => withTempDir({}, async (dir) => {
    await mkdir(join(dir, 'app/spa-loading-template.html'), { recursive: true })
    expect(await resolveSpaLoadingTemplate(nuxtIn(dir, true))).toContain('class="nuxt-spa-loading"')
  }))

  it('skips a directory in a higher-priority layer for a lower layer template', () => withTempDir({ 'base/app/spa-loading-template.html': 'base' }, async (dir) => {
    await mkdir(join(dir, 'app/spa-loading-template.html'), { recursive: true })
    expect(await resolveSpaLoadingTemplate(nuxtIn(dir, true, [dir, join(dir, 'base')]))).toBe('base')
  }))
})
