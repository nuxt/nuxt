<template>
  <div>
    <div>Page 2</div>

    <NuxtLink
      id="link"
      to="/page-1"
    >
      To page 1
    </NuxtLink>
  </div>
</template>

<script>
export default {
  layout: "layout-2",

  mounted() {
    console.log("page-2 mounted", this.$nuxt.layoutName);
  },
};
</script>
