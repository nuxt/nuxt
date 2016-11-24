# Using external modules and plugins with nuxt.js

## Configuration: `build.vendor`

> Nuxt.js allows you to add modules inside the `vendor.bundle.js` file generated to reduce the size of the app bundle. It's really useful when using external modules (like `axios` for example)

To add a module/file inside the vendor bundle, add the `build.vendor` key inside `nuxt.config.js`:
```js
const { join } = require('path')

module.exports = {
  build: {
    vendor: [
      'axios', // node module
      join(__dirname, './js/my-library.js') // custom file
    ]
  }
}
```

## Configuration: `plugins`

> Nuxt.js allows you to define js plugins to be ran before instantiating the root vue.js application

I want to use [vue-notifications](https://github.com/se-panfilov/vue-notifications) to validate the data in my inputs, I need to setup the plugin before launching the app.

File `plugins/vue-notifications.js`:
```js
import Vue from 'vue'
import VueNotifications from 'vue-notifications'

Vue.use(VueNotifications)
```

Then, I add my file inside the `plugins` key of `nuxt.config.js`:
```js
const { join } = require('path')

module.exports = {
  build: {
    vendor: ['vue-notifications']
  },
  plugins: [ '~plugins/vue-notifications') ]
}
```

I use `~plugins` here because nuxt.js create an alias for the `plugins/` folder, it's equivalent to: `join(__dirname, './plugins/vue-notifications.js')`

I added `vue-notifications` in the `vendor` key to make sure that it won't be included in any other build if I call `require('vue-notifications')` in a component.

### Only in browser build

Some plugins might work only in the browser, for this, you can use the `process.BROWSER_BUILD` variable to check if the plugin will run from the server or from the client.

Example:
```js
import Vue from 'vue'
import VueNotifications from 'vue-notifications'

if (process.BROWSER_BUILD) {
  Vue.use(VueNotifications)
}
```

### Only in server build

In case you need to require some libraries only for the server, you can use the `process.SERVER_BUILD` variable set to `true` when webpack is creating the `server.bundle.js` file.

## Demo

```bash
npm install
npm start
```

Go to [http://localhost:3000](http://localhost:3000) and navigate trough the pages.
