# nuxt-start

> Start Nuxt Application in production mode.

## Installation

```bash
npm install --save nuxt-start
````

Add/Update your "start" script into your `package.json`:

```json
{
	"scripts": {
		"start": "nuxt-start"
	}
}
```

## Usage

```bash
nuxt-start <dir> -p <port number> -H <hostname> -c <config file>
```

## Programmatic Usage

```js
const { Nuxt } = require('nuxt-start')

// Require nuxt config
const config = require('./nuxt.config.js')

// Create a new nuxt instance (config needs dev: false)
const nuxt = new Nuxt(config)

// Start nuxt server
nuxt.listen(3000) // nuxt.listen(port, host)

// Or use `nuxt.render` as an express middleware
```
