export type TokenResponse = { accessToken: string; tokenType: string }
export type User = { id: number; email: string; fullName: string }
export type Product = {
  id: number
  sku: string
  name: string
  priceCents: number
  stockOnHand: number
  stockReserved: number
  availableStock: number
  lowStockThreshold: number
}
export type InventoryMovement = {
  id: number
  productId: number
  sku: string
  type: 'ADDED' | 'RESERVED' | 'RELEASED' | 'SOLD'
  quantity: number
  reason?: string | null
  createdAt: string
}
export type Order = {
  id: number
  status: 'PENDING' | 'PAID' | 'CANCELED'
  totalCents: number
  items: Array<{ productId: number; sku: string; productName: string; quantity: number; unitPriceCents: number; lineTotalCents: number }>
  createdAt?: string
  updatedAt?: string
}
export type SalesReport = { paidOrders: number; totalRevenueCents: number }
export type OrdersByStatus = { pending: number; paid: number; canceled: number }

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? 'https://stockflow-spring-api.onrender.com'

async function request<T>(path: string, options: { token?: string; method?: 'GET' | 'POST' | 'PATCH'; body?: unknown } = {}) {
  const headers: HeadersInit = { Accept: 'application/json' }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (options.token) headers.Authorization = `Bearer ${options.token}`

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })

  if (!response.ok) {
    const fallback = `${response.status} ${response.statusText}`
    try {
      const errorBody = (await response.json()) as { message?: string; error?: string }
      throw new Error(errorBody.message ?? errorBody.error ?? fallback)
    } catch {
      throw new Error(fallback)
    }
  }

  return response.json() as Promise<T>
}

export const api = {
  baseUrl: API_BASE_URL,
  health: () => request<{ status: string }>('/actuator/health'),
  register: (body: { email: string; fullName: string; password: string }) => request<User>('/auth/register', { method: 'POST', body }),
  login: (body: { email: string; password: string }) => request<TokenResponse>('/auth/login', { method: 'POST', body }),
  me: (token: string) => request<User>('/auth/me', { token }),
  products: (token: string) => request<Product[]>('/products', { token }),
  createProduct: (token: string, body: { sku: string; name: string; priceCents: number; initialStock: number; lowStockThreshold: number }) => request<Product>('/products', { method: 'POST', token, body }),
  addInventory: (token: string, body: { productId: number; quantity: number; reason?: string }) => request<InventoryMovement>('/inventory/movements', { method: 'POST', token, body }),
  movements: (token: string) => request<InventoryMovement[]>('/inventory/movements', { token }),
  orders: (token: string) => request<Order[]>('/orders', { token }),
  createOrder: (token: string, body: { items: Array<{ productId: number; quantity: number }> }) => request<Order>('/orders', { method: 'POST', token, body }),
  payOrder: (token: string, id: number) => request<Order>(`/orders/${id}/pay`, { method: 'PATCH', token }),
  cancelOrder: (token: string, id: number) => request<Order>(`/orders/${id}/cancel`, { method: 'PATCH', token }),
  lowStock: (token: string) => request<Product[]>('/reports/low-stock', { token }),
  sales: (token: string) => request<SalesReport>('/reports/sales', { token }),
  ordersByStatus: (token: string) => request<OrdersByStatus>('/reports/orders-by-status', { token }),
}
