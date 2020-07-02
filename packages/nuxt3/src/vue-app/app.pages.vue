<template>
  Has pages/ ? <nuxt-page />
  Please create `pages/index.vue` or `app.vue`
</template>

<template>
  <div>
    <nav>My navbar</nav>
    <nuxt-page />
  </div>
</template>

<script>
/*
  my-project/app.vue -> no router needed

  vs

  my-project/pages/index.vue -> router needed and app.vue display

  vue-app/dotnuxt/app.vue

  Resolving App:
    1. ~/app.vue (variable)
    2. (if pages/) nuxt-app/app.pages.vue (Light with router)
    3. nuxt-app/app.tutorial.vue

    For layers:
      create {srcDir}/app.vue:
          <template>
            <nuxt-layer>

    app.starter.vue -- guiding to create app.vue or pages/
    app.default.vue if (pages/)
    app.layout.vue if (layouts/)

  pages/index.vue:
    <nuxt-layout>
      ...
    </nuxt-layout>

  pages/about.vue:
    ...

*/
</script>
