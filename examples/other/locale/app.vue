<script setup lang="ts">
// see ../compoables/locale.ts for the implementation
const locales = useLocales()
const locale = useLocale()
const date = useLocaleDate(new Date('2016-10-26') /* NUXT_BIRTHDAY */)
</script>

<template>
  <NuxtExampleLayout example="locale">
    <h1 class="text-xl opacity-50">
      Nuxt birthday
    </h1>
    <p class="text-4xl">
      {{ date }}
    </p>
    <div class="mt-4" />
    <label for="locale-chooser">Preview a different locale</label>
    <select id="locale-chooser" v-model="locale" class="m-auto w-50 border n-border-base rounded p-1">
      <option v-for="l of locales" :key="l" :value="l">
        {{ l }}
      </option>
    </select>
  </NuxtExampleLayout>
</template>
