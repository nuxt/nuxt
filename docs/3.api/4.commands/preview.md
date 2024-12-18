---
title: "nuxi preview"
description: The preview command starts a server to preview your application after the build command.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/cli/blob/main/src/commands/preview.ts
    size: xs
---

<!--preview-cmd-->
```bash [Terminal]
npx nuxi preview [ROOTDIR] [--cwd=<directory>] [--logLevel=<silent|info|verbose>] [--envName] [--dotenv]
```
<!--/preview-cmd-->

The `preview` command starts a server to preview your Nuxt application after running the `build` command. The `start` command is an alias for `preview`. When running your application in production refer to the [Deployment section](/docs/getting-started/deployment).

## Arguments

<!--preview-args-->
Argument | Description
--- | ---
`ROOTDIR="."` | Specifies the working directory (default: `.`)
<!--/preview-args-->

## Options

<!--preview-opts-->
Option | Default | Description
--- | --- | ---
`--cwd=<directory>` |  | Specify the working directory, this takes precedence over ROOTDIR (default: `.`)
`--logLevel=<silent\|info\|verbose>` |  | Specify build-time log level
`--envName` |  | The environment to use when resolving configuration overrides (default is `production` when building, and `development` when running the dev server)
`--dotenv` |  | Path to `.env` file to load, relative to the root directory
<!--/preview-opts-->

This command sets `process.env.NODE_ENV` to `production`. To override, define `NODE_ENV` in a `.env` file or as command-line argument.

::note
For convenience, in preview mode, your [`.env`](/docs/guide/directory-structure/env) file will be loaded into `process.env`. (However, in production you will need to ensure your environment variables are set yourself.)
::
