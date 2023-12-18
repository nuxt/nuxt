---
title: "nuxi module"
description: "Module utilities for your Nuxt application"
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/cli/blob/main/src/commands/module/add.ts
    size: xs
---

Nuxi provides a few utilities to work with [Nuxt modules](/modules) seamlessly.

## nuxi module add

```bash [Terminal]
npx nuxi module add <NAME>
```

Option        | Default          | Description
-------------------------|-----------------|------------------
`NAME` | - | The name of the module to install.

The command lets you install [Nuxt modules](/modules) to your application with no manual work.

When running the command, it will:
- install the module as dependency using your package manager
- add it to your [package.json](/docs/guide/directory-structure/package)
- update your [`nuxt.config`](/docs/guide/directory-structure/nuxt-config) file with each module you add.

**Example:**

Installing the [`Pinia`](/modules/pinia) module
```bash [Terminal]
npx nuxi module add pinia 
```

## nuxi module search

```bash [Terminal]
npx nuxi module search <QUERY>
```

Option        | Default          | Description
-------------------------|-----------------|------------------
`QUERY` | - | The name of the module to search for.

The command searchs for Nuxt modules matching your query, compatible with your current Nuxt version installed.

**Example:**

```base [Terminal]
npx nuxi module search pinia
```
