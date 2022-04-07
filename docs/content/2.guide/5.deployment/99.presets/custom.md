# Custom build preset (advanced)

Get full control of Nuxt Nitro output to deploy on any kind of hosting platform.

::list{type=info}

- Allows full customization
- This is an advanced usage pattern
::

::alert{icon=IconPresets}
Back to [presets list](/guide/deployment/presets).
::

## Setup

You can create your own custom-built preset. See [the provided presets](https://github.com/nuxt/framework/blob/main/packages/nitro/src/presets) for examples.

### Inline preset definition

You can define everything that a custom preset would configure directly in the Nitro options:

```ts [nuxt.config.js|ts]
export default {
  nitro: {
    // preset options
  }
}
```

### Reusable preset

You can also define a preset in a separate file (or publish as a separate npm package).

```ts [my-preset/index.ts]
import type { NitroPreset } from 'nitropack'

const myPreset: NitroPreset = {
  // Your custom configuration
}

export default myPreset
```

Then in your `nuxt.config` you can specify that Nitro should use your custom preset:

```ts [nuxt.config.js|ts]
import { resolve } from 'path'

export default {
  nitro: {
    preset: resolve(__dirname, 'my-preset')
  }
}
```
