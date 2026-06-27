# Nuxt Hydration Best Practices

Guide to avoiding hydration mismatches and building SSR-compatible Nuxt applications.

## Table of Contents

- [Common Hydration Issues](#common-hydration-issues)
- [SSR-Safe Patterns](#ssr-safe-patterns)
- [Client-Only Rendering](#client-only-rendering)
- [State Management](#state-management)
- [Third-Party Libraries](#third-party-libraries)

## Common Hydration Issues

Hydration mismatches cause:
- Broken interactivity (event listeners fail)
- Content flashing (FOUC)
- State inconsistencies between server/client

## SSR-Safe Patterns

### Browser APIs

```typescript
// ❌ Fails on server
const theme = localStorage.getItem('theme')
const width = window.innerWidth

// ✅ SSR-safe with cookies
const theme = useCookie('theme', { default: () => 'light' })

// ✅ SSR-safe with useState
const width = useState('window-width', () => 0)
onMounted(() => {
  width.value = window.innerWidth
})
```

### Non-Deterministic Values

```typescript
// ❌ Different on server/client
<div>{{ Math.random() }}</div>
<div>{{ new Date().getTime() }}</div>

// ✅ Stable with useState
const randomValue = useState('random', () => Math.random())
const timestamp = useState('timestamp', () => Date.now())
```

### Conditional Rendering

```vue
<!-- ❌ Window not available on server -->
<div v-if="window.innerWidth > 768">Desktop</div>

<!-- ✅ Use CSS media queries -->
<div class="hidden md:block">Desktop</div>

<!-- ✅ Or client-only with ClientOnly -->
<ClientOnly>
  <div v-if="window.innerWidth > 768">Desktop</div>
  <template #fallback>
    <div>Loading...</div>
  </template>
</ClientOnly>
```

### Time-Based Content

```vue
<!-- ❌ Different time on server/client -->
<template>
  <div>{{ greeting }}</div>
</template>
<script setup>
const hour = new Date().getHours()
const greeting = hour < 12 ? 'Good morning' : 'Good afternoon'
</script>

<!-- ✅ Use NuxtTime component (Nuxt 4+) -->
<template>
  <div>
    <NuxtTime :date="new Date()" format="HH:mm" />
  </div>
</template>

<!-- ✅ Or handle client-side with ClientOnly -->
<template>
  <div>
    <ClientOnly>
      {{ greeting }}
      <template #fallback>
        Hello!
      </template>
    </ClientOnly>
  </div>
</template>
<script setup>
const greeting = ref('Hello!')

onMounted(() => {
  const hour = new Date().getHours()
  greeting.value = hour < 12 ? 'Good morning' : 'Good afternoon'
})
</script>
```

## Client-Only Rendering

### ClientOnly Component

```vue
<template>
  <!-- Render only on client -->
  <ClientOnly>
    <MapComponent />
    <template #fallback>
      <MapPlaceholder />
    </template>
  </ClientOnly>
</template>
```

### Lazy Components

```vue
<template>
  <!-- Auto-wrapped in ClientOnly when using Lazy prefix -->
  <LazyMapComponent />
</template>
```

### onMounted Hook

```typescript
// Only runs on client
onMounted(async () => {
  // Safe to use browser APIs
  const chart = await import('chart-library')
  chart.init(document.getElementById('chart'))
})
```

## State Management

### Using useState

```typescript
// ✅ Shared state that hydrates correctly
export const useTheme = () => {
  const theme = useState('theme', () => 'light')

  const toggle = () => {
    theme.value = theme.value === 'light' ? 'dark' : 'light'
  }

  // Sync to cookie on client
  if (process.client) {
    watch(theme, (newTheme) => {
      document.documentElement.classList.toggle('dark', newTheme === 'dark')
    })
  }

  return { theme, toggle }
}
```

### Initial State from Server

```typescript
// server/api/config.get.ts
export default defineEventHandler(() => {
  return {
    theme: 'light',
    locale: 'en'
  }
})

// composables/useConfig.ts
export const useConfig = () => {
  const config = useState('config', async () => {
    // Fetches on server, hydrates on client
    return await $fetch('/api/config')
  })

  return { config }
}
```

## Third-Party Libraries

### Browser-Only Libraries

```typescript
// ❌ Imports run on server
import BrowserLib from 'browser-only-lib'

BrowserLib.init() // Fails on server

// ✅ Dynamic import in onMounted
onMounted(async () => {
  const { default: BrowserLib } = await import('browser-only-lib')
  BrowserLib.init()
})
```

### Plugin Pattern

```typescript
// plugins/browser-lib.client.ts
export default defineNuxtPlugin(async () => {
  const { default: BrowserLib } = await import('browser-only-lib')

  return {
    provide: {
      browserLib: BrowserLib
    }
  }
})

// Usage in component
const { $browserLib } = useNuxtApp()

onMounted(() => {
  $browserLib.init()
})
```

### SSR-Compatible Initialization

```typescript
// plugins/analytics.ts
export default defineNuxtPlugin(() => {
  const analytics = {
    track: (event: string) => {
      if (process.client) {
        // Only track on client
        window.gtag?.('event', event)
      }
    }
  }

  return {
    provide: { analytics }
  }
})
```

## Process Guards

### process.client / process.server

```typescript
// ✅ Guard client-only code
if (process.client) {
  window.addEventListener('resize', handleResize)
}

// ✅ Guard server-only code
if (process.server) {
  console.log('Running on server')
}

// ✅ In composables
export const useViewport = () => {
  const width = ref(0)
  const height = ref(0)

  if (process.client) {
    const update = () => {
      width.value = window.innerWidth
      height.value = window.innerHeight
    }

    onMounted(update)
    window.addEventListener('resize', update)
    onUnmounted(() => window.removeEventListener('resize', update))
  }

  return { width, height }
}
```

## Data Fetching Hydration

### useFetch Hydration

```typescript
// ✅ Automatically handles hydration
const { data } = await useFetch('/api/users')
// Server: fetches data
// Client: uses server-fetched data (no duplicate request)

// ✅ With transform (runs on both server and client)
const { data } = await useFetch('/api/users', {
  transform: (users) => {
    // Must be deterministic!
    return users.map(u => ({
      id: u.id,
      name: u.name
    }))
  }
})

// ❌ Non-deterministic transform
const { data } = await useFetch('/api/users', {
  transform: (users) => {
    return users.map(u => ({
      ...u,
      random: Math.random() // Different on server/client!
    }))
  }
})
```

### useAsyncData Hydration

```typescript
// ✅ With unique key for hydration
const { data } = await useAsyncData('users', () => $fetch('/api/users'))
// Server: fetches and serializes with key 'users'
// Client: uses payload data with key 'users'

// ❌ Without key (no hydration)
const { data } = await useAsyncData(() => $fetch('/api/users'))
// Server: fetches
// Client: fetches again (duplicate request)
```

## Debugging Hydration Issues

### Development Mode Warnings

Nuxt shows warnings in development:
```bash
[Vue warn]: Hydration node mismatch
```

### Common Causes

1. **Different HTML structure** between server and client
2. **Browser APIs** used during SSR
3. **Non-deterministic content** (random, Date.now)
4. **Third-party scripts** modifying DOM before hydration
5. **Browser extensions** injecting content

### Debugging Steps

```typescript
// 1. Add unique keys to help identify components
<div key="problematic-section">
  <ProblematicComponent />
</div>

// 2. Isolate with ClientOnly
<ClientOnly>
  <ProblematicComponent />
</ClientOnly>

// 3. Check transform functions are deterministic
const { data } = await useFetch('/api/data', {
  transform: (data) => {
    console.log('Transform input:', data)
    const result = processData(data)
    console.log('Transform output:', result)
    return result
  }
})

// 4. Verify useState keys are unique
const state1 = useState('unique-key-1', () => defaultValue)
const state2 = useState('unique-key-2', () => defaultValue)
```

## Best Practices Summary

1. **Use `useState` for shared state** that needs to hydrate
2. **Guard browser APIs** with `process.client` or `onMounted`
3. **Make transforms deterministic** - no random, Date.now, etc.
4. **Use `ClientOnly` for browser-only components**
5. **Provide unique keys** to `useAsyncData` for proper hydration
6. **Dynamic import browser libraries** in `onMounted`
7. **Use `.client` suffix** for client-only plugins
8. **Test with SSR disabled** to verify client-only code paths
9. **Check hydration warnings** in development mode
10. **Use `useCookie`** instead of localStorage for SSR-compatible storage
