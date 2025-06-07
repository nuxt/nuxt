---
title: "defineNuxtPlugin"
description: defineNuxtPlugin() is a helper function for creating Nuxt plugins.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/nuxt.ts
    size: xs
---

`defineNuxtPlugin` is a helper function for creating Nuxt plugins with enhanced functionality and type safety. This utility normalizes different plugin formats into a consistent structure that works seamlessly within Nuxt's plugin system.

```ts [plugins/hello.ts]
export default defineNuxtPlugin((nuxtApp) => {
  // Doing something with nuxtApp
})
```

:read-more{to="/docs/guide/directory-structure/plugins#creating-plugins"}

## Type

```ts
defineNuxtPlugin<T extends Record<string, unknown>>(plugin: Plugin<T> | ObjectPlugin<T>): Plugin<T> & ObjectPlugin<T>

type Plugin<T> = (nuxt: NuxtApp) => Promise<void> | Promise<{ provide?: T }> | void | { provide?: T }

interface ObjectPlugin<T> {
  name?: string
  enforce?: 'pre' | 'default' | 'post'
  dependsOn?: string[]
  order?: number
  parallel?: boolean
  setup?: Plugin<T>
  hooks?: Partial<RuntimeNuxtHooks>
  env?: {
    islands?: boolean
  }
}
```

## Parameters

### `plugin`

- **Type**: `Plugin<T>` | `ObjectPlugin<T>`

  A plugin definition that can be either a function or an object with configuration.

  **Function Plugin**
  - **Type**: `(nuxtApp: NuxtApp) => Promise<void> | Promise<{ provide?: T }> | void | { provide?: T }`
  
    A simple function that receives the Nuxt app instance and can optionally return providers.

  **Object Plugin Properties**

  **`name`**
  - **Type**: `string`
  
    Optional name for the plugin, useful for debugging and dependency management.

  **`enforce`**
  - **Type**: `'pre'` | `'default'` | `'post'`
  
    Controls when the plugin runs relative to other plugins.

  **`dependsOn`**
  - **Type**: `string[]`
  
    Array of plugin names this plugin depends on. Ensures proper execution order.

  **`order`**
  - **Type**: `number`
  
    This allows more granular control over plugin order and should only be used by advanced users. **It overrides the value of `enforce` and is used to sort plugins.**

  **`parallel`**
  - **Type**: `boolean`
  
    Whether to execute the plugin in parallel with other parallel plugins.

  **`setup`**
  - **Type**: `Plugin<T>`
  
    The main plugin function, equivalent to a function plugin.

  **`hooks`**
  - **Type**: `Partial<RuntimeNuxtHooks>`
  
    Nuxt app runtime hooks to register directly.

  **`env`**
  - **Type**: `{ islands?: boolean }`
  
    Environment configuration. Set this value to `false` if you don't want the plugin to run when rendering server-only or island components.

## Examples

### Basic Usage

The example below demonstrates a simple plugin that adds global functionality:

```ts [plugins/hello.ts]
export default defineNuxtPlugin((nuxtApp) => {
  // Add a global method
  return {
    provide: {
      hello: (name: string) => `Hello ${name}!`
    }
  }
})
```

### Object Syntax Plugin

The example below shows the object syntax with advanced configuration:

```ts [plugins/advanced.ts]
export default defineNuxtPlugin({
  name: 'my-plugin',
  enforce: 'pre',
  async setup (nuxtApp) {
    // Plugin setup logic
    const data = await $fetch('/api/config')
    
    return {
      provide: {
        config: data
      }
    }
  },
  hooks: {
    'app:created'() {
      console.log('App created!')
    }
  },
  env: {
    islands: true
  }
})
```
