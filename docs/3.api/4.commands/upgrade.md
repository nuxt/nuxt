---
title: "nuxi upgrade"
description: The upgrade command upgrades Nuxt to the latest version.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/cli/blob/main/src/commands/upgrade.ts
    size: xs
---

<!--upgrade-cmd-->
```bash [Terminal]
npx nuxi upgrade [ROOTDIR] [--cwd=<directory>] [--logLevel=<silent|info|verbose>] [-f, --force] [-ch, --channel=<stable|nightly>]
```
<!--/upgrade-cmd-->

The `upgrade` command upgrades Nuxt to the latest version.

## Arguments

<!--upgrade-args-->
Argument | Description
--- | ---
`ROOTDIR="."` | Specifies the working directory (default: `.`)
<!--/upgrade-args-->

## Options

<!--upgrade-opts-->
Option | Default | Description
--- | --- | ---
`--cwd=<directory>` |  | Specify the working directory, this takes precedence over ROOTDIR (default: `.`)
`--logLevel=<silent\|info\|verbose>` |  | Specify build-time log level
`-f, --force` |  | Force upgrade to recreate lockfile and node_modules
`-ch, --channel=<stable\|nightly>` | `stable` | Specify a channel to install from (default: stable)
<!--/upgrade-opts-->
