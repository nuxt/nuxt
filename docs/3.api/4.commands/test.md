---
title: "nuxt test"
description: The test command runs tests using @nuxt/test-utils.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/cli/blob/main/packages/nuxi/src/commands/test.ts
    size: xs
---

<!--test-cmd-->
```bash [Terminal]
npx nuxt test [ROOTDIR] [--cwd=<directory>] [--logLevel=<silent|info|verbose>] [--dev] [--watch]
```
<!--/test-cmd-->

The `test` command runs tests using [`@nuxt/test-utils`](/docs/getting-started/testing). This command sets `process.env.NODE_ENV` to `test` if not already set.

## Arguments

<!--test-args-->
Argument | Description
--- | ---
`ROOTDIR="."` | Specifies the working directory (default: `.`)
<!--/test-args-->

## Options

<!--test-opts-->
Option | Default | Description
--- | --- | ---
`--cwd=<directory>` |  | Specify the working directory, this takes precedence over ROOTDIR (default: `.`)
`--logLevel=<silent\|info\|verbose>` |  | Specify build-time log level
`--dev` |  | Run in dev mode
`--watch` |  | Watch mode
<!--/test-opts-->

::note
This command sets `process.env.NODE_ENV` to `test`.
::