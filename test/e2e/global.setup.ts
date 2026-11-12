import { test as setup } from '@playwright/test'

import { ensureFixturesPrepared } from '../fixture-prepare'
import { copyFixture } from '../fixture-copy'
import { tempFixtures } from './temp-fixture'

setup('create temporary fixture directories', async () => {
  await ensureFixturesPrepared()
  for (const [dest, source] of Object.entries(tempFixtures)) {
    copyFixture(source, dest)
  }
})
