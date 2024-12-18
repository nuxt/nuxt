---
title: "nuxi info"
description: The info command logs information about the current or specified Nuxt project.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/cli/blob/main/src/commands/info.ts
    size: xs
---

<!--info-cmd-->
```bash [Terminal]
npx nuxi info [ROOTDIR] [--cwd=<directory>]
```
<!--/info-cmd-->

The `info` command logs information about the current or specified Nuxt project.

## Arguments

<!--info-args-->
Argument | Description
--- | ---
`ROOTDIR="."` | Specifies the working directory (default: `.`)
<!--/info-args-->

## Options

<!--info-opts-->
Option | Default | Description
--- | --- | ---
`--cwd=<directory>` |  | Specify the working directory, this takes precedence over ROOTDIR (default: `.`)
<!--/info-opts-->
