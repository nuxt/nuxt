# Global CSS with Nuxt.js

> Nuxt.js let you define the CSS files/modules/libraries you want to set as globals (included in every pages).

## Usage

In `nuxt.config.js` file, add the CSS resources:

```js
const { resolve } = require('path')

module.exports = {
  css: [
    // Load a node.js module
    'hover.css/css/hover-min.css',
    // node.js module but we specify the lang
    { src: 'bulma', lang: 'sass' },
    // Css file in the project
    // It is important to give an absolute path
    resolve(__dirname, 'css/main.css')
  ]
}
```

## Demo

To see the demo working:
```bash
npm install
npm run dev
```

Go to [http://localhost:3000](http://localhost:3000) and navigate inside the app.

## Production

In production, they will be minified and extracted in a file named `styles.css` and added in the `<head>` of the page.

To launch the demo in production mode so you can see the `<head>` populated with the `<link>` tag:

```bash
npm run build
npm start
```

Go to [http://localhost:3000](http://localhost:3000) and check the source code.
