<template>
  <div>
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
