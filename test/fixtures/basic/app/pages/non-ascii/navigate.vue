<template>
  <div>
    <button
      id="navigate-ampersand"
      @click="navigateTo('/non-ascii/a&b')"
    >
      navigate to a&amp;b
    </button>
    <button
      id="navigate-plus"
      @click="navigateTo('/non-ascii/a+b')"
    >
      navigate to a+b
    </button>
  </div>
</template>
