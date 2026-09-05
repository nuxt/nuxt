import { fileURLToPath } from 'node:url'
import { join } from 'pathe'
import { buildNuxt, loadNuxt } from '@nuxt/kit'

/** Build the fixture the standalone renderer test renders from. */
export default async function setup (): Promise<void> {
  const rootDir = fileURLToPath(new URL('./fixtures/standalone-renderer', import.meta.url))
  // the test resolves the build artifacts through fixed aliases, so pin the build directory
  const nuxt = await loadNuxt({ cwd: rootDir, ready: true, overrides: { ssr: true, buildDir: join(rootDir, '.nuxt') } })
  try {
    await buildNuxt(nuxt)
  } finally {
    await nuxt.close()
  }
}
