# Updating headers with Nuxt.js

Nuxt.js uses [`vue-meta`](https://github.com/declandewet/vue-meta) to update the `headers` and `html attributes` of your applications.

Nuxt.js configures `vue-meta` with these options:
```js
{
  keyName: 'head', // the component option name that vue-meta looks for meta info on.
  attribute: 'n-head', // the attribute name vue-meta adds to the tags it observes
  ssrAttribute: 'n-head-ssr', // the attribute name that lets vue-meta know that meta info has already been server-rendered
  tagIDKeyName: 'hid' // the property name that vue-meta uses to determine whether to overwrite or append a tag
}
```

## Updating the title

To update the title of the page, just add `head.title` in your page component.

`pages/index.vue`
```html
<template>
  <h1>Home page 🚀</h1>
</template>

<script>
export default {
  head: {
    title: 'Home page 🚀'
  }
}
</script>
```

## Meta tags and more

To know the list of options you can give to `head`, take a look at [`vue-meta` documentation](https://github.com/declandewet/vue-meta#recognized-metainfo-properties).

## Using `data` values inside `head`

You might want to use the component data to display different headers, like a post title for example. Just use `head` as a function and you can use `this` inside to access your component data.

Example of displaying the post title:
```html
<script>
export default {
  data ({ params }) {
    // fetch the post from the API
    return axios.get(`https://my-api/posts/${params.id}`)
    .then((res) => {
      return { title: res.data.title }
    })
  },
  head () {
    return {
      title: this.title
    }
  }
}
</script>
```

## Defaults metas

Nuxt.js let you define all the defaults metas for your application inside the `nuxt.config.js`, use the same field `head`:
```js
module.exports = {
  head: {
    titleTemplate: '%s - Nuxt.js',
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { hid: 'description', name: 'description', content: 'Meta description' }
    ]
  }
}
```

## Demo

```bash
npm install
npm start
```

Go to [http://localhost:3000](http://localhost:3000) and navigate trough the app. Notice how the page's title changes between the pages and is also server-side rendered.
