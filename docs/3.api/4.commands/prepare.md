---
title: 'nuxi prepare'
description: The prepare command creates a .nuxt directory in your application and generates types.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/cli/blob/main/src/commands/prepare.ts
    size: xs
---

```bash [Terminal]
npx nuxi prepare [OPTIONS] [ROOTDIR]
```

The `prepare` command creates a [`.nuxt`](/docs/guide/directory-structure/nuxt) directory in your application and generates types. This can be useful in a CI environment or as a `postinstall` command in your [`package.json`](/docs/guide/directory-structure/package).

## Arguments

Argument | Default | Description
--- | --- | ---
`ROOTDIR="."` | `.` | (DEPRECATED) Use `--cwd` instead. Specifies the working directory, defaults to current directory (".")

## Options

Option | Default | Description
--- | --- | ---
`--dotenv` |  | Path to `.env` file to load, relative to the root directory
`--cwd=<directory>` |  | Specify the working directory, falls back to ROOTDIR if unset (defaults to current directory (".") after ROOTDIR argument removal)
`--logLevel=<silent\|info\|verbose>` |  | Specify build-time log level
`--envName` |  | The environment to use when resolving configuration overrides (default is `production` when building, and `development` when running the dev server)
