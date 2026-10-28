import { fileURLToPath } from 'node:url'
import { join } from 'pathe'
import { buildNuxt, loadNuxt, logger } from '@nuxt/kit'

/** Build a fixture that a renderer test or benchmark renders from. */
export async function buildRendererFixture (rootDir: string): Promise<void> {
  // the test resolves the build artifacts through fixed aliases, so pin the build directory
  const nuxt = await loadNuxt({ cwd: rootDir, ready: true, overrides: { ssr: true, buildDir: join(rootDir, '.nuxt') } })
  try {
    await buildNuxt(nuxt)
  } finally {
    try {
      await nuxt.close()
    } finally {
      // the build leaves stdout wrapped by consola, which swallows the reporter's output
      logger.restoreAll()
    }
  }
}

/** Build the fixture the standalone renderer test renders from. */
export default function setup (): Promise<void> {
  return buildRendererFixture(fileURLToPath(new URL('./fixtures/standalone-renderer', import.meta.url)))
}
