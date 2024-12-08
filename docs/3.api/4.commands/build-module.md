---
title: 'nuxi build-module'
description: 'Nuxt command to build your Nuxt module before publishing.'
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/cli/blob/main/src/commands/build-module.ts
    size: xs
---

```bash [Terminal]
npx nuxi build-module [OPTIONS] [ROOTDIR]
```

The `build-module` command runs `@nuxt/module-builder` to generate `dist` directory within your `rootDir` that contains the full build for your **nuxt-module**.

## Arguments

Argument | Default | Description
--- | --- | ---
`ROOTDIR="."` | `.` | (DEPRECATED) Use `--cwd` instead. Specifies the working directory, defaults to current directory (".")

## Options

Option | Default | Description
--- | --- | ---
`--cwd=<directory>` |  | Specify the working directory, falls back to ROOTDIR if unset (defaults to current directory (".") after ROOTDIR argument removal)
`--logLevel=<silent\|info\|verbose>` |  | Specify build-time log level
`--no-build` |  | Build module for distribution
`--stub` | `false` | Stub dist instead of actually building it for development
`--sourcemap` | `false` | Generate sourcemaps
`--prepare` | `false` | Prepare module for local development

::read-more{to="https://github.com/nuxt/module-builder" icon="i-simple-icons-github" color="gray" target="_blank"}
Read more about `@nuxt/module-builder`.
::
