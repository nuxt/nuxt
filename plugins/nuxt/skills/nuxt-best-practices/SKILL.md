---
name: Building Nuxt 4 Applications
description: Builds modern Nuxt 4 applications with composables, server routes, and SSR optimization. Provides best practices for useState, useFetch, useAsyncData, data fetching strategies, hydration patterns, server API design, and the new app/ directory structure. Use when creating Vue components, writing composables, implementing server routes, configuring Nuxt projects, debugging hydration issues, or when user mentions Nuxt, Nuxt 4, SSR, Nitro, nuxt.config, useState, useFetch, useAsyncData, server/api, app directory, or hydration.
allowed-tools: Read, Write, Edit, Grep, Glob
---

# Building Nuxt 4 Applications

Comprehensive guide for Nuxt 4 development following official best practices and modern patterns.

## Quick Reference

### Nuxt 4 Directory Structure
```
.output/          # Build output
.nuxt/            # Generated Nuxt files
app/              # Your application code (new default srcDir)
├── assets/       # Style files, fonts, etc.
├── components/   # Auto-imported Vue components
├── composables/  # Auto-imported composables (useState, useFetch, etc.)
├── layouts/      # Layout components
├── middleware/   # Route middleware
├── pages/        # File-based routing
├── plugins/      # Nuxt plugins
├── utils/        # Auto-imported utility functions
├── app.vue       # Main app component
├── app.config.ts # App-level configuration
└── error.vue     # Error page
content/          # Nuxt Content files (if using @nuxt/content)
layers/           # Nuxt layers
modules/          # Local modules
node_modules/     # Dependencies
public/           # Static assets (served from root)
server/           # Server-side code (Nitro)
├── api/          # API endpoints (/api/*)
├── middleware/   # Server middleware
├── plugins/      # Nitro plugins
├── routes/       # Server routes
└── utils/        # Server utilities
shared/           # Shared between app and server contexts
nuxt.config.ts    # Nuxt configuration
package.json      # Project metadata
tsconfig.json     # TypeScript configuration
```

::note
The `~` alias now points to the `app/` directory by default. Use `~/components` to reference `app/components/`, `~/pages` for `app/pages/`, etc.
::

### Key Changes from Nuxt 3
- **New srcDir**: Default `srcDir` is now `app/` instead of root directory
- **Separated contexts**: `server/`, `modules/`, `public/`, `layers/`, and `content/` are now outside `app/` for better separation
- **Shared directory**: New `shared/` directory for code used in both app and server contexts
- **Better IDE support**: Clearer separation prevents context mixing and improves type safety

### Auto-imports
Nuxt auto-imports:
- Vue composables (`ref`, `computed`, `watch`)
- Nuxt composables (`useState`, `useFetch`, `useRoute`)
- Components from `components/`
- Composables from `composables/`
- Utils from `utils/`

## Composables Best Practices

### Naming Convention
```typescript
// ✅ Good - use prefix
export const useAuth = () => { ... }
export const useCounter = () => { ... }
export const useFirebase = () => { ... }

// ❌ Bad - missing prefix
export const auth = () => { ... }
export const counter = () => { ... }
```

### State Management with useState
```typescript
// ✅ Good - Shared state across components
export const useCounter = () => {
  const count = useState('counter', () => 0)
  const increment = () => count.value++
  const decrement = () => count.value--

  return { count, increment, decrement }
}

// ❌ Bad - Not shared, creates new instance
export const useCounter = () => {
  const count = ref(0)  // Creates new ref each time
  return { count }
}
```

### Composable Organization
```typescript
// composables/useAuth.ts
export const useAuth = () => {
  const user = useState('auth-user', () => null)
  const isAuthenticated = computed(() => !!user.value)

  const login = async (credentials) => {
    const response = await $fetch('/api/auth/login', {
      method: 'POST',
      body: credentials
    })
    user.value = response.user
  }

  const logout = async () => {
    await $fetch('/api/auth/logout', { method: 'POST' })
    user.value = null
  }

  return {
    user: readonly(user),
    isAuthenticated,
    login,
    logout
  }
}
```

## Data Fetching

### Nuxt 4 Data Fetching Changes
Nuxt 4 introduces important improvements to data fetching:
- **Shallow reactivity**: `data` is now a `shallowRef` by default for better performance
- **Singleton pattern**: Same key shares `data`, `error`, and `status` refs across components
- **Default values**: `data` and `error` default to `undefined` (not `null`)
- **Reactive keys**: Support for computed/ref keys with automatic refetching

### useFetch - Simple API Calls
```typescript
// ✅ Good - Auto-generated key
const { data, error, pending, status } = await useFetch('/api/users')

// ✅ Good - With reactive params
const page = ref(1)
const { data } = await useFetch('/api/users', {
  query: { page }  // Automatically refetches when page changes
})

// ✅ Good - With transform (must be deterministic!)
const { data } = await useFetch('/api/users', {
  transform: (users) => users.map(u => ({
    id: u.id,
    name: u.name
  }))
})

// ✅ Good - Deep reactivity when needed
const { data } = await useFetch('/api/users', {
  deep: true  // Use when you need to mutate nested properties
})

// ✅ Good - Reactive key support
const userId = ref('123')
const { data } = await useFetch(() => `/api/users/${userId.value}`)
// Automatically refetches when userId changes
```

### useAsyncData - Custom Logic
```typescript
// ✅ Good - Custom fetcher with key
const { data } = await useAsyncData('users', async () => {
  const response = await $fetch('/api/users')
  return response.data.map(transformUser)
})

// ✅ Good - Multiple data sources
const { data } = await useAsyncData('dashboard', async () => {
  const [users, posts, stats] = await Promise.all([
    $fetch('/api/users'),
    $fetch('/api/posts'),
    $fetch('/api/stats')
  ])
  return { users, posts, stats }
})
```

### Client-side Only Fetching
```typescript
// ✅ Good - Disable SSR for client-only data
const { data } = await useFetch('/api/user/preferences', {
  server: false  // Only fetch on client
})

// ✅ Good - Lazy loading
const { data } = await useLazyFetch('/api/heavy-data', {
  server: false
})
```

## Server Routes

### API Routes Structure
```typescript
// server/api/users/index.get.ts
export default defineEventHandler(async (event) => {
  const users = await db.users.findMany()
  return users
})

// server/api/users/[id].get.ts
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const user = await db.users.findUnique({ where: { id } })

  if (!user) {
    throw createError({
      statusCode: 404,
      message: 'User not found'
    })
  }

  return user
})

// server/api/users/index.post.ts
export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  // Validate body
  if (!body.email || !body.name) {
    throw createError({
      statusCode: 400,
      message: 'Email and name are required'
    })
  }

  const user = await db.users.create({ data: body })
  return user
})
```

### Error Handling
```typescript
// ✅ Good - Proper error handling
export default defineEventHandler(async (event) => {
  try {
    const user = await fetchUser(event)
    return user
  } catch (error) {
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch user',
      data: error
    })
  }
})
```

## Component Patterns

### Component Organization
```vue
<!-- components/Button.vue -->
<script setup lang="ts">
interface Props {
  variant?: 'primary' | 'secondary'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  disabled: false
})

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()
</script>

<template>
  <button
    :class="[variant, size]"
    :disabled="disabled"
    @click="emit('click', $event)"
  >
    <slot />
  </button>
</template>
```

### Auto-imported Components
```vue
<!-- pages/index.vue -->
<template>
  <div>
    <!-- Auto-imported from components/ -->
    <Button @click="handleClick">Click me</Button>
    <UserCard :user="user" />

    <!-- Lazy load heavy components -->
    <LazyHeavyChart v-if="showChart" />
  </div>
</template>
```

## Middleware

### Route Middleware
```typescript
// middleware/auth.ts
export default defineNuxtRouteMiddleware((to, from) => {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated.value) {
    return navigateTo('/login')
  }
})

// Usage in page
// pages/dashboard.vue
<script setup>
definePageMeta({
  middleware: 'auth'
})
</script>
```

### Global Middleware
```typescript
// middleware/analytics.global.ts
export default defineNuxtRouteMiddleware((to, from) => {
  // Runs on every route change
  console.log('Navigating to:', to.path)
})
```

## SEO & Meta Tags

```typescript
// composables/useSEO.ts
export const useSEO = (options: {
  title: string
  description: string
  image?: string
}) => {
  useHead({
    title: options.title,
    meta: [
      {
        name: 'description',
        content: options.description
      },
      {
        property: 'og:title',
        content: options.title
      },
      {
        property: 'og:description',
        content: options.description
      },
      {
        property: 'og:image',
        content: options.image || '/og-default.png'
      }
    ]
  })
}

// Usage in page
<script setup>
useSEO({
  title: 'Dashboard',
  description: 'User dashboard page',
  image: '/dashboard-og.png'
})
</script>
```

## Performance Optimization

### Lazy Loading
```vue
<template>
  <!-- Lazy load components -->
  <LazyHeavyChart v-if="showChart" />

  <!-- Client-only rendering -->
  <ClientOnly>
    <HeavyComponent />
    <template #fallback>
      <LoadingSpinner />
    </template>
  </ClientOnly>

  <!-- Lazy hydration -->
  <LazyMyComponent lazy-hydrate />
</template>
```

### Image Optimization
```vue
<template>
  <!-- ✅ Use NuxtImg for automatic optimization -->
  <NuxtImg
    src="/hero.jpg"
    width="800"
    height="600"
    format="webp"
    quality="80"
    loading="lazy"
  />

  <!-- ✅ Use NuxtPicture for art direction -->
  <NuxtPicture
    src="/hero.jpg"
    :img-attrs="{
      class: 'hero-image',
      alt: 'Hero image'
    }"
  />
</template>
```

## Environment Variables

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  runtimeConfig: {
    // Private keys (server-only)
    apiSecret: process.env.API_SECRET,

    // Public keys (client + server)
    public: {
      apiBase: process.env.API_BASE || 'http://localhost:3000'
    }
  }
})

// Usage
const config = useRuntimeConfig()
console.log(config.apiSecret)      // Server-only
console.log(config.public.apiBase) // Available everywhere
```

## Testing

```typescript
// composables/__tests__/useCounter.test.ts
import { describe, it, expect } from 'vitest'
import { useCounter } from '../useCounter'

describe('useCounter', () => {
  it('increments counter', () => {
    const { count, increment } = useCounter()
    expect(count.value).toBe(0)

    increment()
    expect(count.value).toBe(1)
  })
})
```

## Common Anti-patterns

### ❌ Avoid
```typescript
// Using ref instead of useState for shared state
const user = ref(null)  // Not shared

// Not handling errors
await useFetch('/api/data')  // No error handling

// Inline API calls in components
await fetch('/api/users')  // Use $fetch or useFetch

// Accessing process.env directly
const apiKey = process.env.API_KEY  // Use runtimeConfig
```

### ✅ Use Instead
```typescript
// Shared state
const user = useState('user', () => null)

// Error handling
const { data, error } = await useFetch('/api/data')
if (error.value) handleError(error.value)

// Proper data fetching
const { data } = await useFetch('/api/users')

// Runtime config
const config = useRuntimeConfig()
const apiKey = config.apiSecret
```

## Advanced Topics

For more detailed guides, see:
- [composables.md](./reference/composables.md) - Advanced composable patterns and state management
- [data-fetching.md](./reference/data-fetching.md) - Complete data fetching guide with useFetch and useAsyncData
- [server.md](./reference/server.md) - Server route patterns, API design, and middleware
- [hydration.md](./reference/hydration.md) - SSR hydration best practices and troubleshooting
- [performance.md](./reference/performance.md) - Performance optimization and caching strategies
- [plugins.md](./reference/plugins.md) - Plugin development patterns and best practices

## Resources

- [Official Nuxt Documentation](https://nuxt.com/docs)
- [Nuxt Examples](https://nuxt.com/docs/examples)
- [Nuxt Modules](https://nuxt.com/modules)