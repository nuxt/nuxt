import { test } from '@playwright/test'
import { teardown } from '../setup'

test('remove temporary fixture directories', async () => {
  await teardown()
})
