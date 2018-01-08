import MarkdownIt from 'markdown-it'

export default ({ app }, inject) => {
  inject('md', new MarkdownIt())
}
