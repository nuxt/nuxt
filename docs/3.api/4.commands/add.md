---
title: "nuxi add"
description: "Scaffold an entity into your Nuxt application."
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/cli/blob/main/src/commands/add.ts
    size: xs
---

```bash [Terminal]
npx nuxi add [--cwd] [--force] <TEMPLATE> <NAME>
```

Option        | Default          | Description
-------------------------|-----------------|------------------
`TEMPLATE` | - | Specify a template of the file to be generated.
`NAME` | - | Specify a name of the file that will be created.
`--cwd` | `.` | The directory of the target application.
`--force` | `false` | Force override file if it already exists.

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
