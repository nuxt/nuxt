import { test as setup } from '@playwright/test'

import { ensureFixturesPrepared } from '../fixture-prepare'
import { copyFixture } from '../fixture-copy'

const fixtures: [source: string, dest: string][] = [
  ['hmr', 'hmr'],
  ['hmr-sibling-layer', 'hmr-sibling-layer'],
  ['dev-error-client', 'dev-error-client'],
  ...['dev-error-sourcemap', 'dev-error-recovery', 'dev-error-compile', 'dev-error-expected']
    .map(dest => ['dev-error-sourcemap', dest] as [string, string]),
]

setup('create temporary hmr fixture directory', async () => {
  await ensureFixturesPrepared()
  for (const [source, dest] of fixtures) {
    copyFixture(source, dest)
  }
})
