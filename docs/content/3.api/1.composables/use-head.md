---
description: useHead customizes the head properties of individual pages of your Nuxt app.
---

# `useHead`

Nuxt provides the `useHead` composable to add and customize the head properties of individual pages of your Nuxt app.

`useHead` is powered by [@vueuse/head](https://github.com/vueuse/head), you can find more in-depth documentation [here](https://unhead.harlanzw.com/)

::ReadMore{link="/getting-started/seo-meta"}
::

## Type

```ts
useHead(meta: MaybeComputedRef<MetaObject>): void
```

Below are the non-reactive types for `useHead`. See [zhead](https://github.com/harlan-zw/zhead/tree/main/packages/schema/src) for more detailed types.

```ts
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

::alert{type=info}
The properties of `useHead` can be dynamic, accepting `ref`, `computed` and `reactive` properties. `meta` parameter can also accept a function returning an object to make the entire object reactive.
::

## Parameters

### `meta`

**Type**: `MetaObject`

An object accepting the following head metadata:

- `meta`

  **Type**: `Array<Record<string, any>>`

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
