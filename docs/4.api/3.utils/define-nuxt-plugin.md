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

```ts twoslash [plugins/hello.ts]
export default defineNuxtPlugin((nuxtApp) => {
  // Doing something with nuxtApp
})
```

:read-more{to="/docs/3.x/directory-structure/plugins#creating-plugins"}

## Type

```ts [Signature]
export function defineNuxtPlugin<T extends Record<string, unknown>> (plugin: Plugin<T> | ObjectPlugin<T>): Plugin<T> & ObjectPlugin<T>

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

**plugin**: A plugin can be defined in two ways:
1. **Function Plugin**: A function that receives the [`NuxtApp`](/docs/3.x/guide/going-further/internals#the-nuxtapp-interface) instance and can return a promise with a potential object with a [`provide`](/docs/3.x/directory-structure/plugins#providing-helpers) property if you want to provide a helper on [`NuxtApp`](/docs/3.x/guide/going-further/internals#the-nuxtapp-interface) instance.
2. **Object Plugin**: An object that can include various properties to configure the plugin's behavior, such as `name`, `enforce`, `dependsOn`, `order`, `parallel`, `setup`, `hooks`, and `env`.

| Property           | Type                                                                 | Required | Description                                                                                                     |
| ------------------ | -------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------- |
| `name` | `string` | `false` | Optional name for the plugin, useful for debugging and dependency management. |
| `enforce` | `'pre'` \| `'default'` \| `'post'` | `false` | Controls when the plugin runs relative to other plugins. |
| `dependsOn` | `string[]` | `false` | Array of plugin names this plugin depends on. Ensures proper execution order. |
| `order` | `number` | `false` | This allows more granular control over plugin order and should only be used by advanced users. **It overrides the value of `enforce` and is used to sort plugins.** |
| `parallel` | `boolean` | `false` | Whether to execute the plugin in parallel with other parallel plugins. |
| `setup` | `Plugin<T>`{lang="ts"}  | `false` | The main plugin function, equivalent to a function plugin. |
| `hooks` | `Partial<RuntimeNuxtHooks>`{lang="ts"}  | `false` | Nuxt app runtime hooks to register directly. |
| `env` | `{ islands?: boolean }`{lang="ts"}  | `false` | Set this value to `false` if you don't want the plugin to run when rendering server-only or island components. |

:video-accordion{title="Watch a video from Alexander Lichter about the Object Syntax for Nuxt plugins" videoId="2aXZyXB1QGQ"}

## Examples

### Basic Usage

The example below demonstrates a simple plugin that adds global functionality:

```ts twoslash [plugins/hello.ts]
export default defineNuxtPlugin((nuxtApp) => {
  // Add a global method
  return {
    provide: {
      hello: (name: string) => `Hello ${name}!`,
    },
  }
})
```

### Object Syntax Plugin

The example below shows the object syntax with advanced configuration:

```ts twoslash [plugins/advanced.ts]
export default defineNuxtPlugin({
  name: 'my-plugin',
  enforce: 'pre',
  async setup (nuxtApp) {
    // Plugin setup logic
    const data = await $fetch('/api/config')

    return {
      provide: {
        config: data,
      },
    }
  },
  hooks: {
    'app:created' () {
      console.log('App created!')
    },
  },
})
```
