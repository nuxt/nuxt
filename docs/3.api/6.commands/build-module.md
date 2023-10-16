# `nuxi build-module`

```{bash}
npx nuxi build-module [--stub] [rootDir]
```

The `build-module` command runs `@nuxt/module-builder` to generate `dist` directory within your `rootDir` that contains the full build for your **nuxt-module**.

Option        | Default          | Description
-------------------------|-----------------|------------------
`rootDir` | `.` | The root directory of the module to bundle.
`--stub` | `false` | Stub out your module for development using [jiti](https://github.com/unjs/jiti#jiti). (**note:** This is mainly for development purposes.)

::alert
This command is only available when you are using `@nuxt/module-builder` to build your module. Please see [this readme](https://github.com/nuxt/module-builder#-nuxt-module-builder) for more information.
::
