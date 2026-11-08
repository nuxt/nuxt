import { dirname, join } from 'pathe'
import { resolveModulePath } from 'exsolve'
import { rolldown } from 'rolldown'
import { describe, expect, it } from 'vitest'

import { runtimeConfigPlugin } from '../src/runtime-config.ts'

const RUNTIME_CONFIG = '/nuxt/nitro-server/dist/runtime/runtime-config'

async function bundle (code: string, strict?: boolean) {
  const build = await rolldown({
    input: 'entry',
    external: id => id === RUNTIME_CONFIG,
    plugins: [
      runtimeConfigPlugin(RUNTIME_CONFIG, { strict }),
      {
        name: 'virtual',
        resolveId: id => id === 'entry' || id === '#nitro/virtual/runtime-config' ? id : undefined,
        load: id => id === 'entry' ? code : id === '#nitro/virtual/runtime-config' ? 'export const runtimeConfig = {}' : undefined,
      },
    ],
  })
  try {
    const { output } = await build.generate({ format: 'esm' })
    return output[0].code
  } finally {
    await build.close()
  }
}

describe('runtimeConfigPlugin', () => {
  it('should replace nitro\'s runtime config implementation', async () => {
    const internal = join(dirname(resolveModulePath('nitro/runtime-config', { from: import.meta.url })), 'internal/runtime-config.mjs')
    const code = await bundle([
      `import { useRuntimeConfig as a } from 'nitro/runtime-config'`,
      `import { useRuntimeConfig as b } from ${JSON.stringify(internal)}`,
      `export { a, b }`,
    ].join('\n'), true)

    expect(code).toContain(`from "${RUNTIME_CONFIG}"`)
    expect(code).not.toContain('applyEnv')
    expect(code).not.toContain('#nitro/virtual/runtime-config')
  })

  it('should throw when nitro does not provide its runtime config', async () => {
    const build = rolldown({
      input: `${RUNTIME_CONFIG}.mjs`,
      plugins: [
        runtimeConfigPlugin(RUNTIME_CONFIG),
        {
          name: 'virtual',
          resolveId: id => id === `${RUNTIME_CONFIG}.mjs` ? id : undefined,
          load: id => id === `${RUNTIME_CONFIG}.mjs` ? `export { runtimeConfig } from '#nitro/virtual/runtime-config'` : undefined,
        },
      ],
    }).then(build => build.generate({ format: 'esm' }))

    await expect(build).rejects.toThrow('NUXT_B9012')
  })

  it('should leave modules that only read the runtime config', async () => {
    const code = await bundle([
      `import { runtimeConfig } from '#nitro/virtual/runtime-config'`,
      `export const getBaseURL = () => runtimeConfig.app?.baseURL`,
    ].join('\n'))

    expect(code).toContain('getBaseURL')
    expect(code).not.toContain(RUNTIME_CONFIG)
  })

  it('should throw in strict mode when no implementation was replaced', async () => {
    await expect(bundle(`export const useRuntimeConfig = () => ({})`, true)).rejects.toThrow('NUXT_B9012')
  })
})
