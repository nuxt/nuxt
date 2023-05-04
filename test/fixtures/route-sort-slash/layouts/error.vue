<template>
  <div>
    <h3 v-if="error?.statusCode === 404">
      {{ $t("notfound") }}
    </h3>
    <h3 v-else>
      {{ $t("generalerror") }}
    </h3>
    <br>
    <NuxtLink to="/" style="text-decoration: underline">
      {{
        $t("backtohomepage")
      }}
    </NuxtLink>
  </div>
</template>

<script>
export default {
  name: 'NotFound',
  props: ['error'],
  head () {
    return {
      title: 'Page does not exist'
    }
  }
}
</script>

<i18n>
{
  "en": {
    "notfound": "The page was not found",
    "generalerror": "An error occurred",
    "backtohomepage": "Here back to Homepage"
  },
  "de": {
    "notfound": "Die Seite wurde nicht gefunden",
    "generalerror": "Ein Fehler ist aufgetreten",
    "backtohomepage": "Hier zurück zur Homepage"
  }
}
</i18n>
