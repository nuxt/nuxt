export interface Product {
  id: number
  name: string
  description: string
  price: number
  tags: string[]
  createdAt: Date
  ratings: { score: number, count: number }
}

export function createProducts (count: number): Product[] {
  return Array.from({ length: count }, (_, id) => ({
    id,
    name: `Product ${id}`,
    description: `A description of product ${id} that is long enough to look like real copy on a listing page.`,
    price: 1000 + (id * 37) % 9000,
    tags: ['new', 'sale', 'popular', 'limited'].slice(0, (id % 4) + 1),
    createdAt: new Date(Date.UTC(2026, 0, 1 + (id % 28))),
    ratings: { score: (id % 5) + 1, count: id * 3 },
  }))
}
