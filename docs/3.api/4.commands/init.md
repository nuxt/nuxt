---
title: "create nuxt"
description: The init command initializes a fresh Nuxt project.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/cli/blob/main/packages/nuxi/src/commands/init.ts
    size: xs
---

<!--init-cmd-->
```bash [Terminal]
npm create nuxt@latest [DIR] [--cwd=<directory>] [-t, --template] [-f, --force] [--offline] [--preferOffline] [--no-install] [--gitInit] [--shell] [--packageManager]
```
<!--/init-cmd-->

The `create-nuxt` command initializes a fresh Nuxt project using [unjs/giget](https://github.com/unjs/giget).

## Arguments

<!--init-args-->
Argument | Description
--- | ---
`DIR=""` | Project directory
<!--/init-args-->

## Options

<!--init-opts-->
Option | Default | Description
--- | --- | ---
`--cwd=<directory>` | `.` | Specify the working directory
`-t, --template` |  | Template name
`-f, --force` |  | Override existing directory
`--offline` |  | Force offline mode
`--preferOffline` |  | Prefer offline mode
`--no-install` |  | Skip installing dependencies
`--gitInit` |  | Initialize git repository
`--shell` |  | Start shell after installation in project directory
`--packageManager` |  | Package manager choice (npm, pnpm, yarn, bun)
<!--/init-opts-->

## Environment variables

- `NUXI_INIT_REGISTRY`: Set to a custom template registry. ([learn more](https://github.com/unjs/giget#custom-registry)).
  - Default registry is loaded from [nuxt/starter/templates](https://github.com/nuxt/starter/tree/templates/templates)
