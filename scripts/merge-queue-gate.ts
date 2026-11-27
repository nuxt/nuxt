import { appendFileSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

export type MergeQueueEntryState = 'QUEUED' | 'AWAITING_CHECKS' | 'MERGEABLE' | 'UNMERGEABLE' | 'LOCKED'

export interface MergeQueueEntry {
  position: number
  state: MergeQueueEntryState
  headCommit: { oid: string } | null
}

/**
 * - `full`: no entry behind this one is building, so this entry decides the merge
 * - `covered`: an entry behind this one has passed its checks
 * - `gone`: this entry is no longer in the queue (merged or removed)
 * - `wait`: an entry behind this one is still building
 */
export type GateState = 'full' | 'covered' | 'gone' | 'wait'

export function evaluateGate (entries: MergeQueueEntry[], headSha: string): GateState {
  const sorted = entries.toSorted((a, b) => a.position - b.position)
  const index = sorted.findIndex(entry => entry.headCommit?.oid === headSha)
  if (index === -1) {
    return 'gone'
  }
  const behind = sorted.slice(index + 1)
  if (behind.some(entry => entry.state === 'MERGEABLE')) {
    return 'covered'
  }
  // `QUEUED` entries have no merge group yet and `UNMERGEABLE` ones are about to be removed
  if (behind.some(entry => entry.state === 'AWAITING_CHECKS' || entry.state === 'LOCKED')) {
    return 'wait'
  }
  return 'full'
}

const MERGE_QUEUE_QUERY = `
  query ($owner: String!, $name: String!, $branch: String!) {
    repository(owner: $owner, name: $name) {
      mergeQueue(branch: $branch) {
        entries(first: 100) {
          nodes { position state headCommit { oid } }
        }
      }
    }
  }
`

interface MergeQueueResponse {
  data?: { repository: { mergeQueue: { entries: { nodes: MergeQueueEntry[] } } | null } | null }
  errors?: { message: string }[]
}

export interface FetchMergeQueueOptions {
  token: string
  repository: string
  branch: string
  url?: string
}

export async function fetchMergeQueueEntries (options: FetchMergeQueueOptions): Promise<MergeQueueEntry[]> {
  const [owner, name] = options.repository.split('/')
  const response = await fetch(options.url || 'https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'authorization': `bearer ${options.token}`,
      'content-type': 'application/json',
      'user-agent': 'nuxt-merge-queue-gate',
    },
    body: JSON.stringify({ query: MERGE_QUEUE_QUERY, variables: { owner, name, branch: options.branch } }),
  })
  if (!response.ok) {
    throw new Error(`GitHub GraphQL API responded with ${response.status} ${response.statusText}`)
  }
  const body = await response.json() as MergeQueueResponse
  if (body.errors?.length) {
    throw new Error(body.errors.map(error => error.message).join('\n'))
  }
  if (!body.data?.repository) {
    throw new Error(`Repository ${options.repository} not found`)
  }
  return body.data.repository.mergeQueue?.entries.nodes ?? []
}

export interface WaitForGateOptions {
  headSha: string
  fetchEntries: () => Promise<MergeQueueEntry[]>
  /** Milliseconds between polls. */
  interval?: number
  /** Milliseconds after which to stop polling and run the full checks. */
  timeout?: number
  /** Consecutive API failures after which to stop polling and run the full checks. */
  maxErrors?: number
  sleep?: (ms: number) => Promise<unknown>
  now?: () => number
  log?: (message: string) => void
}

/**
 * Polls the merge queue until it is clear whether the entry with `headSha` needs to run the
 * full checks. Resolves to `true` when it does.
 */
export async function waitForGate (options: WaitForGateOptions): Promise<boolean> {
  const {
    headSha,
    fetchEntries,
    interval = 30_000,
    timeout = 150 * 60_000,
    maxErrors = 3,
    now = Date.now,
    log = console.debug,
  } = options
  const wait = options.sleep ?? sleep
  const start = now()
  let errors = 0
  let seen = false
  let full = 0
  let gone = 0

  while (true) {
    let state: GateState | undefined
    try {
      state = evaluateGate(await fetchEntries(), headSha)
      errors = 0
    } catch (error) {
      errors++
      log(`Could not read the merge queue: ${error instanceof Error ? error.message : error}`)
      if (errors >= maxErrors) {
        log('Running full checks')
        return true
      }
    }

    if (state) {
      log(`Merge queue state for ${headSha}: ${state}`)
    }
    if (state === 'covered') {
      return false
    }
    if (state === 'gone' && !seen) {
      log('This entry was not found in the merge queue; running full checks')
      return true
    }
    if (state && state !== 'gone') {
      seen = true
    }
    // a second consecutive observation lets entries queued just behind this one start building,
    // and guards against a transient read without this entry
    full = state === 'full' ? full + 1 : 0
    gone = state === 'gone' ? gone + 1 : 0
    if (full >= 2) {
      return true
    }
    if (gone >= 2) {
      return false
    }

    if (now() - start >= timeout) {
      log('Timed out waiting for the merge queue; running full checks')
      return true
    }
    await wait(interval)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_GRAPHQL_URL, GITHUB_OUTPUT, BASE_REF, HEAD_SHA } = process.env
  if (!GITHUB_TOKEN || !GITHUB_REPOSITORY || !BASE_REF || !HEAD_SHA) {
    throw new Error('GITHUB_TOKEN, GITHUB_REPOSITORY, BASE_REF and HEAD_SHA are required')
  }
  const branch = BASE_REF.replace(/^refs\/heads\//, '')
  const full = await waitForGate({
    headSha: HEAD_SHA,
    fetchEntries: () => fetchMergeQueueEntries({ token: GITHUB_TOKEN, repository: GITHUB_REPOSITORY, branch, url: GITHUB_GRAPHQL_URL }),
  })
  console.debug(`full=${full}`)
  if (GITHUB_OUTPUT) {
    appendFileSync(GITHUB_OUTPUT, `full=${full}\n`)
  }
}
