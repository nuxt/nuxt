---
title: 'nuxt dev'
description: The dev command starts a development server with hot module replacement at http://localhost:3000
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/cli/blob/main/packages/nuxi/src/commands/dev.ts
    size: xs
---

<!--dev-cmd-->
```bash [Terminal]
npx nuxt dev [ROOTDIR] [--cwd=<directory>] [--logLevel=<silent|info|verbose>] [--dotenv] [--envName] [--no-clear] [--no-fork] [-p, --port] [-h, --host] [--clipboard] [-o, --open] [--https] [--publicURL] [--qr] [--public] [--tunnel] [--sslCert] [--sslKey]
```
<!--/dev-cmd-->

The `dev` command starts a development server with hot module replacement at [http://localhost:3000](https://localhost:3000)

## Arguments

<!--dev-args-->
Argument | Description
--- | ---
`ROOTDIR="."` | Specifies the working directory (default: `.`)
<!--/dev-args-->

## Options

<!--dev-opts-->
Option | Default | Description
--- | --- | ---
`--cwd=<directory>` |  | Specify the working directory, this takes precedence over ROOTDIR (default: `.`)
`--logLevel=<silent\|info\|verbose>` |  | Specify build-time log level
`--dotenv` |  | Path to `.env` file to load, relative to the root directory
`--envName` |  | The environment to use when resolving configuration overrides (default is `production` when building, and `development` when running the dev server)
`--no-clear` |  | Disable clear console on restart
`--no-fork` |  | Disable forked mode
`-p, --port` |  | Port to listen on (default: `NUXT_PORT \|\| NITRO_PORT \|\| PORT \|\| nuxtOptions.devServer.port`)
`-h, --host` |  | Host to listen on (default: `NUXT_HOST \|\| NITRO_HOST \|\| HOST \|\| nuxtOptions._layers?.[0]?.devServer?.host`)
`--clipboard` | `false` | Copy the URL to the clipboard
`-o, --open` | `false` | Open the URL in the browser
`--https` |  | Enable HTTPS
`--publicURL` |  | Displayed public URL (used for QR code)
`--qr` |  | Display The QR code of public URL when available
`--public` |  | Listen to all network interfaces
`--tunnel` |  | Open a tunnel using https://github.com/unjs/untun
`--sslCert` |  | (DEPRECATED) Use `--https.cert` instead.
`--sslKey` |  | (DEPRECATED) Use `--https.key` instead.
<!--/dev-opts-->

The port and host can also be set via NUXT_PORT, PORT, NUXT_HOST or HOST environment variables.

Additionally to the above options, `@nuxt/cli` can pass options through to `listhen`, e.g. `--no-qr` to turn off the dev server QR code. You can find the list of `listhen` options in the [unjs/listhen](https://github.com/unjs/listhen) docs.

This command sets `process.env.NODE_ENV` to `development`.

::note
If you are using a self-signed certificate in development, you will need to set `NODE_TLS_REJECT_UNAUTHORIZED=0` in your environment.
::
