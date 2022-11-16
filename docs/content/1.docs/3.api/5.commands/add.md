---
title: "nuxi add"
description: "Scaffold an entity into your Nuxt application."
---

# `nuxi add`

```{bash}
npx nuxi add [--cwd] [--force] <TEMPLATE> <NAME>
```

Option        | Default          | Description
-------------------------|-----------------|------------------
`TEMPLATE` | - | Specify a template of the file to be generated.
`NAME` | - | Specify a name of the file that will be created.
`--cwd` | `.` | The directory of the target application.
`--force` | `false` | Force override file if it already exists.

**Modifiers:**

Some templates support additional modifer flags to add a suffix (like `.client` or `.get`) to their name.

**Example:** `npx nuxi add plugin sockets --client` generates `/plugins/sockets.client.ts`.

## `nuxi add component`

* Modifier flags: `--mode client|server` or `--client` or `--server`

Example:

```bash
# Generates `components/TheHeader.vue`
npx nuxi add component TheHeader
```

## `nuxi add composable`

Example:

```bash
# Generates `composables/foo.ts`
npx nuxi add composable foo
```

## `nuxi add layout`

Example:

```bash
# Generates `layouts/custom.vue`
npx nuxi add layout custom
```

## `nuxi add plugin`

* Modifier flags: `--mode client|server` or `--client`or `--server`

Example:

```bash
# Generates `plugins/analytics.ts`
npx nuxi add plugin analytics
```

## `nuxi add page`

Example:

```bash
# Generates `pages/about.vue`
npx nuxi add page about
```

```bash
# Generates `pages/category/[id].vue`
npx nuxi add page "category/[id]"
```

## `nuxi add middleware`

* Modifier flags: `--global`

Example:

```bash
# Generates `middleware/auth.ts`
npx nuxi add middleware auth
```

## `nuxi add api`

* Modifier flags: `--method` (can accept `connect`, `delete`, `get`, `head`, `options`, `patch`, `post`, `put` or `trace`) or alternatively you can directly use `--get`, `--post`, etc.

Example:

```bash
# Generates `server/api/hello.ts`
npx nuxi add api hello
```
