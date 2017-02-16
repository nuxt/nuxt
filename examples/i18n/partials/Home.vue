<template>
  <div class="Content">
    <div class="container">
      <h1 class="Content__Title">{{ $t('home.title') }}</h1>
      <p>{{ $t('home.introduction') }}</p>
    </div>
  </div>
</template>

<style>
.Content
{
  padding: 50px 0;
  text-align: center;
}
.Content__Title
{
  font-weight: 300;
  padding-bottom: 30px;
}
</style>
