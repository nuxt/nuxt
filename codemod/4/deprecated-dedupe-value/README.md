This codemod removes deprecated boolean values for the dedupe option in refresh calls, replacing them with string literals cancel and defer

🚦 **Impact Level**: Minimal

## What Changed

Previously, it was possible to pass `dedupe: boolean` to `refresh`. These were aliases of `cancel` (true) and `defer` (false).

## Before

```jsx
const { refresh } = await useAsyncData(async () => ({ message: 'Hello, Nuxt 3!' }))

async function refreshData () {
  await refresh({ dedupe: true })
  await refresh({ dedupe: false })
}
```

## After

```jsx
const { refresh } = await useAsyncData(async () => ({ message: 'Hello, Nuxt 3!' }))

async function refreshData () {
  await refresh({ dedupe: 'cancel' })
  await refresh({ dedupe: 'defer' })
}

```
