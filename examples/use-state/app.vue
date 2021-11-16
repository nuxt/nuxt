<script setup>
const locale = useLocale()
const locales = [
  'en-US',
  'en-GB',
  'ko-KR',
  'ar-EG',
  'fa-IR',
  'ja-JP-u-ca-japanese'
]
if (!locales.includes(locale.value)) {
  locales.unshift(locale.value)
}

// Using Intl.DateTimeFormat for language-sensitive date and time formatting
// Learn more: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat
const NUXT_BIRTHDAY = new Date('2016-10-26')
const date = computed(() => new Intl.DateTimeFormat(locale.value).format(NUXT_BIRTHDAY))
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
