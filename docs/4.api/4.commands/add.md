---
title: "nuxt add"
description: "Scaffold an entity into your Nuxt application."
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/cli/blob/main/packages/nuxi/src/commands/add.ts
    size: xs
---

<!--add-cmd-->
```bash [Terminal]
npx nuxt add <TEMPLATE> <NAME> [--cwd=<directory>] [--logLevel=<silent|info|verbose>] [--force]
```
<!--/add-cmd-->

### Arguments

<!--add-args-->
Argument | Description
--- | ---
`TEMPLATE` | Specify which template to generate (options: <api\|app\|app-config\|component\|composable\|error\|layer\|layout\|middleware\|module\|page\|plugin\|server-middleware\|server-plugin\|server-route\|server-util>)
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
npx nuxt add plugin sockets --client
```

## `nuxt add component`

* Modifier flags: `--mode client|server` or `--client` or `--server`

```bash [Terminal]
# Generates `app/components/TheHeader.vue`
npx nuxt add component TheHeader
```

## `nuxt add composable`

```bash [Terminal]
# Generates `app/composables/foo.ts`
npx nuxt add composable foo
```

## `nuxt add layout`

```bash [Terminal]
# Generates `app/layouts/custom.vue`
npx nuxt add layout custom
```

## `nuxt add plugin`

* Modifier flags: `--mode client|server` or `--client`or `--server`

```bash [Terminal]
# Generates `app/plugins/analytics.ts`
npx nuxt add plugin analytics
```

## `nuxt add page`

```bash [Terminal]
# Generates `app/pages/about.vue`
npx nuxt add page about
```

```bash [Terminal]
# Generates `app/pages/category/[id].vue`
npx nuxt add page "category/[id]"
```

## `nuxt add middleware`

* Modifier flags: `--global`

```bash [Terminal]
# Generates `app/middleware/auth.ts`
npx nuxt add middleware auth
```

## `nuxt add api`

* Modifier flags: `--method` (can accept `connect`, `delete`, `get`, `head`, `options`, `patch`, `post`, `put` or `trace`) or alternatively you can directly use `--get`, `--post`, etc.

```bash [Terminal]
# Generates `server/api/hello.ts`
npx nuxt add api hello
```

## `nuxt add layer`

```bash [Terminal]
# Generates `layers/subscribe/nuxt.config.ts`
npx nuxt add layer subscribe
```
