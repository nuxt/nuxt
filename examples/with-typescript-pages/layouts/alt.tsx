import Vue from 'vue';

export default Vue.extend({
  name: 'AltLayout',
  render() {
    return (
      <div>
        <header>Alt Header</header>
        <main>
          <nuxt />
        </main>
        <footer>Alt Footer</footer>
      </div>
    );
  }
});
