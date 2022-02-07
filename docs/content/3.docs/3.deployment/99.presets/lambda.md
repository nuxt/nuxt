# Lambda function

Discover the Lambda function preset with Nitro to deploy Nuxt to any lambda-compatible serverless platform.

::alert{icon=IconPresets}
Back to [presets list](/docs/deployment/presets).
::

## Usage

You can use the [Nuxt config](/docs/directory-structure/nuxt.config) to explicitly set the preset to use:

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

::alert
AWS Lambda [defaults to payload version v2](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html). This Nitro preset supports both v1 and v2 payloads.
::

### Entrypoint

When running `nuxt build` with the Lambda preset, the result will be an entry point that exports a handler function that responds to an event and returns a response.

This entry point is compatible with [AWS Lambda](https://docs.aws.amazon.com/lex/latest/dg/lambda-input-response-format.html) and [Netlify Functions](https://docs.netlify.com/functions/build-with-javascript).

It can be used programmatically or as part of a deployment.

```ts
import { handler } from './.output/server'

// Use programmatically
const { statusCode, headers, body } = handler({ rawPath: '/' })
```
