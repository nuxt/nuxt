<script setup>
const themeConfig = useRuntimeConfig().theme
const foo = useFoo()
const bar = getBar()
</script>

<template>
  <NuxtExampleLayout example="advanced/config-extends">
    theme runtimeConfig
    <pre>{{ JSON.stringify(themeConfig, null, 2) }}</pre>
    <BaseButton>Base Button</BaseButton>
    <FancyButton>Fancy Button</FancyButton>
    <UIButton>UI Button</UIButton>
    <br>
    {{ foo }} {{ bar }}
    <br>
    {{ $myPlugin() }}
  </NuxtExampleLayout>
</template>

<style scoped>
pre {
  text-align: left;
}
</style>
