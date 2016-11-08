# Using external modules and plugings with Nuxt.js

## Configuration: `vendor`

> Nuxt.js allows you to add modules inside the `vendor.bundle.js` file generated to reduce the size of the app bundle. It's really useful when using external modules (like `axios` for example)

To add a module/file inside the vendor bundle, add the `vendor` key inside `nuxt.config.js`:
```js
const { join } = require('path')

module.exports = {
  vendor: [
    'axios', // node module
    join(__dirname, './js/my-library.js') // custom file
  ]
}
```

## Configuration: `plugins`

> Nuxt.js allows you to define js plugins to be ran before instantiating the root vue.js application

I want to use [vee-validate](https://github.com/logaretm/vee-validate) to validate the data in my inputs, I need to setup the plugin before launching the app.

File `plugins/vee-validate.js`:
```js
import Vue from 'vue'
import VeeValidate from 'vee-validate'

Vue.use(VeeValidate)
```

Then, I add my file inside the `plugins` key of `nuxt.config.js`:
```js
const { join } = require('path')

module.exports = {
  vendor: ['vee-validate'],
  plugins: [ join(__dirname, './plugins/vee-validate') ]
}
```

I added `vee-validate` in the `vendor` key to make sure that it won't be included in any other build if I call `require('vee-validate')`` in a component.

### Only in browser build

Some plugins might work only in the browser, for this, you can use the `process.BROWSER` variable to check if the bundle will be for the server or the client.

Example:
```js
if (process.BROWSER) {
  import Vue from 'vue'
  import VeeValidate from 'vee-validate'

  Vue.use(VeeValidate)
}
```

## Demo

```bash
npm install
npm start
```

Go to [http://localhost:3000](http://localhost:3000) and navigate trough the pages.
