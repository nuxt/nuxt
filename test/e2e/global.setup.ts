import { test } from '@playwright/test'
import { setup } from '../setup'

test('create temporary fixture directories', async () => {
  await setup()
})
