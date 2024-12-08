---
title: "nuxi add"
description: "Scaffold an entity into your Nuxt application."
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/cli/blob/main/src/commands/add.ts
    size: xs
---

<!--add-cmd-->
```bash [Terminal]
npx nuxi add <TEMPLATE> <NAME> [--cwd=<directory>] [--logLevel=<silent|info|verbose>] [--force]
```
<!--/add-cmd-->

### Arguments

<!--add-args-->
Argument | Description
--- | ---
`TEMPLATE` | Specify which template to generate (options: <api\|plugin\|component\|composable\|middleware\|layout\|page>)
`NAME` | Specify name of the generated file
<!--/add-args-->

### Options

<!--add-opts-->
Option | Default | Description
--- | --- | ---
`--cwd=<directory>` | `.` | Specify the working directory
`--logLevel=<silent\|info\|verbose>` |  | Specify build-time log level
`--force` | `false` | Force override file if it already exists
<!--/add-opts-->

**Modifiers:**

Some templates support additional modifier flags to add a suffix (like `.client` or `.get`) to their name.

```bash [Terminal]
# Generates `/plugins/sockets.client.ts`
npx nuxi add plugin sockets --client
```

## `nuxi add component`

* Modifier flags: `--mode client|server` or `--client` or `--server`

```bash [Terminal]
# Generates `components/TheHeader.vue`
npx nuxi add component TheHeader
```

## `nuxi add composable`

```bash [Terminal]
# Generates `composables/foo.ts`
npx nuxi add composable foo
```

## `nuxi add layout`

```bash [Terminal]
# Generates `layouts/custom.vue`
npx nuxi add layout custom
```

## `nuxi add plugin`

* Modifier flags: `--mode client|server` or `--client`or `--server`

```bash [Terminal]
# Generates `plugins/analytics.ts`
npx nuxi add plugin analytics
```

## `nuxi add page`

```bash [Terminal]
# Generates `pages/about.vue`
npx nuxi add page about
```

```bash [Terminal]
# Generates `pages/category/[id].vue`
npx nuxi add page "category/[id]"
```

## `nuxi add middleware`

* Modifier flags: `--global`

```bash [Terminal]
# Generates `middleware/auth.ts`
npx nuxi add middleware auth
```

## `nuxi add api`

* Modifier flags: `--method` (can accept `connect`, `delete`, `get`, `head`, `options`, `patch`, `post`, `put` or `trace`) or alternatively you can directly use `--get`, `--post`, etc.

```bash [Terminal]
# Generates `server/api/hello.ts`
npx nuxi add api hello
```
