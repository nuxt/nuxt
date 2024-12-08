---
title: "nuxi analyze"
description: "Analyze the production bundle or your Nuxt application."
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/cli/blob/main/src/commands/analyze.ts
    size: xs
---

```bash [Terminal]
npx nuxi analyze [OPTIONS] [ROOTDIR]
```

The `analyze` command builds Nuxt and analyzes the production bundle (experimental).

## Arguments

Argument | Default | Description
--- | --- | ---
`ROOTDIR="."` | `.` | (DEPRECATED) Use `--cwd` instead. Specifies the working directory, defaults to current directory (".")

## Options

Option | Default | Description
--- | --- | ---
`--cwd=<directory>` |  | Specify the working directory, falls back to ROOTDIR if unset (defaults to current directory (".") after ROOTDIR argument removal)
`--logLevel=<silent\|info\|verbose>` |  | Specify build-time log level
`--dotenv` |  | Path to `.env` file to load, relative to the root directory
`--name=<name>` | `default` | Name of the analysis
`--no-serve` |  | Skip serving the analysis results

::note
This command sets `process.env.NODE_ENV` to `production`.
::
