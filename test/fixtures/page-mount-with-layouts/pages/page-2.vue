<template>
  <div>
    <h2>Page 2</h2>

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
    window.mountedCount = (window.mountedCount || 0) + 1;
    console.log("page-2 mounted", this.$nuxt.layoutName);
  },
};
</script>
