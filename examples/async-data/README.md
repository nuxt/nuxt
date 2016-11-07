# Async data with Nuxt.js

## data(context)

> Nuxt.js *supercharges* the `data` method from vue.js to let you handle async operation before setting the real component data.

`data` is called every time before loading the component (*only if attached to a route*). It can be called from the server-side or before navigating to the corresponding route.

The `data` method receives the context as the first argument, you can use it to fetch some data and return the component data. To make the data method asynchronous, **return a Promise**, nuxt.js will wait for the promise to be resolved before rendering the Component.

For example:
```js
export default {
  data ({ params }) {
    return axios.get(`http://my-api/posts/${params.id}`)
    .then((res) => {
      return { title: res.data.title }
    })
  }
}
```

And then, you can display the data inside your template:

```html
<template>
  <h1>{{ title }}</h1>
</template>
```

## Demo

```bash
npm install
npm start
```

Go to [http://localhost:3000](http://localhost:3000) and navigate inside the app.
