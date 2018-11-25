import Vue from 'vue';
import CounterCard from '../components/CounterCard';

export default Vue.extend({
  // @ts-ignore
  layout: 'alt',
  render() {
    return (
      <div>
        <div>Alt Page</div>
        <CounterCard />
      </div>
    );
  }
});
