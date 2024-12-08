---
title: "nuxi init"
description: The init command initializes a fresh Nuxt project.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/cli/blob/main/src/commands/init.ts
    size: xs
---

```bash [Terminal]
npx nuxi init [OPTIONS] [DIR]
```

The `init` command initializes a fresh Nuxt project using [unjs/giget](https://github.com/unjs/giget).

## Arguments

Argument | Default | Description
--- | --- | ---
`DIR=""` |  | Project directory

## Options

Option | Default | Description
--- | --- | ---
`--cwd=<directory>` | `.` | Specify the working directory, defaults to current directory (".")
`--logLevel=<silent\|info\|verbose>` |  | Specify build-time log level
`-t, --template` |  | Template name
`-f, --force` |  | Override existing directory
`--offline` |  | Force offline mode
`--preferOffline` |  | Prefer offline mode
`--no-install` |  | Skip installing dependencies
`--gitInit` |  | Initialize git repository
`--shell` |  | Start shell after installation in project directory
`--packageManager` |  | Package manager choice (npm, pnpm, yarn, bun)

## Environment variables

- `NUXI_INIT_REGISTRY`: Set to a custom template registry. ([learn more](https://github.com/unjs/giget#custom-registry)).
  - Default registry is loaded from [nuxt/starter/templates](https://github.com/nuxt/starter/tree/templates/templates)
