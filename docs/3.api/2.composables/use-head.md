---
title: useHead
description: useHead customizes the head properties of individual pages of your Nuxt app.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/unjs/unhead/blob/main/packages/vue/src/composables.ts
    size: xs
---

## Usage

The `useHead` composable allows you to manage your head tags in a programmatic and reactive way, powered by [Unhead](https://unhead.unjs.io). It lets you customize the meta tags, links, scripts, and other elements in the `<head>` section of your HTML document.

```vue [app/app.vue]
<script setup lang="ts">
useHead({
  title: 'My App',
  meta: [
    { name: 'description', content: 'My amazing site.' }
  ],
  bodyAttrs: {
    class: 'test'
  },
  script: [{ innerHTML: 'console.log(\'Hello world\')' }]
})
</script>
```

::warning
If the data comes from a user or other untrusted source, we recommend you check out [`useHeadSafe`](/docs/4.x/api/composables/use-head-safe).
::

::note
The properties of `useHead` can be dynamic, accepting `ref`, `computed` and `reactive` properties. The `meta` parameter can also accept a function returning an object to make the entire object reactive.
::

## Type

```ts [Signature]
export function useHead (meta: MaybeComputedRef<MetaObject>): void

interface MetaObject {
  title?: string
  titleTemplate?: string | ((title?: string) => string)
  base?: Base
  link?: Link[]
  meta?: Meta[]
  style?: Style[]
  script?: Script[]
  noscript?: Noscript[]
  htmlAttrs?: HtmlAttributes
  bodyAttrs?: BodyAttributes
}
```

See [@unhead/schema](https://github.com/unjs/unhead/blob/main/packages/vue/src/types/schema.ts) for more detailed types.

## Parameters

`meta`: An object accepting head metadata properties to customize the page's `<head>` section. All properties support reactive values (`ref`, `computed`, `reactive`) or can be a function returning the metadata object.

| Property | Type | Description |
| --- | --- | --- |
| `title` | `string` | Sets the page title. |
| `titleTemplate` | `string \| ((title?: string) => string)` | Configures a dynamic template to customize the page title. Can be a string with `%s` placeholder or a function. |
| `base` | `Base` | Sets the `<base>` tag for the document. |
| `link` | `Link[]` | Array of link objects. Each element is mapped to a `<link>` tag, where object properties correspond to HTML attributes. |
| `meta` | `Meta[]` | Array of meta objects. Each element is mapped to a `<meta>` tag, where object properties correspond to HTML attributes. |
| `style` | `Style[]` | Array of style objects. Each element is mapped to a `<style>` tag, where object properties correspond to HTML attributes. |
| `script` | `Script[]` | Array of script objects. Each element is mapped to a `<script>` tag, where object properties correspond to HTML attributes. |
| `noscript` | `Noscript[]` | Array of noscript objects. Each element is mapped to a `<noscript>` tag, where object properties correspond to HTML attributes. |
| `htmlAttrs` | `HtmlAttributes` | Sets attributes of the `<html>` tag. Each object property is mapped to the corresponding attribute. |
| `bodyAttrs` | `BodyAttributes` | Sets attributes of the `<body>` tag. Each object property is mapped to the corresponding attribute. |

## Return Values

This composable does not return any value. It registers the head metadata with Unhead, which manages the actual DOM updates.

## Examples

### Basic Meta Tags

```vue [app/pages/about.vue]
<script setup lang="ts">
useHead({
  title: 'About Us',
  meta: [
    { name: 'description', content: 'Learn more about our company' },
    { property: 'og:title', content: 'About Us' },
    { property: 'og:description', content: 'Learn more about our company' }
  ]
})
</script>
```

### Reactive Meta Tags

```vue [app/pages/profile.vue]
<script setup lang="ts">
const profile = ref({ name: 'John Doe' })

useHead({
  title: computed(() => profile.value.name),
  meta: [
    { 
      name: 'description', 
      content: computed(() => `Profile page for ${profile.value.name}`) 
    }
  ]
})
</script>
```

### Using a Function for Full Reactivity

```vue [app/pages/dynamic.vue]
<script setup lang="ts">
const count = ref(0)

useHead(() => ({
  title: `Count: ${count.value}`,
  meta: [
    { name: 'description', content: `Current count is ${count.value}` }
  ]
}))
</script>
```

### Adding External Scripts and Styles

```vue [app/pages/external.vue]
<script setup lang="ts">
useHead({
  link: [
    {
      rel: 'stylesheet',
      href: 'https://cdn.example.com/styles.css'
    }
  ],
  script: [
    {
      src: 'https://cdn.example.com/script.js',
      async: true
    }
  ]
})
</script>
```

### Body and HTML Attributes

```vue [app/pages/themed.vue]
<script setup lang="ts">
const isDark = ref(true)

useHead({
  htmlAttrs: {
    lang: 'en',
    class: computed(() => isDark.value ? 'dark' : 'light')
  },
  bodyAttrs: {
    class: 'themed-page'
  }
})
</script>
```

:read-more{to="/docs/4.x/getting-started/seo-meta"}
