---
title: useGoogleTagManager
description: useGoogleTagManager allows you to install Google Tag Manager in your Nuxt app.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/scripts-and-assets/blob/main/modules/nuxt-third-party-capital/src/runtime/composables/googleTagManager.ts
    size: xs
---

The `useGoogleTagManager` composable allows you to install [Google Tag Manager](https://developers.google.com/tag-platform/tag-manager/web) in your Nuxt application.

## Minimal Example

```vue
<script setup>
useGoogleTagManager({ id: 'GTM-123456' })
</script>
```

## Example with Custom Event

```vue
<script setup>
const { $script } = useGoogleTagManager({
  id: 'GTM-123456'
})

$script.waitForLoad().then(({ dataLayer }) => {
  dataLayer.push({
    event: 'pageview',
    page_path: '/google-tag-manager'
  })
})
</script>
```

## Type

```ts
useGoogleTagManager(options: ThirdPartyScriptOptions<GoogleTagManagerOptions, GoogleTagManagerApi>): ThirdPartyScriptApi<GoogleTagManagerApi>
```

## Params

An object containing the following options:

- `id`: Your GTM container ID. Usually starts with 'GTM-'.
  - **type**: `string`
  - **required**

## Return Values

An object that contains a special `$script` property that gives you access to the underlying script instance.

- `$script.waitForLoad`: A promise that resolves when the script is ready to use. It exposes `google_tag_manager` and `dataLayer`, which lets you interact with the API.

::callout
Learn more about [`useScript`](https://unhead.unjs.io/usage/composables/use-script).
::
