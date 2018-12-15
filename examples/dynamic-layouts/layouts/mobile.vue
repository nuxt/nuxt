<template>
  <div class="dark">
    <div class="mobile-banner">
      Mobile website
    </div>
    <Nuxt />
  </div>
</template>

<style>
* {
  box-sizing: border-box;
}
.dark {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  min-height: 100%;
  background: black;
  color: white;
  padding: 10px;
  padding-top: 40px;
}
.dark a {
  color: white;
}
.mobile-banner {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  text-align: center;
  padding: 10px;
  background: #333;
  font-family: sans-serif;
  font-size: 13px;
}
</style>
