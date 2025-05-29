---
title: "nuxt build"
description: "Build your Nuxt application."
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/cli/blob/main/packages/nuxi/src/commands/build.ts
    size: xs
---

<!--build-cmd-->
```bash [Terminal]
npx nuxt build [ROOTDIR] [--cwd=<directory>] [--logLevel=<silent|info|verbose>] [--prerender] [--preset] [--dotenv] [--envName]
```
<!--/build-cmd-->

The `build` command creates a `.output` directory with all your application, server and dependencies ready for production.

## Arguments

<!--build-args-->
Argument | Description
--- | ---
`ROOTDIR="."` | Specifies the working directory (default: `.`)
<!--/build-args-->

## Options

<!--build-opts-->
Option | Default | Description
--- | --- | ---
`--cwd=<directory>` |  | Specify the working directory, this takes precedence over ROOTDIR (default: `.`)
`--logLevel=<silent\|info\|verbose>` |  | Specify build-time log level
`--prerender` |  | Build Nuxt and prerender static routes
`--preset` |  | Nitro server preset
`--dotenv` |  | Path to `.env` file to load, relative to the root directory
`--envName` |  | The environment to use when resolving configuration overrides (default is `production` when building, and `development` when running the dev server)
<!--/build-opts-->

::note
This command sets `process.env.NODE_ENV` to `production`.
::

::note
`--prerender` will always set the `preset` to `static`
::
