# Lambda function

 - Compatible with common lambda formats (AWS, Netlify and others)

### Entrypoint

With `{ preset: 'lambda' }` the result will be an entrypoint that exports a handler function that responds to an event and returns a response. This preset is compatible with [AWS Lambda](https://docs.aws.amazon.com/lex/latest/dg/lambda-input-response-format.html) and [Netlify Functions](https://docs.netlify.com/functions/build-with-javascript).

It can be used programmatically or as part of a deploy.

```ts
import { handler } from './.output/server'

// Use programmatically
const { statusCode, headers, body } = handler({ path: '/' })
```
