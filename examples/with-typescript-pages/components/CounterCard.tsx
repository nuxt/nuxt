import Vue from 'vue';

export default Vue.extend({
  name: 'CounterCard',
  data() {
    return {
      password: ''
    };
  },
  render() {
    return (
      <div>
        <div>Count: {this.$store.state.count}</div>
        <button onClick={e => this.$store.commit('increment')}>+</button>
        <button onClick={e => this.$store.commit('decrement')}>-</button>
        <input
          value={this.password}
          onInput={e => (this.password = e.target.value)}
        />
        <nuxt-link
          to={{ name: 'secret', query: { password: this.password } }}
          tag="button"
        >
          Go to Secret
        </nuxt-link>
      </div>
    );
  }
});
