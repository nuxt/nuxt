import { splitByCase, upperFirst } from 'scule'

export default (title, link) => {
  return title || (link.startsWith('http') && link) || link.split('/').filter(Boolean).map(part => splitByCase(part).map(p => upperFirst(p)).join(' ')).join(' > ').replace('Api', 'API')
}
