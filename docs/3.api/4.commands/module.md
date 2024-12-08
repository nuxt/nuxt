---
title: "nuxi module"
description: "Search and add modules to your Nuxt application with the command line."
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/cli/blob/main/src/commands/module/
    size: xs
---

Nuxi provides a few utilities to work with [Nuxt modules](/modules) seamlessly.

## nuxi module add

```bash [Terminal]
npx nuxi module add [OPTIONS] <MODULENAME>
```

## Arguments

Argument | Default | Description
--- | --- | ---
`MODULENAME` |  | Module name

## Options

Option | Default | Description
--- | --- | ---
`--cwd=<directory>` | `.` | Specify the working directory, defaults to current directory (".")
`--logLevel=<silent\|info\|verbose>` |  | Specify build-time log level
`--skipInstall` |  | Skip npm install
`--skipConfig` |  | Skip nuxt.config.ts update

The command lets you install [Nuxt modules](/modules) in your application with no manual work.

When running the command, it will:
- install the module as a dependency using your package manager
- add it to your [package.json](/docs/guide/directory-structure/package) file
- update your [`nuxt.config`](/docs/guide/directory-structure/nuxt-config) file

**Example:**

Installing the [`Pinia`](/modules/pinia) module
```bash [Terminal]
npx nuxi module add pinia 
```

## nuxi module search

```bash [Terminal]
npx nuxi module search [OPTIONS] <QUERY>
```

## Arguments

Argument | Default | Description
--- | --- | ---
`QUERY` |  | keywords to search for

## Options

Option | Default | Description
--- | --- | ---
`--cwd=<directory>` | `.` | Specify the working directory, defaults to current directory (".")
`--logLevel=<silent\|info\|verbose>` |  | Specify build-time log level
`--nuxtVersion=<2\|3>` |  | Filter by Nuxt version and list compatible modules only (auto detected by default)

The command searches for Nuxt modules matching your query that are compatible with your Nuxt version.

**Example:**

```bash [Terminal]
npx nuxi module search pinia
```
