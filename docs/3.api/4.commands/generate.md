---
title: "nuxi generate"
description: Pre-renders every route of the application and stores the result in plain HTML files.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/cli/blob/main/src/commands/generate.ts
    size: xs
---

```bash [Terminal]
npx nuxi generate [OPTIONS] [ROOTDIR]
```

The `generate` command pre-renders every route of your application and stores the result in plain HTML files that you can deploy on any static hosting services. The command triggers the `nuxi build` command with the `prerender` argument set to `true`

## Arguments

Argument | Default | Description
--- | --- | ---
`ROOTDIR="."` | `.` | (DEPRECATED) Use `--cwd` instead. Specifies the working directory, defaults to current directory (".")

## Options

Option | Default | Description
--- | --- | ---
`--cwd=<directory>` |  | Specify the working directory, falls back to ROOTDIR if unset (defaults to current directory (".") after ROOTDIR argument removal)
`--logLevel=<silent\|info\|verbose>` |  | Specify build-time log level
`--preset` |  | Nitro server preset
`--dotenv` |  | Path to `.env` file to load, relative to the root directory
`--envName` |  | The environment to use when resolving configuration overrides (default is `production` when building, and `development` when running the dev server)

::read-more{to="/docs/getting-started/deployment#static-hosting"}
Read more about pre-rendering and static hosting.
::
