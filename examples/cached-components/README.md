# Cached Components

> Nuxt.js use [lru-cache](https://github.com/isaacs/node-lru-cache) to allows cached components for better render performances

## Usage

Use the `cache` key in your `nuxt.config.js`:
```js
module.exports = {
  cache: true
}
```

`cache` can be a Boolean of an Object, if an object, you can use theses keys:

| key  | Optional? | Type | Default | definition |
|------|------------|-----|---------|------------|
| `max` | Optional | Integer | 1000 | The maximum size of the cached components, when the 1001 is added, the first one added will be removed from the cache to let space for the new one. |
| `maxAge` | Optional | Integer | 900000 | Maximum age in ms, default to 15 minutes. |

Other options: https://github.com/isaacs/node-lru-cache#options

## Demo

```bash
npm install
npm start
```

Go to [http://localhost:3000](http://localhost:3000)
