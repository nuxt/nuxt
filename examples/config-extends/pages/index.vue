<script setup>
const themeConfig = useRuntimeConfig().theme
const foo = useFoo()
const bar = getBar()
</script>

<template>
  <NuxtExampleLayout show-tips example="config-extends">
    theme runtimeConfig
    <pre>{{ JSON.stringify(themeConfig, null, 2) }}</pre>
    <BaseButton>Base Button</BaseButton>
    <FancyButton>Fancy Button</FancyButton>
    <UIButton>UI Button</UIButton>
    <br>
    {{ foo }} {{ bar }}
    <br>
    {{ $myPlugin() }}
    <template #tips>
      <p>
        This example shows how to use the <code>extends</code> key in <code>nuxt.config.ts</code> to use the <code>base/</code> directory as a base Nuxt application, and use its components, composable or config and override them if necessary.
      </p>
    </template>
  </NuxtExampleLayout>
</template>

<style scoped>
pre {
  text-align: left;
}
</style>
