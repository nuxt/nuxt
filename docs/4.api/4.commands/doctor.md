---
title: "nuxt doctor"
description: The doctor command runs diagnostic checks on your Nuxt project.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/cli/blob/main/packages/nuxi/src/commands/doctor.ts
    size: xs
---

```bash [Terminal]
npx nuxt doctor [ROOTDIR] [--cwd=<directory>] [--verbose] [--json]
```

The `doctor` command runs diagnostic checks on your Nuxt project and reports issues. Built-in checks verify Node.js version, configuration, and module compatibility. Modules can contribute additional checks via the `doctor:check` hook.

## Arguments

| Argument      | Description                                    |
|---------------|------------------------------------------------|
| `ROOTDIR="."` | Specifies the working directory (default: `.`) |

## Options

| Option              | Default | Description                                                                      |
|---------------------|---------|----------------------------------------------------------------------------------|
| `--cwd=<directory>` |         | Specify the working directory, this takes precedence over ROOTDIR (default: `.`) |
| `--verbose, -v`     | `false` | Show additional details, suggestions, and documentation links                    |
| `--json`            | `false` | Output results as JSON for programmatic consumption                              |

## Built-in Checks

The doctor command includes three built-in checks:

- **Versions** - Verifies Node.js version meets requirements (18+) and displays runtime info
- **Config** - Detects deprecated options (`target`, `mode`) and missing `compatibilityDate`
- **Modules** - Lists installed modules and checks version compatibility with Nuxt

## Module Integration

Modules can contribute diagnostic checks using the `doctor:check` hook:

```ts [modules/my-module.ts]
export default defineNuxtModule({
  setup (options, nuxt) {
    nuxt.hook('doctor:check', (ctx) => {
      if (!options.apiKey) {
        ctx.addCheck({
          id: 'MISSING_API_KEY',
          name: 'MyModule',
          status: 'error',
          message: 'API key not configured',
          source: 'my-module',
          suggestion: 'Add myModule.apiKey to nuxt.config.ts',
          url: 'https://my-module.dev/configuration',
        })
      } else {
        ctx.addCheck({
          name: 'MyModule',
          status: 'success',
          message: 'configured',
          source: 'my-module',
        })
      }
    })
  },
})
```

## DoctorCheck Interface

```ts
interface DoctorCheck {
  // Required
  name: string // Check name (display)
  status: 'success' | 'warning' | 'error'
  message: string // Short summary

  // Optional - identity
  id?: string // Programmatic code: "MISSING_PEER_DEP"
  source?: string // Module name: "@nuxt/ui"

  // Optional - verbose fields (shown with --verbose)
  details?: string | string[] // Extra context
  suggestion?: string // How to fix
  url?: string // Documentation link

  // Optional - programmatic
  data?: Record<string, unknown> // Arbitrary metadata
}
```

## Examples

Run diagnostics on your project:

```bash [Terminal]
npx nuxt doctor
```

Show verbose output with suggestions and links:

```bash [Terminal]
npx nuxt doctor --verbose
```

Output JSON for CI or scripting:

```bash [Terminal]
npx nuxt doctor --json
```

Filter errors in JSON output:

```bash [Terminal]
npx nuxt doctor --json | jq '.[] | select(.status == "error")'
```
