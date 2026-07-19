<template>
  <div>
    <img
      src="~/assets/logo.svg"
      class="h-20 mb-4"
    >
    <img
      src="/public.svg"
      class="h-20 mb-4"
    >
    <img
      :src="logo"
      class="h-20 mb-4"
    >
    <img
      data-testid="dynamic-import-asset"
      :src="dynamicAsset"
      class="h-20 mb-4"
    >
    <img
      data-testid="lazy-glob-asset"
      :src="lazyGlobAsset"
      class="h-20 mb-4"
    >
    <img
      data-testid="eager-glob-asset"
      :src="eagerGlobAsset"
      class="h-20 mb-4"
    >
  </div>
</template>

<script setup>
import logo from '~/assets/logo.svg'

const route = useRoute()
const dynamicAssetName = route.query.asset === 'two' ? 'two' : 'one'
const dynamicAssetPath = `../assets/dynamic/${dynamicAssetName}.svg`
const dynamicAsset = (await import(`../assets/dynamic/${dynamicAssetName}.svg?url&no-inline`)).default

const lazyAssets = import.meta.glob('../assets/dynamic/*.svg', {
  query: '?url&no-inline',
  import: 'default',
})
const eagerAssets = import.meta.glob('../assets/dynamic/*.svg', {
  query: '?url&no-inline',
  import: 'default',
  eager: true,
})

const loadLazyAsset = lazyAssets[dynamicAssetPath]
const eagerGlobAsset = eagerAssets[dynamicAssetPath]

if (!loadLazyAsset || !eagerGlobAsset) {
  throw new Error(`Unknown asset: ${dynamicAssetName}`)
}

const lazyGlobAsset = await loadLazyAsset()
</script>

<style>
#__nuxt {
  background-image: url('~/assets/logo.svg');
  background-repeat: no-repeat;
  background-position: bottom right;
}
body {
  background-image: url('/public.svg');
  background-repeat: no-repeat;
  background-position: top;
}
@font-face {
  src: url('/public.svg') format('woff2');
}
</style>
