export const messages = [
  { component: 'vText', data: 'Welcome to the <b>Dynamic Component</b> demo!' },
  { component: 'vImage', data: 'https://placeimg.com/350/200/animals' },
  { component: 'vCode', data: 'var a = 1;\nvar b = 2;\nb = a;' },
  {
    component: 'vChart',
    data: {
      labels: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
      datasets: [
        {
          label: 'Activity',
          backgroundColor: '#41b883',
          data: [40, 20, 12, 39, 10, 40, 39, 50, 40, 20, 12, 11]
        }
      ]
    }
  },
  { component: 'vText', data: 'End of demo 🎉' }
]

async function streamMessages(fn, i = 0) {
  if (i >= messages.length) return
  await fn(messages[i])
  setTimeout(() => streamMessages(fn, i + 1), 1500)
}

export default streamMessages
