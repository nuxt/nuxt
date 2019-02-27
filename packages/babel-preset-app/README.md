# `@nuxt/babel-preset-app`
## Default babel preset for nuxt

## Usage

This is the default preset used by Nuxt and no additional configuration usually required. But there is an option to fine tune it's behavior if needed. Just add the following to nuxt-config
```js
    babel: {
      presets({ isServer }) {
        return [
          [
            "@nuxt/babel-preset-app", options            
          ]
        ]
      }
    }
```    
where `options` is an object with paramaters of following type
```
 const options = {
      useBuiltIns: "entry"
      }
```
Below is the list of all available parameters

### Options
* **polyfills**, default `['es6.array.iterator','es6.promise','es7.promise.finally']`
* **buildTarget**
* **loose**, default `false`
* **debug**, default  `false`
* **useBuiltIns**, default `"usage"`
* **modules**, default `false`
* **spec**
* **ignoreBrowserslistConfig**, default `modern`
* **configPath**
* **include**
* **exclude**
* **targets**
* **jsx**
* **modern**
* **shippedProposals**
* **forceAllTransforms**
* **decoratorsBeforeExport**
* **decoratorsLegacy**

### Example 1. Change targets for server and client respectively
```js
  babel: {
      presets({ isServer }) {
        return [
          [
            "@nuxt/babel-preset-app",
            {
              targets: isServer
                ? { node: "current" }
                : { browsers: ["last 2 versions"], ie: 11 }
            }
          ]
        ]
      }
    },
```    
