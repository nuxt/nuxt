<template>
  <div>
    <section class="Landscape">
      <div class="Landscape__Logo">
        <svg class="logo" width="220" height="166" xmlns="http://www.w3.org/2000/svg">
          <g transform="translate(-18 -29)" fill="none" fill-rule="evenodd">
            <path d="M0 176h67.883a22.32 22.32 0 0 1 2.453-7.296L134 57.718 100.881 0 0 176zM218.694 176H250L167.823 32 153 58.152l62.967 110.579a21.559 21.559 0 0 1 2.727 7.269z" />
            <path d="M86.066 189.388a8.241 8.241 0 0 1-.443-.908 11.638 11.638 0 0 1-.792-6.566H31.976l78.55-138.174 33.05 58.932L154 94.882l-32.69-58.64C120.683 35.1 116.886 29 110.34 29c-2.959 0-7.198 1.28-10.646 7.335L20.12 176.185c-.676 1.211-3.96 7.568-.7 13.203C20.912 191.95 24.08 195 31.068 195h66.646c-6.942 0-10.156-3.004-11.647-5.612z" fill="#00C58E" />
            <path d="M235.702 175.491L172.321 62.216c-.655-1.191-4.313-7.216-10.68-7.216-2.868 0-6.977 1.237-10.32 7.193L143 75.706v26.104l18.709-32.31 62.704 111.626h-23.845c.305 1.846.134 3.74-.496 5.498a7.06 7.06 0 0 1-.497 1.122l-.203.413c-3.207 5.543-10.139 5.841-11.494 5.841h37.302c1.378 0 8.287-.298 11.493-5.841 1.423-2.52 2.439-6.758-.97-12.668z" fill="#108775" />
            <path d="M201.608 189.07l.21-.418c.206-.364.378-.745.515-1.139a10.94 10.94 0 0 0 .515-5.58 16.938 16.938 0 0 0-2.152-5.72l-49.733-87.006L143.5 76h-.136l-7.552 13.207-49.71 87.006a17.534 17.534 0 0 0-1.917 5.72c-.4 2.21-.148 4.486.725 6.557.13.31.278.613.444.906 1.497 2.558 4.677 5.604 11.691 5.604h92.592c1.473 0 8.651-.302 11.971-5.93zm-58.244-86.657l45.455 79.52H97.934l45.43-79.52z" fill="#2F4A5F" fill-rule="nonzero" />
          </g>
        </svg>
      </div>
      <h2 class="Landscape__Title">The Vue.js Framework</h2>
      <a href="https://nuxtjs.org/guide/installation#starting-from-scratch" target="_blank" class="button">
        Get Started
      </a>
      <p class="Landscape__Page__Explanation">Please create <a href="https://nuxtjs.org/guide/directory-structure#the-pages-directory" target="_blank">the pages directory</a> to suppress this default page.</p>
    </section>
  </div>
</template>

<style>
  .Landscape {
    min-height: calc(100vh - 200px);
    background-color: #fff;
    padding: 70px 15px;
    padding-top: 80px;
    text-align: center;
  }

  @media (min-width: 992px) {
    .Landscape {
      padding: 0 30px;
      padding-top: 140px;
    }
  }

  .Landscape__Logo__Title {
    margin:0;
    padding:0;
    font-family: "Quicksand", "Source Sans Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    display: block;
    font-weight: 300;
    font-size: 100px;
    color: #35495e;
    letter-spacing: 1px;
    padding: 0 15px;
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
      margin: 0;
      margin-top: 10px;
      color: #526488;
      word-spacing: 5px;
  }

  .Landscape__Page__Explanation {
      font-family: "Quicksand", "Source Sans Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #35495e;
      margin: 16px 0 0;
      font-size: 16px;
  }

  .Landscape__Page__Explanation > a {
      color: #3b8070;
      text-decoration: underline;
  }

  @media (min-width: 992px) {
    .Landscape__Title {
      font-size: 60px;
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
    margin-top: 40px;
  }
</style>
