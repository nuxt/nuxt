<template>
  <v-app>
    <v-container fluid>
      <div class="main">
        <h1>Welcome to STORYBOOK</h1>
        <p>
          This is a UI component dev environment for your app.
        </p>

        <p>
          The repo for this project exists here
          <a
            class="link"
            href="https://github.com/white-rabbit-japan/vuetify-storyboard-boilerplate"
            target="_blank"
            rel="noopener noreferrer"
          >
            vuetify-storyboard-boilerplate
          </a>
        </p>

        <p>
          We've added some basic stories inside the

          <code class="code">
            src/stories
          </code>
          directory.
          A story is a single state of one or more UI components. You can have as many stories as you want.
          (Basically a story is like a visual test case.)
        </p>
        <p>
          See these sample

          <a class="link" role="button" tabIndex="0" @click.prevent="showApp">
            stories
          </a>
          for a component called

          <code class="code">
            Button
          </code> .
        </p>
        <p>
          Just like that, you can add your own components as stories.
          You can also edit those components and see changes right away.
          (Try editing the
          <code class="code">
            Button
          </code> component located at
          <code class="code">
            src/stories/Button.js
          </code>.)
        </p>
        <p>
          This is just one thing you can do with Storybook.
          Have a look at the

          <a class="link" href="https://github.com/storybooks/storybook" target="_blank" rel="noopener noreferrer">
            Storybook
          </a>
          repo for more information.
        </p>
        <p class="note">
          <b>NOTE:</b>
          Have a look at the

          <code class="code">
            .storybook/webpack.config.js
          </code>
          to add webpack loaders and plugins you are using in this project.
        </p>
      </div>
    </v-container>
  </v-app>
</template>

<script>
export default {
  name: 'Welcome',

  props: {
    showApp: {
      type: Function,
      default: () => console.log('Welcome to storybook!') // eslint-disable-line
    }
  }
}
</script>

<style>
.main {
  margin: 15px;
  max-width: 600px;
  line-height: 1.4;
  font-family: "Helvetica Neue", Helvetica, "Segoe UI", Arial, freesans,
  sans-serif;
}

.logo {
  width: 200px;
}

.link {
  color: #1474f3;
  text-decoration: none;
  border-bottom: 1px solid #1474f3;
  padding-bottom: 2px;
}

.code {
  font-size: 15px;
  font-weight: 600;
  padding: 2px 5px;
  border: 1px solid #eae9e9;
  border-radius: 4px;
  background-color: #f3f2f2;
  color: #3a3a3a;
}

.note {
  opacity: 0.5;
}
</style>
