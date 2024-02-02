---
title: useGoogleAnalytics
description: useGoogleAnalytics allows you to load and initialize Google Analytics in your Nuxt app.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/scripts-and-assets/blob/main/modules/nuxt-third-party-capital/src/runtime/composables/googleAnalytics.ts
    size: xs
---

The useGoogleAnalytics composable function allows you to include [Google Analytics 4](https://developers.google.com/analytics/devguides/collection/ga4) in your Nuxt application.

::callout
If Google Tag Manager is already included in your application, you can configure Google Analytics directly using it, rather than including Google Analytics as a separate component. Refer to the [documentation](https://developers.google.com/analytics/devguides/collection/ga4/tag-options#what-is-gtm) to learn more about the differences between Tag Manager and gtag.js.
::

## Type

```ts
useGoogleAnalytics(options: ThirdPartyScriptOptions<GoogleAnalyticsOptions, GoogleAnalyticsApi>): ThirdPartyScriptApi<GoogleAnalyticsApi>
```

## Params

An object containing the following options:

| name | type   | description                     |
|:-----|:-------|:--------------------------------|
| id   | string | Google Analytics [measurement ID](https://support.google.com/analytics/answer/12270356). (required) |

## Return values

An object that contains a special `$script` property that gives you access to the underlying script instance.

- `$script.waitForLoad`: A promise that resolves when the script is ready to use. It exposes `gtag` and `dataLayer`, which lets you interact with the API.

::callout
Learn more about [useScript](https://unhead.unjs.io/usage/composables/use-script).
::

## Minimal example

```vue
<script setup>
useGoogleAnalytics({ id: 'GA-123456789-1' })
</script>
```

## Example with custom event

```vue
<script setup>
const { $script } = useGoogleAnalytics({
  id: 'GA-123456789-1',
})

$script.waitForLoad().then(({ gtag }) => {
  gtag('event', 'some_custom_event', { time: new Date() })
})
</script>
```
