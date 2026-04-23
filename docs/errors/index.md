---
title: 'Error Codes'
description: 'Reference for all Nuxt error codes (runtime and build-time).'
navigation: false
surround: false
---

# Error Codes

Nuxt uses structured error codes to help you quickly identify and resolve issues. Every error and warning includes a unique code prefixed with `NUXT_` (e.g., `NUXT_E1001`, `NUXT_B3004`).

When you see an error in your console or terminal, click the docs link next to it for a detailed explanation, common causes, and resolution steps.

::read-more{to="/docs/getting-started/error-handling"}
Learn more about error handling in Nuxt.
::

## Runtime Errors (E codes)

Runtime errors occur in the browser or during SSR. They are prefixed with `E` followed by a 4-digit number.

### E1xxx: Core / Instance

| Code | Description |
|------|-------------|
| [E1001](/docs/errors/e1001) | Composable called outside Nuxt context |
| [E1003](/docs/errors/e1003) | Runtime config key not available on client |
| [E1004](/docs/errors/e1004) | `setInterval` used on server |
| [E1005](/docs/errors/e1005) | Error during app initialization |
| [E1006](/docs/errors/e1006) | `onPrehydrate` not processed by build pipeline |
| [E1007](/docs/errors/e1007) | Compiler-hint helper called at runtime |
| [E1008](/docs/errors/e1008) | Async `vue:setup` callback |
| [E1009](/docs/errors/e1009) | Error in `vue:error` hook |
| [E1010](/docs/errors/e1010) | Not rendering error page for bot |
| [E1011](/docs/errors/e1011) | Error while mounting app |

### E2xxx: Navigation / Routing

| Code | Description |
|------|-------------|
| [E2001](/docs/errors/e2001) | External navigation without `external: true` |
| [E2002](/docs/errors/e2002) | Navigation with dangerous protocol |
| [E2003](/docs/errors/e2003) | `abortNavigation()` called outside middleware |
| [E2004](/docs/errors/e2004) | Unknown route middleware |
| [E2005](/docs/errors/e2005) | `useRoute` called within middleware |
| [E2006](/docs/errors/e2006) | No middleware passed to `addRouteMiddleware` |
| [E2007](/docs/errors/e2007) | `setPageLayout` called on server within component |
| [E2008](/docs/errors/e2008) | `setPageLayout` called during hydration |
| [E2009](/docs/errors/e2009) | No error handler for middleware errors |
| [E2010](/docs/errors/e2010) | Failed to prefetch link |
| [E2011](/docs/errors/e2011) | Failed to preload route component |

### E3xxx: Data Fetching

| Code | Description |
|------|-------------|
| [E3001](/docs/errors/e3001) | `useFetch` URL starts with `//` |
| [E3002](/docs/errors/e3002) | `useFetch` failed to hash body |
| [E3003](/docs/errors/e3003) | Component already mounted — use `$fetch` |
| [E3004](/docs/errors/e3004) | Incompatible `useAsyncData` options |
| [E3005](/docs/errors/e3005) | Do not pass `execute` directly to `watch` |
| [E3006](/docs/errors/e3006) | `useAsyncData` handler returned `undefined` |
| [E3007](/docs/errors/e3007) | `asyncData` should return an object |

### E4xxx: Components / Layouts

| Code | Description |
|------|-------------|
| [E4001](/docs/errors/e4001) | Invalid layout selected |
| [E4002](/docs/errors/e4002) | Layout has multiple root nodes |
| [E4003](/docs/errors/e4003) | `<NuxtLayout>` needs single root node in slot |
| [E4004](/docs/errors/e4004) | Page has multiple root nodes |
| [E4005](/docs/errors/e4005) | Server component must have single root element |
| [E4006](/docs/errors/e4006) | SSR fallback in `<NuxtClientFallback>` |
| [E4007](/docs/errors/e4007) | Layouts exist but `<NuxtLayout>` not used |
| [E4008](/docs/errors/e4008) | Path outside project root in test wrapper |
| [E4009](/docs/errors/e4009) | Nested `<a>` tags inside `<NuxtLink>` |
| [E4010](/docs/errors/e4010) | `<NuxtLink>` conflicting props |
| [E4011](/docs/errors/e4011) | Pages exist but `<NuxtPage>` not used |
| [E4012](/docs/errors/e4012) | Island component error |
| [E4013](/docs/errors/e4013) | `v-for` range expects integer |
| [E4014](/docs/errors/e4014) | No pages directory found |

### E5xxx: Configuration / Manifest

| Code | Description |
|------|-------------|
| [E5001](/docs/errors/e5001) | App manifest not enabled |
| [E5002](/docs/errors/e5002) | Error fetching app manifest |
| [E5003](/docs/errors/e5003) | Error matching route rules |
| [E5004](/docs/errors/e5004) | Setting response headers not supported in browser |

### E6xxx: Head / SEO

| Code | Description |
|------|-------------|
| [E6001](/docs/errors/e6001) | Missing Unhead instance |
| [E6002](/docs/errors/e6002) | `<Title>` slot must be a single string |
| [E6003](/docs/errors/e6003) | `<Style>` slot must be a string |

### E7xxx: Payload / Serialization

| Code | Description |
|------|-------------|
| [E7001](/docs/errors/e7001) | Payload URL must not include hostname |
| [E7002](/docs/errors/e7002) | Cannot load payload |
| [E7003](/docs/errors/e7003) | Error preloading payload |
| [E7004](/docs/errors/e7004) | `definePayloadReviver` called in wrong context |
| [E7005](/docs/errors/e7005) | Cookie already expired |
| [E7006](/docs/errors/e7006) | Cookie being overridden |
| [E7007](/docs/errors/e7007) | `useState` init must be a function |
| [E7008](/docs/errors/e7008) | `callOnce` fn must be a function |
| [E7009](/docs/errors/e7009) | `useState` key must be a string |
| [E7010](/docs/errors/e7010) | `callOnce` key must be a string |
| [E7011](/docs/errors/e7011) | `useAsyncData` key must be a string |
| [E7012](/docs/errors/e7012) | `useAsyncData` handler must be a function |

## Build-Time Errors (B codes)

Build-time errors occur during the Nuxt build process. They are prefixed with `B` followed by a 4-digit number.

### B1xxx: Build / Compilation

| Code | Description |
|------|-------------|
| [B1001](/docs/errors/b1001) | Could not compile template |
| [B1002](/docs/errors/b1002) | Error reading template |
| [B1003](/docs/errors/b1003) | Invalid template |
| [B1004](/docs/errors/b1004) | Failed to install package |
| [B1005](/docs/errors/b1005) | Compiler plugin failed to scan file |
| [B1006](/docs/errors/b1006) | Compiler plugin failed to read file |
| [B1007](/docs/errors/b1007) | Compiler afterScan hook error |
| [B1008](/docs/errors/b1008) | No factory function found (internal bug) |
| [B1009](/docs/errors/b1009) | Duplicate keyed function name |
| [B1010](/docs/errors/b1010) | Failed to read file (changed during read) |
| [B1011](/docs/errors/b1011) | Failed to read file (I/O error) |
| [B1012](/docs/errors/b1012) | Skipping unsafe cache path |
| [B1013](/docs/errors/b1013) | Failed to restore cached file |
| [B1014](/docs/errors/b1014) | Problem checking external config files |
| [B1015](/docs/errors/b1015) | Falling back to chokidar-granular |
| [B1016](/docs/errors/b1016) | Could not load @nuxt/webpack-builder |
| [B1017](/docs/errors/b1017) | Loading builder failed |
| [B1018](/docs/errors/b1018) | Loading server builder failed |
| [B1019](/docs/errors/b1019) | Unknown component mode (internal bug) |

### B2xxx: Plugins

| Code | Description |
|------|-------------|
| [B2001](/docs/errors/b2001) | Invalid plugin metadata: not an object literal |
| [B2002](/docs/errors/b2002) | Invalid plugin metadata: spread or computed keys |
| [B2003](/docs/errors/b2003) | Invalid plugin metadata: `dependsOn` not string array |
| [B2004](/docs/errors/b2004) | Plugin has no content |
| [B2005](/docs/errors/b2005) | Plugin has no default export |
| [B2006](/docs/errors/b2006) | Error parsing plugin |
| [B2007](/docs/errors/b2007) | Plugin not wrapped in `defineNuxtPlugin` |
| [B2008](/docs/errors/b2008) | Plugin depends on unregistered plugins |
| [B2009](/docs/errors/b2009) | Circular dependency in plugins |
| [B2010](/docs/errors/b2010) | Failed to parse plugin static properties |
| [B2011](/docs/errors/b2011) | Invalid plugin: `src` option required |

### B3xxx: Components

| Code | Description |
|------|-------------|
| [B3001](/docs/errors/b3001) | Components directory not found |
| [B3002](/docs/errors/b3002) | Server components with `ssr: false` |
| [B3003](/docs/errors/b3003) | Standalone server components require `componentIslands` |
| [B3004](/docs/errors/b3004) | Component requires module installation |
| [B3005](/docs/errors/b3005) | Multiple hydration strategies |
| [B3006](/docs/errors/b3006) | Lazy-hydration on non-lazy component |
| [B3007](/docs/errors/b3007) | `nuxt-client` attribute requires `selectiveClient` or Vite |
| [B3008](/docs/errors/b3008) | Component name typo (case-sensitive directory) |
| [B3009](/docs/errors/b3009) | Reserved "Lazy" prefix on component |
| [B3010](/docs/errors/b3010) | Component did not resolve to a file name |
| [B3011](/docs/errors/b3011) | Duplicate component name |
| [B3012](/docs/errors/b3012) | Overriding component without priority |

### B4xxx: Pages / Routing

| Code | Description |
|------|-------------|
| [B4001](/docs/errors/b4001) | Page file has no content |
| [B4002](/docs/errors/b4002) | `await` in `definePageMeta` |
| [B4003](/docs/errors/b4003) | Multiple `definePageMeta` calls |
| [B4004](/docs/errors/b4004) | Duplicate route name |
| [B4005](/docs/errors/b4005) | `definePageMeta` must use object literal |
| [B4006](/docs/errors/b4006) | `definePageMeta` must use serializable literal |
| [B4007](/docs/errors/b4007) | Error transforming page macro |
| [B4008](/docs/errors/b4008) | Server pages with `ssr: false` |
| [B4009](/docs/errors/b4009) | No layout name could be resolved |
| [B4010](/docs/errors/b4010) | No middleware name could be resolved |
| [B4011](/docs/errors/b4011) | Page tree warning |
| [B4012](/docs/errors/b4012) | Incremental route update failed |
| [B4013](/docs/errors/b4013) | Middleware already exists |
| [B4014](/docs/errors/b4014) | Not overriding existing layout |

### B5xxx: Configuration

| Code | Description |
|------|-------------|
| [B5001](/docs/errors/b5001) | Missing `compatibilityDate` |
| [B5002](/docs/errors/b5002) | Failed to install webpack builder |
| [B5003](/docs/errors/b5003) | Reserved `runtimeConfig.app` namespace |
| [B5004](/docs/errors/b5004) | External config file not supported |
| [B5005](/docs/errors/b5005) | Unable to load schema |
| [B5006](/docs/errors/b5006) | webpack hash in dev mode |
| [B5007](/docs/errors/b5007) | webpack target should be "node" |
| [B5008](/docs/errors/b5008) | Unknown PostCSS order preset |
| [B5009](/docs/errors/b5009) | Falling back to chokidar for schema |
| [B5010](/docs/errors/b5010) | Missing packages |
| [B5011](/docs/errors/b5011) | Package is missing |
| [B5012](/docs/errors/b5012) | Run command to install package |

### B6xxx: Head / Imports

| Code | Description |
|------|-------------|
| [B6001](/docs/errors/b6001) | Importing from `@unhead/vue` instead of `#imports` |
| [B6002](/docs/errors/b6002) | Auto-import name conflict |

### B7xxx: webpack / Vite Bundler

| Code | Description |
|------|-------------|
| [B7001](/docs/errors/b7001) | Bundle analysis requires `rollup-plugin-visualizer` |
| [B7002](/docs/errors/b7002) | Vite `optimizeDeps` stale |
| [B7003](/docs/errors/b7003) | Server bundle should have one entry file |
| [B7004](/docs/errors/b7004) | webpack entry not found |
| [B7005](/docs/errors/b7005) | No client entry in `rollupOptions` |
| [B7006](/docs/errors/b7006) | No server entry in `rollupOptions` |
| [B7007](/docs/errors/b7007) | Could not load PostCSS plugin (Vite) |
| [B7008](/docs/errors/b7008) | Install `@vitejs/plugin-vue-jsx` |
| [B7009](/docs/errors/b7009) | Install packages for decorator support |
| [B7010](/docs/errors/b7010) | Install packages for decorator support (Nitro) |
| [B7011](/docs/errors/b7011) | Could not import PostCSS plugin (webpack) |
| [B7012](/docs/errors/b7012) | Buffer size limit exceeded (ViteNode) |
| [B7013](/docs/errors/b7013) | Socket path not configured (ViteNode) |
| [B7014](/docs/errors/b7014) | webpack build failed |
| [B7015](/docs/errors/b7015) | Payload extraction recommended |
| [B7016](/docs/errors/b7016) | Custom `spaLoadingTemplate` not found |

### B8xxx: Kit API

| Code | Description |
|------|-------------|
| [B8001](/docs/errors/b8001) | Nuxt instance unavailable |
| [B8002](/docs/errors/b8002) | `base` argument missing for `createResolver` |
| [B8003](/docs/errors/b8003) | Nitro not initialized yet |
| [B8004](/docs/errors/b8004) | Nuxt compatibility issues found |
| [B8005](/docs/errors/b8005) | Cannot determine Nuxt version |
| [B8006](/docs/errors/b8006) | Cannot find Nuxt version from cwd |
| [B8007](/docs/errors/b8007) | Invalid type template filename |
| [B8008](/docs/errors/b8008) | Invalid template |
| [B8009](/docs/errors/b8009) | Template not found |
| [B8010](/docs/errors/b8010) | Invalid template: no `getContents` or `src` |
| [B8011](/docs/errors/b8011) | Invalid template: no `filename` |
| [B8012](/docs/errors/b8012) | Module used outside Nuxt context |
| [B8013](/docs/errors/b8013) | Module disabled due to incompatibility |
| [B8014](/docs/errors/b8014) | Slow module setup |
| [B8015](/docs/errors/b8015) | Module should be a function or string |
| [B8016](/docs/errors/b8016) | Module should be a function |
| [B8017](/docs/errors/b8017) | Could not load module |
| [B8018](/docs/errors/b8018) | Error importing module |
| [B8019](/docs/errors/b8019) | Error in module hook |
