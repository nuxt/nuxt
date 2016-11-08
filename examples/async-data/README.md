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

## Context

List of all the available keys in `context`:

| Key | Type | Available | Description |
|-----|------|--------------|-------------|
| `isClient` | Boolean | Client & Server | Boolean to let you know if you're actually renderer from the client-side |
| `isServer` | Boolean | Client & Server | Boolean to let you know if you're actually renderer from the server-side |
| `route` | [vue-router route](https://router.vuejs.org/en/api/route-object.html) | Client & Server | `vue-router` route instance [see documentation](https://router.vuejs.org/en/api/route-object.html) |
| `store` | [vuex store](http://vuex.vuejs.org/en/api.html#vuexstore-instance-properties) | Client & Server | `Vuex.Store` instance. **Available only if `store: true` is set in `nuxt.config.js`** |
| `params` | Object | Client & Server | Alias of route.params |
| `query` | Object | Client & Server | Alias of route.query |
| `req` | [http.Request](https://nodejs.org/api/http.html#http_class_http_incomingmessage) | Server | Request from the node.js server. If nuxt is used as a middleware, the req object might be different depending of the framework you're using. |
| `res` | [http.Response](https://nodejs.org/api/http.html#http_class_http_serverresponse) | Server | Response from the node.js server. If nuxt is used as a middleware, the res object might be different depending of the framework you're using. |

## Demo

```bash
npm install
npm start
```

Go to [http://localhost:3000](http://localhost:3000) and navigate inside the app.
