import { afterEach, describe, expect, it, vi } from 'vitest'

import { evaluateGate, fetchMergeQueueEntries, waitForGate } from './merge-queue-gate.ts'
import type { MergeQueueEntry, MergeQueueEntryState } from './merge-queue-gate.ts'

const OWN = 'a'.repeat(40)

function entry (position: number, state: MergeQueueEntryState, oid: string | null = String(position).repeat(40)): MergeQueueEntry {
  return { position, state, headCommit: oid ? { oid } : null }
}

function graphqlResponse (entries: MergeQueueEntry[] | null) {
  return Response.json({
    data: { repository: { mergeQueue: entries && { entries: { nodes: entries } } } },
  })
}

function mockQueue (...polls: Array<MergeQueueEntry[] | null | Response>) {
  const fetch = vi.fn<typeof globalThis.fetch>()
  for (const poll of polls) {
    fetch.mockResolvedValueOnce(poll instanceof Response ? poll : graphqlResponse(poll))
  }
  fetch.mockRejectedValue(new Error('unexpected poll'))
  vi.stubGlobal('fetch', fetch)
  return fetch
}

function gate (options: { timeout?: number, now?: () => number } = {}) {
  return waitForGate({
    headSha: OWN,
    fetchEntries: () => fetchMergeQueueEntries({ token: 'token', repository: 'nuxt/nuxt', branch: 'main' }),
    sleep: () => Promise.resolve(),
    log: () => {},
    ...options,
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('merge queue gate', () => {
  it('runs full checks for the last entry in the queue', async () => {
    const queue = [entry(1, 'AWAITING_CHECKS'), entry(2, 'AWAITING_CHECKS', OWN)]
    const fetch = mockQueue(queue, queue)

    expect(await gate()).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(JSON.parse(fetch.mock.calls[0]![1]!.body as string).variables).toEqual({ owner: 'nuxt', name: 'nuxt', branch: 'main' })
  })

  it('runs full checks when the entries behind have not been built', async () => {
    const queue = [entry(1, 'AWAITING_CHECKS', OWN), entry(2, 'QUEUED', null), entry(3, 'QUEUED', null)]
    mockQueue(queue, queue)

    expect(await gate()).toBe(true)
  })

  it('keeps polling when an entry joins behind it after the first poll', async () => {
    const fetch = mockQueue(
      [entry(1, 'AWAITING_CHECKS', OWN)],
      [entry(1, 'AWAITING_CHECKS', OWN), entry(2, 'AWAITING_CHECKS')],
      [entry(1, 'AWAITING_CHECKS', OWN), entry(2, 'MERGEABLE')],
    )

    expect(await gate()).toBe(false)
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('skips full checks once a later entry passes', async () => {
    const fetch = mockQueue(
      [entry(1, 'AWAITING_CHECKS', OWN), entry(2, 'AWAITING_CHECKS'), entry(3, 'AWAITING_CHECKS')],
      [entry(1, 'AWAITING_CHECKS', OWN), entry(2, 'AWAITING_CHECKS'), entry(3, 'MERGEABLE')],
    )

    expect(await gate()).toBe(false)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('runs full checks once a failing later entry is removed', async () => {
    const fetch = mockQueue(
      [entry(1, 'AWAITING_CHECKS'), entry(2, 'AWAITING_CHECKS', OWN), entry(3, 'AWAITING_CHECKS')],
      [entry(1, 'AWAITING_CHECKS'), entry(2, 'AWAITING_CHECKS', OWN), entry(3, 'AWAITING_CHECKS')],
      [entry(1, 'AWAITING_CHECKS'), entry(2, 'AWAITING_CHECKS', OWN)],
      [entry(1, 'AWAITING_CHECKS'), entry(2, 'AWAITING_CHECKS', OWN)],
    )

    expect(await gate()).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(4)
  })

  it('runs full checks when a later entry becomes unmergeable', async () => {
    mockQueue(
      [entry(1, 'AWAITING_CHECKS', OWN), entry(2, 'AWAITING_CHECKS')],
      [entry(1, 'AWAITING_CHECKS', OWN), entry(2, 'UNMERGEABLE')],
      [entry(1, 'AWAITING_CHECKS', OWN)],
    )

    expect(await gate()).toBe(true)
  })

  it('runs full checks when its own entry is never found', async () => {
    const fetch = mockQueue([entry(1, 'AWAITING_CHECKS'), entry(2, 'AWAITING_CHECKS')])

    expect(await gate()).toBe(true)
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('runs full checks when there is no merge queue', async () => {
    const fetch = mockQueue(null)

    expect(await gate()).toBe(true)
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('skips full checks once its own entry has been merged', async () => {
    const fetch = mockQueue(
      [entry(1, 'AWAITING_CHECKS', OWN), entry(2, 'AWAITING_CHECKS')],
      [],
      null,
    )

    expect(await gate()).toBe(false)
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('keeps polling when its own entry is missing from a single read', async () => {
    const fetch = mockQueue(
      [entry(1, 'AWAITING_CHECKS', OWN), entry(2, 'AWAITING_CHECKS')],
      [entry(2, 'AWAITING_CHECKS')],
      [entry(1, 'AWAITING_CHECKS', OWN), entry(2, 'AWAITING_CHECKS')],
      [entry(1, 'AWAITING_CHECKS', OWN)],
      [entry(1, 'AWAITING_CHECKS', OWN)],
    )

    expect(await gate()).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(5)
  })

  it('waits while a later entry is locked', async () => {
    const fetch = mockQueue(
      [entry(1, 'AWAITING_CHECKS', OWN), entry(2, 'LOCKED')],
      [],
      [],
    )

    expect(await gate()).toBe(false)
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('runs full checks when the merge queue cannot be read', async () => {
    const fetch = mockQueue(
      new Response('', { status: 502 }),
      Response.json({ errors: [{ message: 'rate limited' }] }),
      new Response('', { status: 401 }),
    )

    expect(await gate()).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('runs full checks when the wait times out', async () => {
    let time = 0
    const fetch = mockQueue(
      [entry(1, 'AWAITING_CHECKS', OWN), entry(2, 'AWAITING_CHECKS')],
      [entry(1, 'AWAITING_CHECKS', OWN), entry(2, 'AWAITING_CHECKS')],
    )

    expect(await gate({ timeout: 10, now: () => (time += 6) })).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('compares entries by position rather than response order', () => {
    expect(evaluateGate([entry(2, 'MERGEABLE'), entry(1, 'AWAITING_CHECKS', OWN)], OWN)).toBe('covered')
    expect(evaluateGate([entry(2, 'AWAITING_CHECKS', OWN), entry(1, 'MERGEABLE')], OWN)).toBe('full')
  })
})
