import { describe, expect, it } from 'vitest'
import { addTypeTemplate, buildNuxt, loadNuxt } from '../src/index.ts'
import { findWorkspaceDir } from 'pkg-types'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'

describe('addTypeTemplate', () => {
  it('should add type templates to vue global files', { timeout: 20_000 }, async () => {
    const repoRoot = await findWorkspaceDir()
    const rootDir = resolve(repoRoot, 'node_modules/.fixture', randomUUID())
    await mkdir(rootDir, { recursive: true })
    await writeFile(resolve(rootDir, 'app.vue'), `
      <script setup lang="ts">
      defineProps<TestComponentProps>()
      </script>
      <template><div /></template>
    `)
    const nuxt = await loadNuxt({
      cwd: rootDir,
      overrides: {
        modules: [
          function () {
            addTypeTemplate({
              filename: 'some-type-template.d.ts',
              getContents: () => `
                declare global {
                  type TestComponentProps = { foo?: string }
                }
                export {};
              `,
            })
          },
        ],
      },
    })

    await expect(buildNuxt(nuxt)).resolves.not.toThrow()

    await nuxt.close()
  })
})
