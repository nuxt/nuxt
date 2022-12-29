<template>
  <div>
    <div>Page 1</div>

    <NuxtLink
      id="link"
      to="/page-2"
    >
      To page 2
    </NuxtLink>
  </div>
</template>

<script>
export default {
  layout: "layout-1",

  mounted() {
    console.log("page-1 mounted", this.$nuxt.layoutName);
  },
};
</script>
