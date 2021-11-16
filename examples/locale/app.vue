<script setup>
const locales = useLocales()
const locale = useLocale()
const date = useLocaleDate(new Date('2016-10-26') /* NUXT_BIRTHDAY */)
</script>

<template>
  <div>
    <h2>Nuxt birthday: {{ date }}</h2>
    <label for="locale-chooser">Locale: </label>
    <select id="locale-chooser" v-model="locale">
      <option v-for="l of locales" :key="l" :value="l">
        {{ l }}
      </option>
    </select>
  </div>
</template>
