# Nuxt Composables Best Practices

Advanced patterns and best practices for creating reusable Nuxt composables.

## Table of Contents

- [Naming Convention](#naming-convention)
- [State Management](#state-management)
- [Lifecycle Hooks](#lifecycle-hooks)
- [Error Handling](#error-handling)
- [TypeScript Support](#typescript-support)
- [Testing Composables](#testing-composables)

## Naming Convention

### Required Prefix

Always use the `use` prefix for composables to enable auto-import.

```typescript
// ✅ Good
export const useAuth = () => { ... }
export const useLocalStorage = () => { ... }
export const useFirebase = () => { ... }

// ❌ Bad
export const auth = () => { ... }
export const getAuth = () => { ... }
export const AuthService = () => { ... }
```

### Descriptive Names

Use clear, descriptive names that indicate the composable's purpose.

```typescript
// ✅ Good
export const useUserProfile = () => { ... }
export const useShoppingCart = () => { ... }
export const useProductFilters = () => { ... }

// ❌ Bad
export const useData = () => { ... }
export const useStuff = () => { ... }
export const useHelper = () => { ... }
```

## State Management

### useState for Shared State

Use `useState` to create truly shared state across components.

```typescript
// composables/useCounter.ts
export const useCounter = () => {
  // ✅ Shared state - same instance everywhere
  const count = useState('counter', () => 0)

  const increment = () => count.value++
  const decrement = () => count.value--
  const reset = () => count.value = 0

  return {
    count: readonly(count),  // Expose as readonly
    increment,
    decrement,
    reset
  }
}
```

### Key Naming Convention

Use consistent key naming for `useState`:

```typescript
// ✅ Good - Clear, namespaced keys
const user = useState('auth-user', () => null)
const token = useState('auth-token', () => '')
const cart = useState('shop-cart', () => [])

// ❌ Bad - Generic keys prone to conflicts
const data = useState('data', () => null)
const state = useState('state', () => null)
```

### Computed Properties

Derive state using computed properties for reactive data transformations.

```typescript
export const useCart = () => {
  const items = useState<CartItem[]>('cart-items', () => [])

  const totalItems = computed(() => items.value.length)

  const totalPrice = computed(() =>
    items.value.reduce((sum, item) => sum + item.price * item.quantity, 0)
  )

  const isEmpty = computed(() => items.value.length === 0)

  return {
    items: readonly(items),
    totalItems,
    totalPrice,
    isEmpty,
    addItem: (item: CartItem) => { ... },
    removeItem: (id: string) => { ... }
  }
}
```

## Lifecycle Hooks

### Component Lifecycle

Use Vue lifecycle hooks when needed, but be aware of SSR implications.

```typescript
export const useScrollPosition = () => {
  const scrollY = ref(0)

  onMounted(() => {
    const handleScroll = () => {
      scrollY.value = window.scrollY
    }

    window.addEventListener('scroll', handleScroll)

    onUnmounted(() => {
      window.removeEventListener('scroll', handleScroll)
    })
  })

  return { scrollY: readonly(scrollY) }
}
```

### SSR-Safe Composables

Handle both server and client contexts appropriately.

```typescript
export const useLocalStorage = <T>(key: string, initialValue: T) => {
  // ✅ SSR-safe - check for process.client
  const stored = process.client
    ? localStorage.getItem(key)
    : null

  const value = ref<T>(
    stored ? JSON.parse(stored) : initialValue
  )

  // Only run on client
  if (process.client) {
    watch(value, (newValue) => {
      localStorage.setItem(key, JSON.stringify(newValue))
    })
  }

  return value
}
```

## Error Handling

### Try-Catch Patterns

Always handle potential errors in composables.

```typescript
export const useApi = () => {
  const error = ref<Error | null>(null)
  const loading = ref(false)

  const fetchData = async (url: string) => {
    loading.value = true
    error.value = null

    try {
      const data = await $fetch(url)
      return data
    } catch (e) {
      error.value = e as Error
      console.error('API Error:', e)
      return null
    } finally {
      loading.value = false
    }
  }

  return {
    error: readonly(error),
    loading: readonly(loading),
    fetchData
  }
}
```

### Error State Management

Expose error state for components to handle.

```typescript
export const useAuth = () => {
  const user = useState('auth-user', () => null)
  const error = ref<string | null>(null)
  const loading = ref(false)

  const login = async (credentials: Credentials) => {
    loading.value = true
    error.value = null

    try {
      const response = await $fetch('/api/auth/login', {
        method: 'POST',
        body: credentials
      })
      user.value = response.user
      return true
    } catch (e: any) {
      error.value = e.data?.message || 'Login failed'
      return false
    } finally {
      loading.value = false
    }
  }

  return {
    user: readonly(user),
    error: readonly(error),
    loading: readonly(loading),
    login
  }
}
```

## TypeScript Support

### Type-Safe Composables

Always provide full TypeScript types.

```typescript
interface User {
  id: string
  email: string
  name: string
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
}

export const useAuth = () => {
  const user = useState<User | null>('auth-user', () => null)
  const token = useState<string | null>('auth-token', () => null)

  const isAuthenticated = computed(() => !!user.value && !!token.value)

  const login = async (
    credentials: { email: string; password: string }
  ): Promise<boolean> => {
    // Implementation
    return true
  }

  return {
    user: readonly(user) as Readonly<Ref<User | null>>,
    token: readonly(token) as Readonly<Ref<string | null>>,
    isAuthenticated,
    login
  }
}
```

### Generic Composables

Create reusable composables with generics.

```typescript
export const useAsyncState = <T>(
  fetcher: () => Promise<T>,
  initialValue: T
) => {
  const data = ref<T>(initialValue)
  const error = ref<Error | null>(null)
  const loading = ref(false)

  const execute = async () => {
    loading.value = true
    error.value = null

    try {
      data.value = await fetcher()
    } catch (e) {
      error.value = e as Error
    } finally {
      loading.value = false
    }
  }

  return {
    data: readonly(data) as Readonly<Ref<T>>,
    error: readonly(error),
    loading: readonly(loading),
    execute
  }
}

// Usage
const { data, loading, execute } = useAsyncState(
  () => $fetch<User[]>('/api/users'),
  []
)
```

## Testing Composables

### Unit Testing

Test composables in isolation using Vitest.

```typescript
// composables/__tests__/useCounter.test.ts
import { describe, it, expect } from 'vitest'
import { useCounter } from '../useCounter'

describe('useCounter', () => {
  it('initializes with 0', () => {
    const { count } = useCounter()
    expect(count.value).toBe(0)
  })

  it('increments counter', () => {
    const { count, increment } = useCounter()
    increment()
    expect(count.value).toBe(1)
  })

  it('decrements counter', () => {
    const { count, increment, decrement } = useCounter()
    increment()
    increment()
    decrement()
    expect(count.value).toBe(1)
  })

  it('resets counter', () => {
    const { count, increment, reset } = useCounter()
    increment()
    increment()
    reset()
    expect(count.value).toBe(0)
  })
})
```

### Testing Async Composables

```typescript
// composables/__tests__/useAuth.test.ts
import { describe, it, expect, vi } from 'vitest'
import { useAuth } from '../useAuth'

// Mock $fetch
vi.mock('#app', () => ({
  $fetch: vi.fn()
}))

describe('useAuth', () => {
  it('logs in successfully', async () => {
    const mockUser = { id: '1', email: 'test@example.com', name: 'Test' }

    // Mock successful login
    global.$fetch = vi.fn().mockResolvedValue({ user: mockUser })

    const { user, login } = useAuth()
    const result = await login({ email: 'test@example.com', password: 'pass' })

    expect(result).toBe(true)
    expect(user.value).toEqual(mockUser)
  })

  it('handles login error', async () => {
    // Mock failed login
    global.$fetch = vi.fn().mockRejectedValue({
      data: { message: 'Invalid credentials' }
    })

    const { error, login } = useAuth()
    const result = await login({ email: 'test@example.com', password: 'wrong' })

    expect(result).toBe(false)
    expect(error.value).toBe('Invalid credentials')
  })
})
```

## Best Practices Summary

1. **Always use `use` prefix** for auto-import
2. **Use `useState` for shared state** across components
3. **Use consistent key naming** for useState
4. **Expose readonly refs** to prevent external mutation
5. **Handle errors gracefully** with error state
6. **Provide full TypeScript types** for type safety
7. **Check `process.client`** for browser-only code
8. **Clean up side effects** in `onUnmounted`
9. **Write unit tests** for all composables
10. **Document complex composables** with JSDoc

## Advanced Patterns

### Composable Composition

Combine multiple composables for complex functionality.

```typescript
export const useUserDashboard = () => {
  const { user } = useAuth()
  const { data: profile } = useUserProfile(user.value?.id)
  const { items: notifications } = useNotifications(user.value?.id)
  const { theme, toggleTheme } = useTheme()

  const dashboardData = computed(() => ({
    user: user.value,
    profile: profile.value,
    notifications: notifications.value,
    theme: theme.value
  }))

  return {
    dashboardData,
    toggleTheme
  }
}
```

### Factory Pattern

Create composable factories for reusable patterns.

```typescript
export const createResourceComposable = <T>(endpoint: string) => {
  return () => {
    const items = ref<T[]>([])
    const loading = ref(false)
    const error = ref<Error | null>(null)

    const fetchAll = async () => {
      loading.value = true
      try {
        items.value = await $fetch<T[]>(endpoint)
      } catch (e) {
        error.value = e as Error
      } finally {
        loading.value = false
      }
    }

    const create = async (data: Partial<T>) => {
      const item = await $fetch<T>(endpoint, {
        method: 'POST',
        body: data
      })
      items.value.push(item)
      return item
    }

    return {
      items: readonly(items),
      loading: readonly(loading),
      error: readonly(error),
      fetchAll,
      create
    }
  }
}

// Usage
export const useUsers = createResourceComposable<User>('/api/users')
export const usePosts = createResourceComposable<Post>('/api/posts')
```
