<template>
  <div class="uk-card uk-card-body uk-card-primary">
    <h3 class="uk-card-title">Nuxt.js + UIKIT</h3>
    <button class="uk-button uk-button-default" title="Hello World" uk-tooltip>Hover</button>
    <div class="uk-inline">
      <button class="uk-button uk-button-default" type="button">Click</button>
      <div uk-dropdown="mode: click" class="uk-dropdown">Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt.</div>
    </div>
    <hr class="uk-divider-icon">
    <nuxt-link to="/about">About page</nuxt-link>
  </div>
</template>
