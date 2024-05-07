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
npx nuxi init [--verbose|-v] [--template,-t] [dir]
```

The `init` command initializes a fresh Nuxt project using [unjs/giget](https://github.com/unjs/giget).

## Options

Option        | Default          | Description
-------------------------|-----------------|------------------
`--cwd` | | Current working directory
`--log-level` | | Log level
`--template, -t` | `v3` | Specify template name or git repository to use as a template. Format is `gh:org/name` to use a custom github template.
`--force, -f` | `false` | Force clone to any existing directory.
`--offline` | `false` | Force offline mode (do not attempt to download template from GitHub and only use local cache).
`--prefer-offline` | `false` | Prefer offline mode (try local cache first to download templates).
`--no-install` | `false` | Skip installing dependencies.
`--git-init` | `false` | Initialize git repository.
`--shell` | `false` | Start shell after installation in project directory (experimental).
`--package-manager` | `npm` | Package manager choice (npm, pnpm, yarn, bun).
`--dir` | | Project directory.

## Environment variables

- `NUXI_INIT_REGISTRY`: Set to a custom template registry. ([learn more](https://github.com/unjs/giget#custom-registry)).
  - Default registry is loaded from [nuxt/starter/templates](https://github.com/nuxt/starter/tree/templates/templates)
