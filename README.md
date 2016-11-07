## WIP: UNSTABLE right now

# nuxt.js
>A minimalistic framework for server-rendered Vue applications (completely inspired from [Next.js](https://github.com/zeit/next.js))

## How to use

Install it:

```
$ npm install nuxt --save
```

and add a script to your package.json like this:

```json
{
  "scripts": {
    "start": "nuxt"
  }
}
```

After that, the file-system is the main API. Every `.vue` file becomes a route that gets automatically processed and rendered.

Populate `./pages/index.vue` inside your project:

```html
<template>
  <h1>Hello {{ name }}!</h1>
</template>

<script>
export default {
  data: () => ({
    name: 'world'
  })
}
</script>
```

and then just run `npm start` and go to `http://localhost:3000`

So far, we get:

- Automatic transpilation and bundling (with webpack and babel)
- Hot code reloading
- Server rendering and indexing of `./pages`
- Static file serving. `./static/` is mapped to `/static/`
- Config file nuxt.config.js

To see how simple this is, check out the [sample app - nuxtgram](https://github.com/atinux/nuxtgram)
