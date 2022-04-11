# `useHead`

::ReadMore{link="/guide/features/head-management"}

Nuxt provides a composable to update the head properties of your page with an [`MetaObject`](/api/composables/use-head/#metaobject) of meta properties with keys corresponding to meta tags:

`title`, `base`, `script`, `style`, `meta` and `link`, as well as `htmlAttrs` and `bodyAttrs`. Alternatively, you can pass a function returning the object for reactive metadata.

```js
useHead(options: MetaObject)
```

::alert{icon=👉}
**`useHead` only works during `setup`**.
::

## Example

The example below changes the website's title in the `meta` and inserts a Google Font using the `link` property.

```js
export default {
  setup () {
    useHead({
      meta: [
        { name: 'title' content: 'Nuxt 3 - The Hybrid Vue Framework' }
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Roboto&display=swap', crossorigin: '' },
      ]
    })
  }
}
```

## `MetaObject`

* **charset**: the character encoding in which the document is encoded => `<meta charset="<value>" />` (default: `'utf-8'`)
* **viewport**: configuration of the viewport (the area of the window in which web content can be seen) => `<meta name="viewport" content="<value>" />` (default: `'width=device-width, initial-scale=1'`)
* **meta**: array, each item maps to a newly-created `<meta>` element, where object properties map to attributes.
* **link**: array, each item maps to a newly-created `<link>` element, where object properties map to attributes.
* **style**: array, each item maps to a newly-created `<style>` element, where object properties map to attributes.
* **script**: array, each item maps to a newly-created `<script>` element, where object properties map to attributes.

All elements in the meta object are optional. You can also pass only single values.
