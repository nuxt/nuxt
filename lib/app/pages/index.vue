<template>
  <div>
    <section class="Landscape">
      <div class="Landscape__Logo">
        <div class="VueToNuxtLogo">
          <div class="Triangle Triangle--two"></div>
          <div class="Triangle Triangle--one"></div>
          <div class="Triangle Triangle--three"></div>
          <div class="Triangle Triangle--four"></div>
        </div>
        <h1 class="Landscape__Logo__Title">NUXT</h1>
      </div>
      <h2 class="Landscape__Title">Universal Vue.js Applications</h2>
      <a href="https://nuxtjs.org/guide/installation#starting-from-scratch" target="_blank" class="button">
        Get Started
      </a>
    </section>
  </div>
</template>

<style>
  .Landscape {
    min-height: calc(100vh - 50px);
    background-color: #fff;
    padding: 70px 15px;
    padding-top: 100px;
    text-align: center;
  }

  @media (min-width: 992px) {
    .Landscape {
      padding: 140px 30px;
      padding-top: 200px;
    }
  }

  .Landscape__Logo__Title {
    margin:0;
    padding:0;
    font-family: "Quicksand", "Source Sans Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    line-height: 20px;
    display: block;
    font-weight: 300;
    font-size: 100px;
    color: #35495e;
    letter-spacing: 1px;
    padding: 25px 15px;
  }

  @media (min-width: 992px) {
    .Landscape__Logo__Title {
      font-size: 120px;
      display: inline-block;
      padding: 0;
      padding-left: 30px;
    }
  }

  .Landscape__Title {
      font-family: "Quicksand", "Source Sans Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 45px;
      font-weight: 300;
      line-height: normal;
      margin: 30px 0;
      color: #526488;
      word-spacing: 5px;
  }

  @media (min-width: 992px) {
    .Landscape__Title {
      font-size: 60px;
    }
  }

  .VueToNuxtLogo {
    display: inline-block;
    animation: turn 2s linear forwards;
    transform: rotateX(180deg);
    position: relative;
    overflow: hidden;
    height: 180px;
    width: 245px;
  }

  .Triangle {
    position: absolute;
    top: 0;
    left: 0;
    width: 0;
    height: 0;
  }

  .Triangle--one {
    border-left: 105px solid transparent;
    border-right: 105px solid transparent;
    border-bottom: 180px solid #41B883;
  }

  .Triangle--two {
    top: 30px;
    left: 35px;
    animation: goright 0.5s linear forwards 2.5s;
    border-left: 87.5px solid transparent;
    border-right: 87.5px solid transparent;
    border-bottom: 150px solid #3B8070;
  }

  .Triangle--three {
    top: 60px;
    left: 35px;
    animation: goright 0.5s linear forwards 2.5s;
    border-left: 70px solid transparent;
    border-right: 70px solid transparent;
    border-bottom: 120px solid #35495E;
  }

  .Triangle--four {
    top: 120px;
    left: 70px;
    animation: godown 0.5s linear forwards 2s;
    border-left: 35px solid transparent;
    border-right: 35px solid transparent;
    border-bottom: 60px solid #fff;
  }

  @keyframes turn {
    100% {
      transform: rotateX(0deg);
    }
  }

  @keyframes godown {
    100% {
      top: 180px;
    }
  }

  @keyframes goright {
    100% {
      left: 70px;
    }
  }

  .button {
    font-family: "Quicksand", "Source Sans Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    position: relative;
    display: inline-block;
    color: #fff!important;
    font-size: 16px;
    font-weight: 600;
    padding: 14px 42px;
    padding-top: 13px;
    min-width: 150px;
    text-align: center;
    text-transform: uppercase;
    text-decoration: none;
    background-color: #3b8070;
    border-radius: 4px;
    letter-spacing: 1px;
    border: 1px solid #3b8070;
  }
</style>