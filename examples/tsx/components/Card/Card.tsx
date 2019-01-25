import * as tsx from 'vue-tsx-support'
import List from '../List'
import Title from '../Title'

export default tsx.component({
  name: 'Card',
  data () {
    return {
      list: ['apple', 'grape', 'orange', 'banana']
    }
  },
  render () {
    return (
      <div>
        <Title label='Fruit List' />
        <List data={this.list} />
      </div>
    )
  }
})
