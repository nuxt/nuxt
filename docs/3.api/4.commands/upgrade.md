---
title: "nuxi upgrade"
description: The upgrade command upgrades Nuxt to the latest version.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/cli/blob/main/src/commands/upgrade.ts
    size: xs
---

```bash [Terminal]
npx nuxi upgrade [OPTIONS] [ROOTDIR]
```

The `upgrade` command upgrades Nuxt to the latest version.

## Arguments

Argument | Default | Description
--- | --- | ---
`ROOTDIR="."` | `.` | (DEPRECATED) Use `--cwd` instead. Specifies the working directory, defaults to current directory (".")

## Options

Option | Default | Description
--- | --- | ---
`--cwd=<directory>` |  | Specify the working directory, falls back to ROOTDIR if unset (defaults to current directory (".") after ROOTDIR argument removal)
`--logLevel=<silent\|info\|verbose>` |  | Specify build-time log level
`-f, --force` |  | Force upgrade to recreate lockfile and node_modules
`-ch, --channel=<stable\|nightly>` | `stable` | Specify a channel to install from (default: stable)
