import { mkdir, rm, writeFile } from 'node:fs/promises'
import { buildNuxt, loadNuxt } from '@nuxt/kit'
import type { Nuxt, NuxtConfig } from '@nuxt/schema'
import { dirname, join } from 'pathe'

/** Replace the contents of `dir` with `files`, keyed by their path relative to `dir`. */
export async function writeFiles (dir: string, files: Record<string, string>) {
  await rm(dir, { recursive: true, force: true })
  for (const [path, contents] of Object.entries(files)) {
    await mkdir(dirname(join(dir, path)), { recursive: true })
    await writeFile(join(dir, path), contents)
  }
}

/** Build the app in `cwd` for production, calling `setup` with the Nuxt instance before the build. */
export async function buildFixture (cwd: string, overrides: NuxtConfig = {}, setup?: (nuxt: Nuxt) => void) {
  const nuxt = await loadNuxt({
    cwd,
    ready: true,
    dev: false,
    overrides: {
      compatibilityDate: 'latest',
      devtools: { enabled: false },
      ...overrides,
    },
  })
  setup?.(nuxt)
  try {
    await buildNuxt(nuxt)
  } finally {
    await nuxt.close()
  }
}
