<template>
  <nuxt-container>
    <nav class="Navbar clearfix">
      <h1 class="Navbar__Title">
        Nuxt Custom Routes
      </h1>
      <ul class="Navbar__Links">
        <li class="Navbar__Links__Item">
          <router-link to="/team" class="Navbar__Links__Item__Link">
            Basic route
          </router-link>
        </li>
        <li class="Navbar__Links__Item">
          <router-link to="/projects" class="Navbar__Links__Item__Link">
            Dynamic routes
          </router-link>
        </li>
        <li class="Navbar__Links__Item">
          <router-link to="/users" class="Navbar__Links__Item__Link">
            Nested routes
          </router-link>
        </li>
        <li class="Navbar__Links__Item">
          <router-link to="/posts" class="Navbar__Links__Item__Link">
            Dynamic nested routes
          </router-link>
        </li>
      </ul>
    </nav>
    <nuxt/>
  </nuxt-container>
</template>

<style>
html, body
{
  font-family: "Source Sans Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  letter-spacing: 0.25px;
  padding: 0;
  margin: 0;
}
*, *::before, *::after
{
  box-sizing: border-box;
}
h1, h2, h3, h4, h5, h6 {
  font-weight: 300;
  text-align: center;
}
.clearfix:before, .clearfix:after
{
  content: " ";
  display: table;
}
.clearfix:after
{
  clear: both;
}
.container {
  margin: 30px;
  border: 1px solid #ddd;
}
.Navbar
{
  background-color: #fff;
  border-bottom: 1px solid #ddd;
  margin: 0;
  padding: 15px 30px;
}
.Navbar__Title
{
  float: left;
  font-weight: 300;
  margin: 0;
}
.Navbar__Links
{
  float: right;
  list-style: none;
  margin: 0;
  padding: 0;
}
.Navbar__Links__Item
{
  float: left;
  margin: 5px 15px;
}
.Navbar__Links__Item__Link
{
  color: #000;
}
a, a:hover
{
  text-transform: uppercase;
  text-decoration: none;
  color: #41B883;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity .3s;
}
.fade-enter, .fade-leave-active {
  opacity: 0;
}
</style>
