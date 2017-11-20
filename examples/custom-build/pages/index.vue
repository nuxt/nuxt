<template>
  <div class="container">
    <p><img src="~/assets/nuxt.png" /></p>
    <p>This image is included as data:image/png;base64...</p>
    <p>In the source code, the files generated are based on the build.filenames data.</p>
    <p>If you look at the <a href="/_nuxt/vendor.js">vendor.js</a>, lodash has been included (cmd/ctrl + F "lodash").</p>
  </div>
</template>

<style>
.container {
  font-size: 20px;
  text-align: center;
  padding: 100px;
}
</style>
