import * as tsx from 'vue-tsx-support'
import Card from '../components/Card'

export default tsx.component({
  name: 'Home',
  render () {
    return (
      <div>
        <h1>Hello World</h1>
        <Card />
      </div>
    )
  }
})
