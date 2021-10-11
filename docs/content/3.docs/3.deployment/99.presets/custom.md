# Custom build preset (advanced)

 - Allows full customization
 - This is an advanced usage pattern

### Setup

You can create your own custom build preset. See [the provided presets](https://github.com/nuxt/framework/blob/main/packages/nitro/src/presets) for examples.

#### Inline preset definition

You can define everything that a custom preset would configure directly in the Nitro options:

```ts [nuxt.config.js]
export default {
  nitro: {
    //
  }
}
```

#### Reusable preset

You can also define a preset in a separate file (or publish as a separate npm package).

```ts [my-preset/index.ts]
import type { NitroPreset } from '@nuxt/nitro'

const myPreset: NitroPreset = {
  // Your custom configuration
}

export default myPreset
```

Then in your `nuxt.config` you can specify that Nitro should use your custom preset:

```ts [nuxt.config.js]
import { resolve } from 'path'

export default {
  nitro: {
    preset: resolve(__dirname, 'my-preset')
  }
}
```
