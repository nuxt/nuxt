import { fileURLToPath } from 'node:url'
import { exec } from 'tinyexec'

/**
 * Build the fixture the standalone renderer test renders from.
 *
 * The build runs in a child process, because loading a Nuxt instance in this one installs
 * module hooks that stop Vitest from collecting the tests that follow.
 */
export default async function setup (): Promise<void> {
  const rootDir = fileURLToPath(new URL('./fixtures/standalone-renderer', import.meta.url))
  await exec('pnpm', ['nuxt', 'build'], { nodeOptions: { cwd: rootDir }, throwOnError: true })
}
