import { fileURLToPath } from 'node:url'
import { exec } from 'tinyexec'

/**
 * Build a fixture that a renderer test or benchmark renders from.
 *
 * The build runs in a child process, because loading a Nuxt instance in this one installs
 * module hooks that stop Vitest from collecting the tests that follow.
 */
export async function buildRendererFixture (rootDir: string): Promise<void> {
  await exec('pnpm', ['nuxt', 'build'], { nodeOptions: { cwd: rootDir }, throwOnError: true })
}

/** Build the fixture the standalone renderer test renders from. */
export default function setup (): Promise<void> {
  return buildRendererFixture(fileURLToPath(new URL('./fixtures/standalone-renderer', import.meta.url)))
}
