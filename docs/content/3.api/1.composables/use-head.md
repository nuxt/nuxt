---
description:  useHead customizes the head properties of individual pages of your Nuxt app.
---

# `useHead`

Nuxt provides the `useHead` composable to add and customize the head properties of individual pages of your Nuxt app. It uses [@vueuse/head](https://github.com/vueuse/head) under the hood.

::alert{icon=👉}
`useHead` only works during `setup` or `Lifecycle Hooks`.
::

## Type

```ts
useHead(meta: Computable<MetaObject>): void

interface MetaObject extends Record<string, any> {
  charset?: string
  viewport?: string
  meta?: Array<Record<string, any>>
  link?: Array<Record<string, any>>
  style?: Array<Record<string, any>>
  script?: Array<Record<string, any>>
  noscript?: Array<Record<string, any>>
  titleTemplate?: string | ((title: string) => string)
  title?: string
  bodyAttrs?: Record<string, any>
  htmlAttrs?: Record<string, any>
}
```

Application-wide configuration of the head metadata is possible through [nuxt.config](/api/configuration/nuxt-config#head), or by placing the `useHead` in the `app.vue` file.

::alert{type=info}
The properties of `useHead` can be dynamic, accepting `ref`, `computed` and `reactive` properties. `meta` parameter can also accept a function returning an object to make the entire object reactive.
::

## Parameters

### `meta`

**Type**: `MetaObject`

An object accepting the following head metadata:

- `charset`

  **Type**: `string`

  **Default**: `utf-8`

  Specifies character encoding for the HTML document.

- `viewport`

  **Type**: `string`

  **Default**: `width=device-width, initial-scale=1`

  Configures the viewport (the user's visible area of a web page).

- `meta`

  **Type**: `Array<Record<string, any>>`

  **Default**: `width=device-width, initial-scale=1`

  Each element in the array is mapped to a newly-created `<meta>` tag, where object properties are mapped to the corresponding attributes.

- `link`

  **Type**: `Array<Record<string, any>>`

  Each element in the array is mapped to a newly-created `<link>` tag, where object properties are mapped to the corresponding attributes.

- `style`

  **Type**: `Array<Record<string, any>>`

  Each element in the array is mapped to a newly-created `<style>` tag, where object properties are mapped to the corresponding attributes.

- `script`

  **Type**: `Array<Record<string, any>>`

  Each element in the array is mapped to a newly-created `<script>` tag, where object properties are mapped to the corresponding attributes.

- `noscript`

  **Type**: `Array<Record<string, any>>`

  Each element in the array is mapped to a newly-created `<noscript>` tag, where object properties are mapped to the corresponding attributes.

- `titleTemplate`

  **Type**: `string` | `((title: string) => string)`

  Configures dynamic template to customize the page title on an individual page.

- `title`

  **Type**: `string`

  Sets static page title on an individual page.

- `bodyAttrs`

  **Type**: `Record<string, any>`

  Sets attributes of the `<body>` tag. Each object property is mapped to the corresponding attribute.

- `htmlAttrs`

  **Type**: `Record<string, any>`

  Sets attributes of the `<html>` tag. Each object property is mapped to the corresponding attribute.

## Examples

### Customize Metadata

The example below changes the website's `title` and `description` using `meta` option of the `useHead` composable:

```vue
<script setup>
  const title = ref('My App')
  const description = ref('My amazing Nuxt app')

  useHead({
    title,
    meta: [
      {
        name: 'description',
        content: description
      }
    ]
  })
</script>
```

### Add Dynamic Title

In the example below, `titleTemplate` is set either as a string with the `%s` placeholder or as a `function`, which allows greater flexibility in setting the page title dynamically for each route of your Nuxt app:

```vue [app.vue]
<script setup>
  useHead({
    // as a string,
    // where `%s` is replaced with the title
    titleTemplate: '%s - Site Title',
    // ... or as a function 
    titleTemplate: (productCategory) => {
      return productCategory
        ? `${productCategory} - Site Title`
        : 'Site Title'
    }
  })
</script>
```

`nuxt.config` is also used as an alternative way of setting the page title. However, `nuxt.config` does not allow the page title to be dynamic. Therefore, it is recommended to use `titleTemplate` in the `app.vue` file to add a dynamic title, which is then applied to all routes of your Nuxt app.

### Add External CSS

The example below inserts Google Fonts using the `link` property of the `useHead` composable:

```vue
<script setup>  
  useHead({
    link: [
      { 
        rel: 'preconnect', 
        href: 'https://fonts.googleapis.com'
      },
      { 
        rel: 'stylesheet', 
        href: 'https://fonts.googleapis.com/css2?family=Roboto&display=swap', 
        crossorigin: '' 
      }
    ]
  })
</script>
```

### Add Third-party Script

The example below inserts a third-party script using the `script` property of the `useHead` composable:

```vue
<script setup>
  useHead({
    script: [
      {
        src: 'https://third-party-script.com',
        body: true
      }
    ]
  })
</script>
```

You can use the `body: true` option to add the above script at the end of the `<body>` tag.

:ReadMore{link="/guide/features/head-management"}
