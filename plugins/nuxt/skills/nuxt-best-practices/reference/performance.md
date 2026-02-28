# Nuxt Performance Optimization

Comprehensive guide to optimizing Nuxt application performance.

## Table of Contents

- [Built-in Optimizations](#built-in-optimizations)
- [Component Optimization](#component-optimization)
- [Image Optimization](#image-optimization)
- [Font Optimization](#font-optimization)
- [Code Splitting](#code-splitting)
- [Caching Strategies](#caching-strategies)
- [Third-Party Scripts](#third-party-scripts)
- [Profiling Tools](#profiling-tools)

## Built-in Optimizations

### Smart Prefetching with NuxtLink

```vue
<template>
  <!-- ✅ Auto-prefetch when visible (default) -->
  <NuxtLink to="/about">About</NuxtLink>

  <!-- ✅ Prefetch on hover/focus -->
  <NuxtLink to="/contact" prefetch-on="interaction">Contact</NuxtLink>

  <!-- ✅ Disable prefetch -->
  <NuxtLink to="/heavy-page" :prefetch="false">Heavy Page</NuxtLink>
</template>
```

### Data Fetching Optimization

```typescript
// ✅ Prevents duplicate requests
const { data } = await useFetch('/api/users')
// Server: fetches data
// Client: reuses server data (no second request)

// ✅ Parallel data fetching
const [users, posts] = await Promise.all([
  useFetch('/api/users'),
  useFetch('/api/posts')
])
```

## Component Optimization

### Lazy Loading Components

```vue
<template>
  <!-- ✅ Lazy load with Lazy prefix -->
  <LazyHeavyChart v-if="showChart" />
  <LazyVideoPlayer :src="videoUrl" />

  <!-- ✅ Explicit lazy import -->
  <component :is="HeavyComponent" v-if="loaded" />
</template>

<script setup>
const HeavyComponent = defineAsyncComponent(() =>
  import('~/components/HeavyComponent.vue')
)
</script>
```

### Lazy Hydration

```vue
<template>
  <!-- ✅ Hydrate when visible -->
  <LazyChart lazy-hydrate="visible" />

  <!-- ✅ Hydrate when idle -->
  <LazyWidget lazy-hydrate="idle" />

  <!-- ✅ Hydrate on interaction -->
  <LazyModal lazy-hydrate="interaction" />
</template>
```

### Client-Only Components

```vue
<template>
  <!-- ✅ Skip SSR, render on client only -->
  <ClientOnly>
    <MapComponent />
    <template #fallback>
      <MapSkeleton />
    </template>
  </ClientOnly>
</template>
```

## Image Optimization

### Using NuxtImg

```vue
<template>
  <!-- ✅ Auto-optimization -->
  <NuxtImg
    src="/hero.jpg"
    width="800"
    height="600"
    format="webp"
    quality="80"
    loading="lazy"
  />

  <!-- ✅ Critical images - eager load -->
  <NuxtImg
    src="/logo.png"
    width="200"
    height="100"
    loading="eager"
    preload
    fetchpriority="high"
  />

  <!-- ✅ Below-fold images - lazy load -->
  <NuxtImg
    src="/gallery-1.jpg"
    width="400"
    height="300"
    loading="lazy"
    fetchpriority="low"
  />
</template>
```

### Using NuxtPicture

```vue
<template>
  <!-- ✅ Responsive images with art direction -->
  <NuxtPicture
    src="/hero.jpg"
    :img-attrs="{
      class: 'hero-image',
      alt: 'Hero banner'
    }"
    sizes="sm:100vw md:50vw lg:400px"
  />
</template>
```

### Image Module Configuration

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@nuxt/image'],
  image: {
    quality: 80,
    format: ['webp', 'avif'],
    screens: {
      xs: 320,
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1280,
      xxl: 1536
    }
  }
})
```

## Font Optimization

### Using Nuxt Fonts

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@nuxt/fonts'],
  fonts: {
    families: [
      { name: 'Inter', provider: 'google' },
      { name: 'Roboto Mono', provider: 'google' }
    ]
  }
})
```

Benefits:
- Auto self-hosting (no external requests)
- Fallback metrics to prevent layout shift
- Preload optimization

### Manual Font Loading

```vue
<!-- app.vue or layouts/default.vue -->
<script setup>
useHead({
  link: [
    {
      rel: 'preload',
      as: 'font',
      type: 'font/woff2',
      href: '/fonts/inter.woff2',
      crossorigin: 'anonymous'
    }
  ]
})
</script>
```

## Code Splitting

### Route-Based Splitting

```typescript
// Automatic per-route splitting
pages/
├── index.vue       # → _nuxt/index-[hash].js
├── about.vue       # → _nuxt/about-[hash].js
└── contact.vue     # → _nuxt/contact-[hash].js
```

### Component-Based Splitting

```typescript
// ✅ Dynamic imports for large components
const HeavyComponent = defineAsyncComponent(() =>
  import('~/components/HeavyComponent.vue')
)

// ✅ With loading state
const HeavyComponent = defineAsyncComponent({
  loader: () => import('~/components/HeavyComponent.vue'),
  loadingComponent: LoadingSpinner,
  delay: 200,
  timeout: 3000
})
```

### Vendor Splitting

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  vite: {
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-charts': ['chart.js', 'd3'],
            'vendor-utils': ['lodash-es', 'date-fns']
          }
        }
      }
    }
  }
})
```

## Caching Strategies

### Route Rules

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  routeRules: {
    // Static generation at build time
    '/': { prerender: true },
    '/about': { prerender: true },

    // Incremental Static Regeneration
    '/blog/**': { isr: 3600 }, // Revalidate every hour

    // Stale-While-Revalidate
    '/api/posts': { swr: 3600 },

    // Client-side rendering only
    '/dashboard/**': { ssr: false },

    // Custom cache headers
    '/static/**': {
      headers: {
        'cache-control': 'public, max-age=31536000, immutable'
      }
    }
  }
})
```

### API Response Caching

```typescript
// server/api/posts.get.ts
export default defineCachedEventHandler(
  async (event) => {
    const posts = await fetchPosts()
    return posts
  },
  {
    maxAge: 60 * 60, // Cache for 1 hour
    getKey: (event) => 'posts-list'
  }
)

// With query parameters
export default defineCachedEventHandler(
  async (event) => {
    const query = getQuery(event)
    const posts = await fetchPosts(query)
    return posts
  },
  {
    maxAge: 60 * 60,
    getKey: (event) => {
      const query = getQuery(event)
      return `posts-${query.page}-${query.limit}`
    }
  }
)
```

### Client-Side Caching

```typescript
// ✅ Cache with useFetch
const { data } = await useFetch('/api/posts', {
  key: 'posts',
  getCachedData(key) {
    const cached = useNuxtData(key)
    // Cache for 5 minutes
    if (cached.data.value && Date.now() - cached.fetchedAt < 5 * 60 * 1000) {
      return cached.data.value
    }
  }
})
```

## Third-Party Scripts

### Using Nuxt Scripts

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@nuxt/scripts'],
  scripts: {
    registry: {
      googleAnalytics: {
        id: 'G-XXXXXXXXXX'
      }
    }
  }
})

// Usage in component
<script setup>
useScript('googleAnalytics')
</script>
```

### Manual Script Loading

```typescript
// ✅ Defer non-critical scripts
useHead({
  script: [
    {
      src: 'https://example.com/widget.js',
      defer: true
    }
  ]
})

// ✅ Load on interaction
const { load } = useScript('https://example.com/widget.js', {
  trigger: 'manual'
})

const loadWidget = async () => {
  await load()
  initializeWidget()
}
```

## Bundle Size Optimization

### Analyze Bundle

```bash
# Build and analyze
npx nuxi analyze

# Opens visualization in browser
# Shows:
# - Bundle sizes per route
# - Shared chunks
# - Module composition
```

### Tree Shaking

```typescript
// ✅ Import only what you need
import { debounce } from 'lodash-es'

// ❌ Imports entire library
import _ from 'lodash'
```

### Remove Unused Code

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  // Remove console logs in production
  vite: {
    esbuild: {
      drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : []
    }
  }
})
```

## Profiling Tools

### Nuxt DevTools

```bash
# Enable DevTools
npx nuxi dev --devtools
```

Features:
- Component tree visualization
- Route rendering metrics
- Asset size analysis
- Network requests
- Payload inspection

### Chrome DevTools

```javascript
// Measure rendering performance
performance.mark('start')
// ... rendering code
performance.mark('end')
performance.measure('render-time', 'start', 'end')
```

### Lighthouse

```bash
# Run Lighthouse
npm install -g lighthouse
lighthouse http://localhost:3000 --view
```

Focus metrics:
- **LCP** (Largest Contentful Paint) - < 2.5s
- **FID** (First Input Delay) - < 100ms
- **CLS** (Cumulative Layout Shift) - < 0.1
- **TTI** (Time to Interactive) - < 3.8s

## Performance Checklist

### Images

- [ ] Use NuxtImg/NuxtPicture for all images
- [ ] Set width/height to prevent layout shift
- [ ] Use `loading="lazy"` for below-fold images
- [ ] Use `loading="eager"` and `preload` for critical images
- [ ] Convert to WebP/Avif format

### Fonts

- [ ] Use @nuxt/fonts module for auto-optimization
- [ ] Limit font variants (weights, styles)
- [ ] Preload critical fonts
- [ ] Use system fonts as fallbacks

### Code Splitting

- [ ] Lazy load heavy components with `Lazy` prefix
- [ ] Use lazy hydration for non-critical components
- [ ] Dynamic import large libraries
- [ ] Split vendor bundles

### Caching

- [ ] Set appropriate route rules (prerender, ISR, SWR)
- [ ] Cache API responses with `defineCachedEventHandler`
- [ ] Configure CDN cache headers
- [ ] Use client-side caching for repeated requests

### Third-Party Scripts

- [ ] Defer non-critical scripts
- [ ] Use @nuxt/scripts module
- [ ] Load scripts on interaction when possible
- [ ] Audit script necessity

### Monitoring

- [ ] Run Lighthouse regularly
- [ ] Monitor Core Web Vitals
- [ ] Use Nuxt DevTools for profiling
- [ ] Track bundle size in CI/CD

## Best Practices Summary

1. **Use NuxtLink with smart prefetching** for navigation
2. **Lazy load components** that aren't immediately visible
3. **Optimize images** with NuxtImg and proper loading strategies
4. **Self-host fonts** with @nuxt/fonts module
5. **Implement route rules** for appropriate caching strategies
6. **Defer third-party scripts** to avoid blocking rendering
7. **Split code** at route and component boundaries
8. **Cache API responses** on server and client
9. **Monitor performance** with DevTools and Lighthouse
10. **Analyze bundles** regularly to identify optimization opportunities
