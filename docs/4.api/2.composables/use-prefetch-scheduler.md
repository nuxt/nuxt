---
title: usePrefetchScheduler
description: Queue custom prefetch work on the same scheduler Nuxt uses for its own link prefetches.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/internal/prefetch-scheduler.ts
    size: xs
---

Nuxt queues all client-side prefetch work (route chunks, payloads, islands and resource hints) on a single scheduler. Work queued with `usePrefetchScheduler` shares its concurrency limits and de-duplication, waits while the tab is hidden or the connection is slow, and is aborted when the user navigates elsewhere.

::important
This composable is client-only. Call it in a `.client` plugin or in a client-side hook such as `link:prefetch`.
::

```ts [Signature]
function usePrefetchScheduler (): {
  schedule: (task: PrefetchTask | PrefetchTask[]) => void
  promote: (group: string) => void
}

function prefetchGroup (url: string): string
```

## Usage

### `schedule(task)`

- `key`: A task whose key is already queued or in flight is dropped.
- `priority`: `'route'`, `'payload'`, `'island'` or `'hint'`. Queues are drained in this order.
- `scope`: `'navigation'` tasks are aborted and dequeued when the app navigates. `'app'` tasks are kept.
- `group`: The destination this work belongs to. Use `prefetchGroup(url)`. Tasks in the same group are promoted together, and are kept when the app navigates to that destination.
- `run(signal, promoted)`: Called exactly once. A dropped task is called with an aborted `signal`, so stop work when `signal` aborts.

### `promote(group)`

Moves every queued task in `group` to the front of its priority. `<NuxtLink>` already does this on hover and focus.

### `prefetchGroup(url)`

Returns the group for a URL: its path and query, without the hash.

## Example

```ts [app/plugins/prefetch-queries.client.ts]
export default defineNuxtPlugin((nuxtApp) => {
  const { schedule } = usePrefetchScheduler()

  nuxtApp.hook('link:prefetch', (url) => {
    schedule({
      key: `query:${url}`,
      priority: 'payload',
      scope: 'navigation',
      group: prefetchGroup(url),
      run: signal => $fetch('/api/prefetch', { query: { url }, signal }),
    })
  })
})
```

:read-more{to="/docs/api/advanced/hooks"}
