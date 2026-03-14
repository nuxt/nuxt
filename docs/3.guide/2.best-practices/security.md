---
navigation.title: 'Content Security Policy'
title: Content Security Policy
description: Content Security Policy (CSP) helps prevent unwanted content from being injected/loaded into your webpages. This can mitigate cross-site scripting (XSS) vulnerabilities, clickjacking, formjacking, malicious frames, unwanted trackers, and other web client-side attacks.
---

Content Security Policy (CSP) helps prevent unwanted content from being injected/loaded into your webpages. This can mitigate cross-site scripting (XSS) vulnerabilities, clickjacking, formjacking, malicious frames, unwanted trackers, and other web client-side attacks.

:read-more{title="Content Security Policy Header" to="https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP"}

## Usage

This header is enabled by default but you can change its behavior like following.

```ts
export default defineNuxtConfig({
  csp: {
    value: {
      // See interface below
    },
    reportOnly: false,
    nonce: true,
    sri: true,
    ssg: {
      meta: true,
      hashScripts: true,
      hashStyles: false,
    },
  },
})
```

You can also disable this header by setting `csp: { value: false }`.

## Default value

By default, Nuxt will set the following value for this header:

```http
Content-Security-Policy: base-uri 'none'; font-src 'self' https: data:; form-action 'self'; img-src 'self' data:; object-src 'none'; script-src-attr 'none'; style-src 'self' https: 'unsafe-inline'; script-src 'self' https: 'unsafe-inline' 'strict-dynamic' 'nonce-{{nonce}}'; upgrade-insecure-requests;
```

## Available values

The `Content-Security-Policy` header can be configured with following values.

```ts
type CSPValue = {
  'child-src'?: CSPSourceValue[] | false
  'connect-src'?: CSPSourceValue[] | false
  'default-src'?: CSPSourceValue[] | false
  'font-src'?: CSPSourceValue[] | false
  'frame-src'?: CSPSourceValue[] | false
  'img-src'?: CSPSourceValue[] | false
  'manifest-src'?: CSPSourceValue[] | false
  'media-src'?: CSPSourceValue[] | false
  'object-src'?: CSPSourceValue[] | false
  'prefetch-src'?: CSPSourceValue[] | false
  'script-src'?: CSPSourceValue[] | false
  'script-src-elem'?: CSPSourceValue[] | false
  'script-src-attr'?: CSPSourceValue[] | false
  'style-src'?: CSPSourceValue[] | false
  'style-src-elem'?: CSPSourceValue[] | false
  'style-src-attr'?: CSPSourceValue[] | false
  'worker-src'?: CSPSourceValue[] | false
  'base-uri'?: CSPSourceValue[] | false
  'sandbox'?: CSPSandboxValue[] | false
  'form-action'?: CSPSourceValue[] | false
  'frame-ancestors'?: ('\'self\'' | '\'none\'' | string)[] | false
  'report-uri'?: string[] | false
  'report-to'?: string | false
  'require-trusted-types-for'?: string | false
  'trusted-types'?: string[] | string | false
  'upgrade-insecure-requests'?: boolean
}

type CSPSourceValue =
  | '\'self\''
  | '\'unsafe-eval\''
  | '\'wasm-unsafe-eval\''
  | '\'unsafe-hashes\''
  | '\'unsafe-inline\''
  | '\'none\''
  | '\'strict-dynamic\''
  | '\'report-sample\''
  | '\'nonce=<base64-value>\''
  | string

type CSPSandboxValue =
  | 'allow-downloads'
  | 'allow-downloads-without-user-activation'
  | 'allow-forms'
  | 'allow-modals'
  | 'allow-orientation-lock'
  | 'allow-pointer-lock'
  | 'allow-popups'
  | 'allow-popups-to-escape-sandbox'
  | 'allow-presentation'
  | 'allow-same-origin'
  | 'allow-scripts'
  | 'allow-storage-access-by-user-activation'
  | 'allow-top-navigation'
  | 'allow-top-navigation-by-user-activation'
  | 'allow-top-navigation-to-custom-protocols'
```

## Strict CSP

Nuxt helps you increase the security of your site by enabling **Strict CSP** support for both SSR and SSG applications.

For further reading about Strict CSP and how to handle specific cases, please consult our [Adanced Section about Strict CSP](/advanced/strict-csp)

- For SSR applications, Nuxt implements strict CSP via nonces. A one-time cryptographically-generated random nonce is generated at runtime by the server for each request of a page.
- For SSG applications, Nuxt implements strict CSP via hashes. At static build-time, Nuxt computes the SHA hashes of the elements that are allowed to execute on your site.

By default, Strict CSP will be enabled on your site. The following default configuration options are used:

```ts
export default defineNuxtConfig({
  csp: {
    nonce: true, // Enables HTML nonce support in SSR mode
    ssg: {
      meta: true, // Enables CSP as a meta tag in SSG mode
      hashScripts: true, // Enables CSP hash support for scripts in SSG mode
      hashStyles: false, // Disables CSP hash support for styles in SSG mode (recommended)
    },
    value: {
      'script-src': [
        '\'self\'', // Fallback value, will be ignored by most modern browsers (level 3)
        'https:', // Fallback value, will be ignored by most modern browsers (level 3)
        '\'unsafe-inline\'', // Fallback value, will be ignored by almost any browser (level 2)
        '\'strict-dynamic\'', // Strict CSP via 'strict-dynamic', supported by most modern browsers (level 3)
        '\'nonce-{{nonce}}\'', // Enables CSP nonce support for scripts in SSR mode, supported by almost any browser (level 2)
      ],
      'style-src': [
        '\'self\'', // Enables loading of stylesheets hosted on same origin
        'https:', // For increased security, replace by the specific hosting domain or file name of your external stylesheets
        '\'unsafe-inline\'', // Recommended default for most Nuxt apps
      ],
      'base-uri': ['\'none\''],
      'img-src': ['\'self\'', 'data:'], // Add relevant https://... sources if you load images from external sources
      'font-src': ['\'self\'', 'https:', 'data:'], //  For increased security, replace by the specific sources for fonts
      'object-src': ['\'none\''],
      'script-src-attr': ['\'none\''],
      'upgrade-insecure-requests': true,
    },
    sri: true,
  },
})
```

## Server Side Rendering (SSR)

Nuxt provides first-class CSP support of SSR apps via 'strict-dynamic' and nonces.

In SSR mode, Strict CSP is enabled when you set the `nonce` option and the `"'nonce-{{nonce}}'"` placeholders:

```ts
export default defineNuxtConfig({
  csp: {
    nonce: true, // Enables HTML nonce support in SSR mode
    value: {
      'script-src': [
        '\'strict-dynamic\'', // Modify with your custom CSP sources
        '\'nonce-{{nonce}}\'', // Enables CSP nonce support for scripts in SSR mode, supported by almost any browser (level 2)
      ],
    },
  },
})
```

- `nonce`: Set this option to `true` to parse all `<script>`, `<link>` and `<style>` tags in your application and add the nonce value to these. The module parses all inline elements as well as all external resources.
- `"'nonce-{{nonce}}'"` placeholder: Include this value in any individual policy that you want to be governed by nonce.

_Note: Nonce only works for SSR. The `nonce` option and the `"'nonce-{{nonce}}'"` placeholders are ignored when you build your app for SSG via `nuxi generate`._

## Static Site Generation (SSG)

This module is meant to work with SSR apps, but you can also use this module in SSG apps where you will get a Content Security Policy (CSP) support via `<meta http-equiv>` tag.

This will result in following code being added to your static app `<head>` tag:

```html
<meta http-equiv="Content-Security-Policy" content="base-uri 'none'; font-src 'self' https: data:; form-action 'self'; img-src 'self' data:; object-src 'none'; script-src-attr 'none'; style-src 'self' https: 'unsafe-inline'; script-src 'self' https: 'unsafe-inline' 'strict-dynamic' 'sha256-{{hash}}'; upgrade-insecure-requests;">
```

:read-more{title="Content Security Policy Meta Tag" to="https://content-security-policy.com/examples/meta/"}

For SSG apps, Strict CSP is enabled when you set the `ssg` and `sri` options:

```ts
export default defineNuxtConfig({
  csp: {
    ssg: {
      meta: true, // Enables CSP as a meta tag in SSG mode
      hashScripts: true, // Enables CSP hash support for scripts in SSG mode
      hashStyles: false, // Disables CSP hash support for styles in SSG mode (recommended)
    },
    sri: true,
  },
})
```

Nuxt will generate script hashes and style hashes for you according to the `ssg` option:
- `hashScripts`: Set this option to `true` to parse all inline scripts as well as all external scripts. Nuxt will compute the hashes of inline scripts and find the `integrity` attributes of external scripts, and will add them to your `script-src` policy.
- `hashStyles`: Set this option to `true` to parse all inline styles as well as all external styles. Nuxt will compute the hashes of inline styles and find the `integrity` attributes of external styles, and will add them to your `style-src` policy.

Nuxt will automatically calculate the `integrity` attributes of all your bundled assets if you set the `sri` option to `true`. For unbundled assets, you may need to set the `integrity` attribute manually.

_Note: Hashes only work for SSG. The `ssg` options are ignored when you build your app for SSR via `nuxi build`._

## Including External Scripts

You can include any external script (Google Analytics, Stripe, Cloudflare Turnstile, etc.) in your application without compromising the Strict CSP protection offered by Nuxt.

- Since Nuxt 3.11, the easiest and universal way to include external scripts is via `useScript`
  
```ts
useScript('https://example.com/script.js')
```
  
Please see [useScript](https://unhead.unjs.io/docs/typescript/head/api/composables/use-script) for available options and usage.

- Before Nuxt 3.11, you can also include your external scripts via `useHead`
  
```ts
useHead({
  script: [
    {
      src: 'https://example.com/script.js',
    },
    {
      mode: 'client', // 'client' option is required in SSG mode
    },
  ],
})
```

- In all cases, you can also include external scripts directly in the HTML source
  
```html
<script src="https://example.com/script.js" integrity="sha384-....." crossorigin="anonymous" />
```

When inserting scripts directly in HTML, you will need to provide an integrity hash if you are using SSG mode.
Many standard scripts (e.g. Google Analytics) do not provide an integrity hash, therefore this method is not compatible with SSG.
