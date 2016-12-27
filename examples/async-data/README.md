# Async data with Nuxt.js

## data (context)

> Nuxt.js *supercharges* the `data` method from vue.js to let you handle async operation before setting the component data.

`data` is called every time before loading the component (*only if attached to a route*). It can be called from the server-side or before navigating to the corresponding route.

The `data` method receives the context as the first argument, you can use it to fetch some data and return the component data. To make the data method asynchronous, Nuxt.js offers you different ways, choose the one you're the most familiar with:

1. returning a `Promise`, Nuxt.js will wait for the promise to be resolved before rendering the Component
2. Using the async/await ES7 feature
3. Define a second argument which is a callback method to be called like this: `callback(err, data)`

Example with returning a `Promise`:
```js
export default {
  data ({ params }) {
    return axios.get(`https://my-api/posts/${params.id}`)
    .then((res) => {
      return { title: res.data.title }
    })
  }
}
```

Example with using `async/await`:
```js
export default {
  async data ({ params }) {
    let { data } = axios.get(`https://my-api/posts/${params.id}`)
    return { title: data.title }
  }
}
```

Example with using the `callback` argument:
```js
export default {
  data ({ params }, callback) {
    axios.get(`https://my-api/posts/${params.id}`)
    .then((res) => {
      callback(null, { title: res.data.title })
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
| `isDev` | Boolean | Client & Server | Boolean to let you know if you're in dev mode, can be useful for caching some data in production |
| `route` | [vue-router route](https://router.vuejs.org/en/api/route-object.html) | Client & Server | `vue-router` route instance [see documentation](https://router.vuejs.org/en/api/route-object.html) |
| `store` | [vuex store](http://vuex.vuejs.org/en/api.html#vuexstore-instance-properties) | Client & Server | `Vuex.Store` instance. **Available only if `store: true` is set in `nuxt.config.js`** |
| `params` | Object | Client & Server | Alias of route.params |
| `query` | Object | Client & Server | Alias of route.query |
| `req` | [http.Request](https://nodejs.org/api/http.html#http_class_http_incomingmessage) | Server | Request from the node.js server. If nuxt is used as a middleware, the req object might be different depending of the framework you're using. |
| `res` | [http.Response](https://nodejs.org/api/http.html#http_class_http_serverresponse) | Server | Response from the node.js server. If nuxt is used as a middleware, the res object might be different depending of the framework you're using. |
| `redirect` | Function | Client & Server | Use this method to redirect the user to another route, the status code is used on the server-side, default to 302. `redirect([status,] path [, query])` |
| `error` | Function | Client & Server | Use this method to show the error page: `error(params)`. The `params` should have the fields `statusCode` and `message`. |

## Handling errors

Nuxt.js add the `error(params)` method in the `context`, you can call it to display the error page. `params.statusCode` will be also used to render the proper status code form the server-side.

Example with a `Promise`:
```js
export default {
  data ({ params, error }) {
    return axios.get(`https://my-api/posts/${params.id}`)
    .then((res) => {
      return { title: res.data.title }
    })
    .catch((e) => {
      error({ statusCode: 404, message: 'Post not found' })
    })
  }
}
```

If you're using the `callback` argument, you can call it directly with the error, Nuxt.js will call the `error` method for you:
```js
export default {
  data ({ params }, callback) {
    axios.get(`https://my-api/posts/${params.id}`)
    .then((res) => {
      callback(null, { title: res.data.title })
    })
    .catch((e) => {
      callback({ statusCode: 404, message: 'Post not found' })
    })
  }
}
```

## Demo

```bash
npm install
npm start
```

Go to [http://localhost:3000](http://localhost:3000) and navigate trough the app.
