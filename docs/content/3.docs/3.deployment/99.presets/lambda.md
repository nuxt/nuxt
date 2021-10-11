# Lambda function

Discover the Lambda function preset with Nitro to deploy Nuxt to any lambda-compatible serverless platform.

::alert{icon=IconPresets}
Back to [presets list](/docs/deployment/presets).
::

## Usage

You can use the [Nuxt config](/docs/directory-structure/nuxt.config) to explicity set the preset to use:

```ts [nuxt.config.js|ts]
export default {
  nitro: {
    preset: 'lambda'
  }
}
```

Or directly use the `NITRO_PRESET` environment variable when running `nuxt build`:

```bash
NITRO_PRESET=lambda npx nuxt build
```

### Entrypoint

When running `nuxt build` with the Lambda preset, the result will be an entrypoint that exports a handler function that responds to an event and returns a response.

This entrypoint is compatible with [AWS Lambda](https://docs.aws.amazon.com/lex/latest/dg/lambda-input-response-format.html) and [Netlify Functions](https://docs.netlify.com/functions/build-with-javascript).

It can be used programmatically or as part of a deploy.

```ts
import { handler } from './.output/server'

// Use programmatically
const { statusCode, headers, body } = handler({ path: '/' })
```
