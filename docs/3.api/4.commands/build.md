---
title: "nuxi build"
description: "Build your Nuxt application."
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/cli/blob/main/src/commands/build.ts
    size: xs
---

```bash [Terminal]
npx nuxi build [OPTIONS] [ROOTDIR]
```

The `build` command creates a `.output` directory with all your application, server and dependencies ready for production.

## Arguments

Argument | Default | Description
--- | --- | ---
`ROOTDIR="."` | `.` | (DEPRECATED) Use `--cwd` instead. Specifies the working directory, defaults to current directory (".")

## Options

Option | Default | Description
--- | --- | ---
`--cwd=<directory>` |  | Specify the working directory, falls back to ROOTDIR if unset (defaults to current directory (".") after ROOTDIR argument removal)
`--logLevel=<silent\|info\|verbose>` |  | Specify build-time log level
`--prerender` |  | Build Nuxt and prerender static routes
`--preset` |  | Nitro server preset
`--dotenv` |  | Path to `.env` file to load, relative to the root directory
`--envName` |  | The environment to use when resolving configuration overrides (default is `production` when building, and `development` when running the dev server)

::note
This command sets `process.env.NODE_ENV` to `production`.
::

::note
`--prerender` will always set the `preset` to `static`
::
