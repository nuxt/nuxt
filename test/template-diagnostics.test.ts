import { fileURLToPath } from 'node:url'
import { stripVTControlCharacters } from 'node:util'
import { describe, expect, it } from 'vitest'
import { exec } from 'tinyexec'
import { runsOncePerBuilderInMatrix } from './matrix'

describe.skipIf(!runsOncePerBuilderInMatrix)('template diagnostics', () => {
  const rootDir = fileURLToPath(new URL('./fixtures/template-diagnostics', import.meta.url))

  it('prints a warning with its template location for each check', async () => {
    const result = await exec('pnpm', ['nuxt', 'build', rootDir], { throwOnError: false })
    const output = stripVTControlCharacters(result.stdout + result.stderr)

    expect(result.exitCode, output).toBe(0)
    expect(output).toMatch(/\[NUXT_B4025\].*\/abuot.*app\/pages\/broken-link\.vue/)
    expect(output).toContain('sources: app/pages/broken-link.vue:3:15')
    expect(output).toContain('see: https://nuxt.com/docs/4.x/errors/b4025')
    expect(output).toMatch(/\[NUXT_B3014\].*@click.*app\/pages\/server-listener\.vue/)
    expect(output).toContain('sources: app/pages/server-listener.vue:9:7')
    expect(output).toMatch(/\[NUXT_B3015\].*format.*app\/pages\/island-props\.vue/)
    expect(output).toContain('sources: app/pages/island-props.vue:9:7')
    expect(output).toMatch(/\[NUXT_B3015\].*format.*NuxtIsland name="ServerCard".*app\/pages\/island-props\.vue/)
    expect(output).toContain('sources: app/pages/island-props.vue:13:7')
  }, 240 * 1000)
})
