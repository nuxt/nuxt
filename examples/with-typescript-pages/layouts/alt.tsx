import Vue from 'vue';

export default Vue.extend({
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
