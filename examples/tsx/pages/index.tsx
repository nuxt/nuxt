import * as tsx from 'vue-tsx-support'
import HelloWorld from '../components/HelloWorld'

export default tsx.component({
  name: 'Home',
  render () {
    return (
      <div>
        <HelloWorld />
      </div>
    )
  }
})
