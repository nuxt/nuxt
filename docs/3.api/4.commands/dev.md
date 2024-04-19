---
title: 'nuxi dev'
description: The dev command starts a development server with hot module replacement at http://localhost:3000
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/cli/blob/main/src/commands/dev.ts
    size: xs
---

```bash [Terminal]
npx nuxi dev [rootDir] [--dotenv] [--log-level] [--clipboard] [--open, -o] [--no-clear] [--port, -p] [--host, -h] [--https] [--ssl-cert] [--ssl-key] [--tunnel]
```

The `dev` command starts a development server with hot module replacement at [http://localhost:3000](https://localhost:3000)

Option        | Default          | Description
-------------------------|-----------------|------------------
`rootDir` | `.` | The root directory of the application to serve.
`--dotenv` | `.` | Point to another `.env` file to load, **relative** to the root directory.
`--open, -o` | `false` | Open URL in browser.
`--clipboard` | `false` | Copy URL to clipboard.
`--no-clear` | `false` | Does not clear the console after startup.
`--port, -p` | `3000` | Port to listen.
`--host, -h` | `localhost` | Hostname of the server.
`--https` | `false` | Listen with `https` protocol with a self-signed certificate by default.
`--ssl-cert` |`null` | Specify a certificate for https.
`--ssl-key` |`null` | Specify the key for the https certificate.
`--tunnel` | `false` | Tunnel your local server to the internet with [unjs/untun](https://github.com/unjs/untun)

The port and host can also be set via NUXT_PORT, PORT, NUXT_HOST or HOST environment variables.

Additionally to the above options, `nuxi` can pass options through to `listhen`, e.g. `--no-qr` to turn off the dev server QR code. You can find the list of `listhen` options in the [unjs/listhen](https://github.com/unjs/listhen) docs.

This command sets `process.env.NODE_ENV` to `development`.

::note
If you are using a self-signed certificate in development, you will need to set `NODE_TLS_REJECT_UNAUTHORIZED=0` in your environment.
::
