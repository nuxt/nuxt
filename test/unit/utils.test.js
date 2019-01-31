import { waitUntil } from '../utils'

describe('utils', () => {
  test('waitUntil', async () => {
    expect(await waitUntil(() => true, 0.1, 100)).toBe(false)
    expect(await waitUntil(() => false, 0.1, 100)).toBe(true)
  })
})
