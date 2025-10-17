# Nuxt Plugin Development Best Practices

Guide to creating efficient and maintainable Nuxt plugins.

## Table of Contents

- [Plugin Basics](#plugin-basics)
- [Performance Considerations](#performance-considerations)
- [Client vs Server Plugins](#client-vs-server-plugins)
- [Async Plugins](#async-plugins)
- [Plugin Patterns](#plugin-patterns)
- [Type Safety](#type-safety)

## Plugin Basics

### Creating a Plugin

```typescript
// plugins/my-plugin.ts
export default defineNuxtPlugin(() => {
  // Plugin initialization logic

  return {
    provide: {
      myFunction: () => 'Hello from plugin'
    }
  }
})

// Usage in component
const { $myFunction } = useNuxtApp()
console.log($myFunction()) // "Hello from plugin"
```

### Plugin Execution Order

By default, plugins load synchronously in alphabetical order:

```bash
plugins/
├── 01.first.ts    # Loads first
├── 02.second.ts   # Loads second
└── 03.third.ts    # Loads third
```

## Performance Considerations

### Minimize Plugin Overhead

```typescript
// ❌ Bad - Heavy computation in plugin
export default defineNuxtPlugin(() => {
  // Blocks hydration!
  const heavyData = processLargeDataset()

  return {
    provide: { heavyData }
  }
})

// ✅ Good - Lazy initialization
export default defineNuxtPlugin(() => {
  let cachedData: Data | null = null

  const getData = async () => {
    if (!cachedData) {
      cachedData = await processLargeDataset()
    }
    return cachedData
  }

  return {
    provide: { getData }
  }
})
```

### Prefer Composables Over Plugins

```typescript
// ❌ Unnecessary plugin
// plugins/utils.ts
export default defineNuxtPlugin(() => {
  const formatDate = (date: Date) => {
    return date.toLocaleDateString()
  }

  return {
    provide: { formatDate }
  }
})

// ✅ Better - Use composable
// composables/useFormatters.ts
export const useFormatters = () => {
  const formatDate = (date: Date) => {
    return date.toLocaleDateString()
  }

  return { formatDate }
}
```

**When to use plugins:**
- Global Vue directives
- Global mixins
- Third-party library integration
- App-level initialization

**When to use composables:**
- Utility functions
- State management
- Reusable logic
- Data fetching helpers

## Client vs Server Plugins

### Client-Only Plugin

```typescript
// plugins/analytics.client.ts
export default defineNuxtPlugin(() => {
  // Only runs on client
  window.gtag('config', 'GA_MEASUREMENT_ID')

  return {
    provide: {
      trackEvent: (event: string) => {
        window.gtag('event', event)
      }
    }
  }
})
```

### Server-Only Plugin

```typescript
// plugins/database.server.ts
export default defineNuxtPlugin(() => {
  // Only runs on server
  const db = new DatabaseClient()

  return {
    provide: {
      db
    }
  }
})
```

### Universal Plugin with Guards

```typescript
// plugins/logger.ts
export default defineNuxtPlugin(() => {
  const log = (message: string) => {
    if (process.client) {
      console.log('[Client]', message)
    } else {
      console.log('[Server]', message)
    }
  }

  return {
    provide: { log }
  }
})
```

## Async Plugins

### Parallel Loading

```typescript
// plugins/firebase.client.ts
export default defineNuxtPlugin({
  name: 'firebase',
  parallel: true, // Don't block other plugins
  async setup() {
    const { initializeApp } = await import('firebase/app')
    const { getAuth } = await import('firebase/auth')

    const app = initializeApp({
      apiKey: 'xxx',
      authDomain: 'xxx'
    })

    const auth = getAuth(app)

    return {
      provide: {
        firebase: { app, auth }
      }
    }
  }
})
```

### Sequential Loading

```typescript
// plugins/01.config.ts
export default defineNuxtPlugin(async () => {
  // Must load before other plugins
  const config = await $fetch('/api/config')

  return {
    provide: { config }
  }
})

// plugins/02.feature.ts
export default defineNuxtPlugin(() => {
  const { $config } = useNuxtApp()

  // Uses config from previous plugin
  initFeature($config)
})
```

### Dependency Handling

```typescript
// plugins/api.client.ts
export default defineNuxtPlugin({
  name: 'api',
  dependsOn: ['auth'], // Wait for auth plugin
  setup() {
    const { $auth } = useNuxtApp()

    const api = {
      fetch: async (url: string) => {
        return await $fetch(url, {
          headers: {
            Authorization: `Bearer ${$auth.token}`
          }
        })
      }
    }

    return {
      provide: { api }
    }
  }
})
```

## Plugin Patterns

### Vue Plugin Integration

```typescript
// plugins/vue-plugin.ts
import VuePlugin from 'vue-plugin'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(VuePlugin, {
    // Plugin options
  })
})
```

### Global Directive

```typescript
// plugins/directives.ts
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive('focus', {
    mounted(el) {
      el.focus()
    }
  })
})

// Usage
<template>
  <input v-focus />
</template>
```

### Error Handler

```typescript
// plugins/error-handler.ts
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.config.errorHandler = (error, instance, info) => {
    console.error('Global error:', error)
    console.error('Component:', instance)
    console.error('Error info:', info)
  }
})
```

### Router Integration

```typescript
// plugins/router-guards.ts
export default defineNuxtPlugin(() => {
  const router = useRouter()

  router.beforeEach((to, from) => {
    console.log('Navigating to:', to.path)

    // Add analytics, auth checks, etc.
  })

  router.afterEach((to, from) => {
    console.log('Navigated from:', from.path, 'to:', to.path)
  })
})
```

### API Client Pattern

```typescript
// plugins/api.ts
export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()

  const api = $fetch.create({
    baseURL: config.public.apiBase,
    onRequest({ options }) {
      // Add auth headers
      const token = useCookie('auth-token')
      if (token.value) {
        options.headers = {
          ...options.headers,
          Authorization: `Bearer ${token.value}`
        }
      }
    },
    onResponseError({ response }) {
      // Handle errors globally
      if (response.status === 401) {
        navigateTo('/login')
      }
    }
  })

  return {
    provide: { api }
  }
})
```

## Type Safety

### TypeScript Plugin Definition

```typescript
// plugins/typed-plugin.ts
interface MyPlugin {
  greet: (name: string) => string
  farewell: (name: string) => string
}

export default defineNuxtPlugin(() => {
  const plugin: MyPlugin = {
    greet: (name) => `Hello, ${name}!`,
    farewell: (name) => `Goodbye, ${name}!`
  }

  return {
    provide: {
      myPlugin: plugin
    }
  }
})
```

### Type Augmentation

```typescript
// types/plugins.d.ts
declare module '#app' {
  interface NuxtApp {
    $myPlugin: {
      greet: (name: string) => string
      farewell: (name: string) => string
    }
  }
}

// Usage with full type safety
const { $myPlugin } = useNuxtApp()
$myPlugin.greet('World') // Type-safe!
```

### Generic Plugin

```typescript
// plugins/storage.ts
export default defineNuxtPlugin(() => {
  const storage = {
    get: <T>(key: string): T | null => {
      const value = localStorage.getItem(key)
      return value ? JSON.parse(value) : null
    },
    set: <T>(key: string, value: T): void => {
      localStorage.setItem(key, JSON.stringify(value))
    }
  }

  return {
    provide: { storage }
  }
})

// Usage
const user = $storage.get<User>('user') // Type: User | null
```

## Hooks Integration

### Using Nuxt Hooks

```typescript
// plugins/lifecycle.ts
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('app:created', () => {
    console.log('App created')
  })

  nuxtApp.hook('app:mounted', () => {
    console.log('App mounted')
  })

  nuxtApp.hook('page:start', () => {
    console.log('Page navigation started')
  })

  nuxtApp.hook('page:finish', () => {
    console.log('Page navigation finished')
  })
})
```

## Best Practices Summary

1. **Minimize plugin overhead** - plugins run during hydration
2. **Use composables when possible** - lighter than plugins
3. **Enable `parallel: true`** for async plugins
4. **Use `.client` suffix** for browser-only code
5. **Use `.server` suffix** for server-only code
6. **Lazy initialize** expensive operations
7. **Provide type definitions** for better DX
8. **Use plugin dependencies** for ordered loading
9. **Handle errors gracefully** in plugins
10. **Document plugin purpose** and usage

## Common Patterns

### Singleton Service

```typescript
// plugins/singleton.ts
let instance: Service | null = null

export default defineNuxtPlugin(() => {
  if (!instance) {
    instance = new Service()
  }

  return {
    provide: { service: instance }
  }
})
```

### Feature Flag Plugin

```typescript
// plugins/features.ts
export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()

  const features = {
    isEnabled: (feature: string) => {
      return config.public.features?.[feature] ?? false
    }
  }

  return {
    provide: { features }
  }
})

// Usage
<template>
  <div v-if="$features.isEnabled('newDashboard')">
    <NewDashboard />
  </div>
</template>
```

### Third-Party SDK Integration

```typescript
// plugins/stripe.client.ts
import { loadStripe } from '@stripe/stripe-js'

export default defineNuxtPlugin({
  name: 'stripe',
  parallel: true,
  async setup() {
    const config = useRuntimeConfig()
    const stripe = await loadStripe(config.public.stripeKey)

    return {
      provide: { stripe }
    }
  }
})
```
