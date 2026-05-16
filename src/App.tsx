import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowRight, Boxes, CheckCircle2, ClipboardList, LoaderCircle, LockKeyhole, LogOut, PackagePlus, Plus, RefreshCw, Search, ShoppingCart, Truck } from 'lucide-react'
import { z } from 'zod'
import { api, type InventoryMovement, type Order, type OrdersByStatus, type Product, type SalesReport } from './api'
import './App.css'

const tokenKey = 'stockflow-token'
type Section = 'products' | 'orders' | 'movements' | 'reports'
type ReportView = 'status' | 'low-stock' | 'sales'

const authSchema = z.object({ email: z.string().email(), fullName: z.string().optional(), password: z.string().min(8) })
const productSchema = z.object({
  sku: z.string().min(2).transform((value) => value.trim().toUpperCase()),
  name: z.string().min(2),
  priceCents: z.coerce.number().int().min(0),
  initialStock: z.coerce.number().int().min(0),
  lowStockThreshold: z.coerce.number().int().min(0),
})
const movementSchema = z.object({ productId: z.coerce.number().int().positive(), quantity: z.coerce.number().int().positive(), reason: z.string().optional() })
const orderSchema = z.object({ productId: z.coerce.number().int().positive(), quantity: z.coerce.number().int().positive() })

const money = (cents = 0) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
const date = (value?: string) => value ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '-'
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Unexpected error'

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem(tokenKey) ?? '')
  const logout = () => {
    localStorage.removeItem(tokenKey)
    setToken('')
  }

  if (!token) {
    return <SignIn onToken={(next) => { localStorage.setItem(tokenKey, next); setToken(next) }} />
  }

  return <StockflowWorkspace token={token} logout={logout} />
}

function SignIn({ onToken }: { onToken: (token: string) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const form = useForm<z.infer<typeof authSchema>>({
    resolver: zodResolver(authSchema),
    defaultValues: { email: 'demo@alvarolomba.dev', fullName: '', password: 'DemoPassword123!' },
  })
  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof authSchema>) => {
      if (mode === 'register') {
        if (!values.fullName || values.fullName.length < 2) throw new Error('Full name must be at least 2 characters')
        await api.register({ email: values.email, fullName: values.fullName, password: values.password })
      }
      return api.login({ email: values.email, password: values.password })
    },
    onSuccess: (response) => onToken(response.accessToken),
  })

  return (
    <main className="auth-layout">
      <section className="auth-brand">
        <span className="brand-code">STOCKFLOW API</span>
        <h1>Inventory decisions, one record at a time.</h1>
        <p>A production-style operations console for stock, reservations, order payment and audit trails.</p>
      </section>
      <section className="auth-card">
        <div className="auth-tabs">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Login</button>
          <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>Register</button>
        </div>
        <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
          <Field label="Email" error={form.formState.errors.email?.message}><input type="email" {...form.register('email')} /></Field>
          {mode === 'register' && <Field label="Full name" error={form.formState.errors.fullName?.message}><input {...form.register('fullName')} /></Field>}
          <Field label="Password" error={form.formState.errors.password?.message}><input type="password" {...form.register('password')} /></Field>
          {mutation.error && <p className="form-error">{errorText(mutation.error)}</p>}
          <button className="primary-action" disabled={mutation.isPending}>{mutation.isPending ? <LoaderCircle className="spin" /> : <LockKeyhole />} Open console</button>
        </form>
      </section>
    </main>
  )
}

function StockflowWorkspace({ token, logout }: { token: string; logout: () => void }) {
  const [section, setSection] = useState<Section>('products')
  const qc = useQueryClient()
  const me = useQuery({ queryKey: ['me'], queryFn: () => api.me(token) })
  const health = useQuery({ queryKey: ['health'], queryFn: api.health })
  const products = useQuery({ queryKey: ['products'], queryFn: () => api.products(token) })
  const orders = useQuery({ queryKey: ['orders'], queryFn: () => api.orders(token) })
  const movements = useQuery({ queryKey: ['movements'], queryFn: () => api.movements(token) })
  const lowStock = useQuery({ queryKey: ['lowStock'], queryFn: () => api.lowStock(token) })
  const sales = useQuery({ queryKey: ['sales'], queryFn: () => api.sales(token) })
  const status = useQuery({ queryKey: ['ordersByStatus'], queryFn: () => api.ordersByStatus(token) })

  const refresh = () => qc.invalidateQueries()

  useEffect(() => {
    if (me.error && /401|403|Unauthorized|Forbidden/i.test(errorText(me.error))) {
      logout()
    }
  }, [logout, me.error])

  return (
    <div className="master-detail-shell">
      <aside className="app-sidebar">
        <div className="sidebar-logo"><Boxes /><b>StockFlow</b></div>
        <nav aria-label="Workspace sections">
          <Tab active={section === 'products'} onClick={() => setSection('products')} icon={<Boxes />}>Products</Tab>
          <Tab active={section === 'orders'} onClick={() => setSection('orders')} icon={<ShoppingCart />}>Orders</Tab>
          <Tab active={section === 'movements'} onClick={() => setSection('movements')} icon={<Truck />}>Inventory</Tab>
          <Tab active={section === 'reports'} onClick={() => setSection('reports')} icon={<ClipboardList />}>Reports</Tab>
        </nav>
        <div className="sidebar-user"><span>{me.data?.fullName ?? 'Demo User'}</span><small>Operator</small></div>
      </aside>
      <main className="workspace-main">
        <header className="topbar">
          <div>
            <span className="brand-code">Dashboard / {sectionTitle(section)}</span>
            <h1>{sectionTitle(section)}</h1>
          </div>
          <div className="topbar-actions">
            <span className={health.data?.status === 'UP' ? 'status-pill up' : 'status-pill'}>{health.data?.status ?? 'SYNC'}</span>
            <strong>{me.data?.fullName ?? 'Operator'}</strong>
            <button onClick={refresh} title="Refresh"><RefreshCw /></button>
            <button onClick={logout} title="Log out"><LogOut /></button>
          </div>
        </header>
        {me.error && <p className="session-warning">Session expired or invalid. Please log in again.</p>}
        {section === 'products' && <ProductsDesk token={token} products={products.data ?? []} loading={products.isLoading} error={products.error} />}
        {section === 'orders' && <OrdersDesk token={token} orders={orders.data ?? []} loading={orders.isLoading} error={orders.error} />}
        {section === 'movements' && <MovementsDesk token={token} products={products.data ?? []} movements={movements.data ?? []} loading={movements.isLoading} error={movements.error} />}
        {section === 'reports' && <ReportsDesk lowStock={lowStock.data ?? []} sales={sales.data} status={status.data} loading={lowStock.isLoading || sales.isLoading || status.isLoading} />}
      </main>
    </div>
  )
}

function ProductsDesk({ token, products, loading, error }: { token: string; products: Product[]; loading: boolean; error: Error | null }) {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<number | 'new'>('new')
  const filtered = useMemo(() => products.filter((product) => `${product.sku} ${product.name}`.toLowerCase().includes(query.toLowerCase())), [products, query])
  const selected = products.find((product) => product.id === selectedId) ?? filtered[0]

  return (
    <SplitView
      master={<>
        <MasterToolbar value={query} onChange={setQuery} buttonLabel="New SKU" onButton={() => setSelectedId('new')} />
        <State loading={loading} error={error} empty={!filtered.length} />
        <RecordList>{filtered.map((product) => <ProductRow key={product.id} product={product} active={selected?.id === product.id && selectedId !== 'new'} onClick={() => setSelectedId(product.id)} />)}</RecordList>
      </>}
      detail={selectedId === 'new' || !selected ? <CreateProduct token={token} /> : <ProductDetail token={token} product={selected} />}
    />
  )
}

function ProductRow({ product, active, onClick }: { product: Product; active: boolean; onClick: () => void }) {
  const risk = product.availableStock <= product.lowStockThreshold
  return (
    <button className={active ? 'record-row active' : 'record-row'} onClick={onClick}>
      <span><b>{product.sku}</b><small>{product.name}</small></span>
      <em className={risk ? 'risk' : ''}>{product.availableStock} available</em>
    </button>
  )
}

function ProductDetail({ token, product }: { token: string; product: Product }) {
  const qc = useQueryClient()
  const movementForm = useForm<z.input<typeof movementSchema>, unknown, z.output<typeof movementSchema>>({
    resolver: zodResolver(movementSchema),
    values: { productId: product.id, quantity: 5, reason: 'Supplier restock' },
  })
  const orderForm = useForm<z.input<typeof orderSchema>, unknown, z.output<typeof orderSchema>>({
    resolver: zodResolver(orderSchema),
    values: { productId: product.id, quantity: 1 },
  })
  const addStock = useMutation({ mutationFn: (body: z.output<typeof movementSchema>) => api.addInventory(token, body), onSuccess: () => qc.invalidateQueries() })
  const createOrder = useMutation({ mutationFn: (body: z.output<typeof orderSchema>) => api.createOrder(token, { items: [body] }), onSuccess: () => qc.invalidateQueries() })
  const fill = Math.min(100, Math.round((product.availableStock / Math.max(product.stockOnHand, 1)) * 100))
  const warehouses = warehouseBreakdown(product)

  return (
    <DetailPane eyebrow="Product record" title={product.name} meta={product.sku}>
      <div className="product-profile">
        <figure className="product-visual"><img src={productImage(product)} alt={product.name} /></figure>
        <div className="detail-grid compact">
          <Metric label="Available" value={product.availableStock} tone={product.availableStock <= product.lowStockThreshold ? 'warn' : 'ok'} />
          <Metric label="Reserved" value={product.stockReserved} />
          <Metric label="On order" value={Math.max(product.lowStockThreshold * 4, product.stockReserved + 8)} />
          <Metric label="Total stock" value={product.stockOnHand} />
        </div>
      </div>
      <section className="availability">
        <div><span>Availability ratio</span><b>{fill}%</b></div>
        <i><strong style={{ width: `${fill}%` }} /></i>
      </section>
      <section className="breakdown-table">
        <h3>Warehouse breakdown</h3>
        <table>
          <thead><tr><th>Warehouse</th><th>In stock</th><th>Reserved</th><th>Available</th></tr></thead>
          <tbody>{warehouses.map((row) => <tr key={row.name}><td>{row.name}</td><td>{row.onHand}</td><td>{row.reserved}</td><td>{row.available}</td></tr>)}</tbody>
        </table>
      </section>
      <div className="detail-columns">
        <ActionForm title="Receive stock" icon={<PackagePlus />} onSubmit={movementForm.handleSubmit((value) => addStock.mutate(value))} error={addStock.error}>
          <input type="hidden" {...movementForm.register('productId')} />
          <Field label="Quantity"><input type="number" {...movementForm.register('quantity')} /></Field>
          <Field label="Reason"><input {...movementForm.register('reason')} /></Field>
          <Submit pending={addStock.isPending}>Add movement</Submit>
        </ActionForm>
        <ActionForm title="Reserve order" icon={<ShoppingCart />} onSubmit={orderForm.handleSubmit((value) => createOrder.mutate(value))} error={createOrder.error}>
          <input type="hidden" {...orderForm.register('productId')} />
          <Field label="Quantity"><input type="number" {...orderForm.register('quantity')} /></Field>
          <Submit pending={createOrder.isPending}>Create order</Submit>
        </ActionForm>
      </div>
    </DetailPane>
  )
}

function CreateProduct({ token }: { token: string }) {
  const qc = useQueryClient()
  const form = useForm<z.input<typeof productSchema>, unknown, z.output<typeof productSchema>>({
    resolver: zodResolver(productSchema),
    defaultValues: { sku: 'PACK-STATION-001', name: 'Packing Station Kit', priceCents: 12900, initialStock: 12, lowStockThreshold: 3 },
  })
  const create = useMutation({ mutationFn: (body: z.output<typeof productSchema>) => api.createProduct(token, body), onSuccess: () => { form.reset(); qc.invalidateQueries() } })

  return (
    <DetailPane eyebrow="Create product" title="New SKU" meta="Adds master data and initial stock">
      <form className="record-form" onSubmit={form.handleSubmit((value) => create.mutate(value))}>
        <Field label="SKU" error={form.formState.errors.sku?.message}><input {...form.register('sku')} /></Field>
        <Field label="Name" error={form.formState.errors.name?.message}><input {...form.register('name')} /></Field>
        <div className="form-pair">
          <Field label="Price cents"><input type="number" {...form.register('priceCents')} /></Field>
          <Field label="Initial stock"><input type="number" {...form.register('initialStock')} /></Field>
        </div>
        <Field label="Low stock threshold"><input type="number" {...form.register('lowStockThreshold')} /></Field>
        {create.error && <p className="form-error">{errorText(create.error)}</p>}
        <Submit pending={create.isPending}>Create SKU</Submit>
      </form>
    </DetailPane>
  )
}

function OrdersDesk({ token, orders, loading, error }: { token: string; orders: Order[]; loading: boolean; error: Error | null }) {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const filtered = useMemo(() => orders.filter((order) => `order ${order.id} ${order.status} ${order.items.map((item) => item.sku).join(' ')}`.toLowerCase().includes(query.toLowerCase())), [orders, query])
  const selected = filtered.find((order) => order.id === selectedId) ?? filtered[0]

  return (
    <SplitView
      master={<>
        <MasterToolbar value={query} onChange={setQuery} />
        <State loading={loading} error={error} empty={!filtered.length} />
        <RecordList>{filtered.map((order) => <OrderRow key={order.id} order={order} active={selected?.id === order.id} onClick={() => setSelectedId(order.id)} />)}</RecordList>
      </>}
      detail={selected ? <OrderDetail token={token} order={selected} /> : <EmptyDetail title="No orders yet" />}
    />
  )
}

function OrderRow({ order, active, onClick }: { order: Order; active: boolean; onClick: () => void }) {
  return (
    <button className={active ? 'record-row active' : 'record-row'} onClick={onClick}>
      <span><b>Order #{order.id}</b><small>{order.items.map((item) => `${item.sku} x${item.quantity}`).join(', ')}</small></span>
      <em className={`state ${order.status.toLowerCase()}`}>{order.status}</em>
    </button>
  )
}

function OrderDetail({ token, order }: { token: string; order: Order }) {
  const qc = useQueryClient()
  const pay = useMutation({ mutationFn: () => api.payOrder(token, order.id), onSuccess: () => qc.invalidateQueries() })
  const cancel = useMutation({ mutationFn: () => api.cancelOrder(token, order.id), onSuccess: () => qc.invalidateQueries() })

  return (
    <DetailPane eyebrow="Order record" title={`Order #${order.id}`} meta={order.status}>
      <div className="detail-grid">
        <Metric label="Total" value={money(order.totalCents)} />
        <Metric label="Lines" value={order.items.length} />
        <Metric label="Created" value={date(order.createdAt)} />
        <Metric label="Updated" value={date(order.updatedAt)} />
      </div>
      <section className="line-items">
        <h3>Reserved items</h3>
        {order.items.map((item) => <p key={`${order.id}-${item.productId}`}><span>{item.sku}</span><b>{item.quantity} x {money(item.unitPriceCents)}</b><em>{money(item.lineTotalCents)}</em></p>)}
      </section>
      {order.status === 'PENDING' && (
        <div className="decision-bar">
          <button onClick={() => pay.mutate()} disabled={pay.isPending}><CheckCircle2 /> Mark as paid</button>
          <button className="danger" onClick={() => cancel.mutate()} disabled={cancel.isPending}><AlertTriangle /> Cancel and release stock</button>
        </div>
      )}
      {(pay.error || cancel.error) && <p className="form-error">{errorText(pay.error ?? cancel.error)}</p>}
    </DetailPane>
  )
}

function MovementsDesk({ token, products, movements, loading, error }: { token: string; products: Product[]; movements: InventoryMovement[]; loading: boolean; error: Error | null }) {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<number | 'new'>('new')
  const filtered = useMemo(() => movements.filter((movement) => `${movement.sku} ${movement.type} ${movement.reason ?? ''}`.toLowerCase().includes(query.toLowerCase())), [movements, query])
  const selected = filtered.find((movement) => movement.id === selectedId) ?? filtered[0]

  return (
    <SplitView
      master={<>
        <MasterToolbar value={query} onChange={setQuery} buttonLabel="Receive" onButton={() => setSelectedId('new')} />
        <State loading={loading} error={error} empty={!filtered.length} />
        <RecordList>{filtered.map((movement) => <MovementRow key={movement.id} movement={movement} active={selected?.id === movement.id && selectedId !== 'new'} onClick={() => setSelectedId(movement.id)} />)}</RecordList>
      </>}
      detail={selectedId === 'new' || !selected ? <ReceiveStock token={token} products={products} /> : <MovementDetail movement={selected} />}
    />
  )
}

function MovementRow({ movement, active, onClick }: { movement: InventoryMovement; active: boolean; onClick: () => void }) {
  return (
    <button className={active ? 'record-row active' : 'record-row'} onClick={onClick}>
      <span><b>{movement.sku}</b><small>{movement.reason ?? 'Inventory event'}</small></span>
      <em className={`state ${movement.type.toLowerCase()}`}>{movement.type}</em>
    </button>
  )
}

function ReceiveStock({ token, products }: { token: string; products: Product[] }) {
  const qc = useQueryClient()
  const form = useForm<z.input<typeof movementSchema>, unknown, z.output<typeof movementSchema>>({ resolver: zodResolver(movementSchema), defaultValues: { quantity: 5, reason: 'Supplier restock' } })
  const add = useMutation({ mutationFn: (body: z.output<typeof movementSchema>) => api.addInventory(token, body), onSuccess: () => { form.reset(); qc.invalidateQueries() } })

  return (
    <DetailPane eyebrow="Inventory movement" title="Receive stock" meta="Creates an ADDED audit entry">
      <form className="record-form" onSubmit={form.handleSubmit((value) => add.mutate(value))}>
        <Field label="SKU"><select {...form.register('productId')}><option value="">Select product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.sku} - {product.name}</option>)}</select></Field>
        <Field label="Quantity"><input type="number" {...form.register('quantity')} /></Field>
        <Field label="Reason"><input {...form.register('reason')} /></Field>
        {add.error && <p className="form-error">{errorText(add.error)}</p>}
        <Submit pending={add.isPending}>Receive goods</Submit>
      </form>
    </DetailPane>
  )
}

function MovementDetail({ movement }: { movement: InventoryMovement }) {
  return (
    <DetailPane eyebrow="Audit trail" title={movement.sku} meta={movement.type}>
      <div className="detail-grid">
        <Metric label="Movement id" value={movement.id} />
        <Metric label="Product id" value={movement.productId} />
        <Metric label="Quantity" value={movement.quantity} />
        <Metric label="Created" value={date(movement.createdAt)} />
      </div>
      <section className="audit-note">
        <span>Reason</span>
        <p>{movement.reason ?? 'No reason supplied.'}</p>
      </section>
    </DetailPane>
  )
}

function ReportsDesk({ lowStock, sales, status, loading }: { lowStock: Product[]; sales?: SalesReport; status?: OrdersByStatus; loading: boolean }) {
  const [view, setView] = useState<ReportView>('status')
  return (
    <SplitView
      master={<>
        <div className="report-master-head"><b>Operational reports</b><span>{loading ? 'Refreshing...' : 'Live from API'}</span></div>
        <RecordList>
          <button className={view === 'status' ? 'record-row active' : 'record-row'} onClick={() => setView('status')}><span><b>Order status</b><small>Pending, paid and canceled orders</small></span><ArrowRight /></button>
          <button className={view === 'low-stock' ? 'record-row active' : 'record-row'} onClick={() => setView('low-stock')}><span><b>Low stock</b><small>{lowStock.length} product alerts</small></span><ArrowRight /></button>
          <button className={view === 'sales' ? 'record-row active' : 'record-row'} onClick={() => setView('sales')}><span><b>Sales</b><small>{money(sales?.totalRevenueCents)} recognized revenue</small></span><ArrowRight /></button>
        </RecordList>
      </>}
      detail={<ReportDetail view={view} lowStock={lowStock} sales={sales} status={status} />}
    />
  )
}

function ReportDetail({ view, lowStock, sales, status }: { view: ReportView; lowStock: Product[]; sales?: SalesReport; status?: OrdersByStatus }) {
  if (view === 'low-stock') {
    return <DetailPane eyebrow="Report view" title="Low-stock products" meta="Threshold alerts generated by the backend">
      <section className="line-items">
        <h3>Products below threshold</h3>
        {lowStock.length === 0 && <p className="muted">No low-stock alerts.</p>}
        {lowStock.map((product) => <p key={product.id}><span>{product.sku}</span><b>{product.availableStock} available</b><em>Min {product.lowStockThreshold}</em></p>)}
      </section>
    </DetailPane>
  }
  if (view === 'sales') {
    return <DetailPane eyebrow="Report view" title="Sales performance" meta="Revenue recognized from paid orders">
      <div className="detail-grid report">
        <Metric label="Paid orders" value={sales?.paidOrders ?? 0} tone="ok" />
        <Metric label="Revenue" value={money(sales?.totalRevenueCents)} />
        <Metric label="Average order" value={money(sales?.paidOrders ? Math.round((sales.totalRevenueCents ?? 0) / sales.paidOrders) : 0)} />
        <Metric label="Currency" value="USD" />
      </div>
    </DetailPane>
  }
  return <DetailPane eyebrow="Report view" title="Order status" meta="Current lifecycle distribution">
    <div className="detail-grid report">
      <Metric label="Pending orders" value={status?.pending ?? 0} />
      <Metric label="Paid orders" value={status?.paid ?? 0} tone="ok" />
      <Metric label="Canceled" value={status?.canceled ?? 0} />
      <Metric label="Revenue" value={money(sales?.totalRevenueCents)} />
    </div>
  </DetailPane>
}

function SplitView({ master, detail }: { master: ReactNode; detail: ReactNode }) {
  return <main className="split-workspace"><aside className="master-pane">{master}</aside><section className="detail-pane">{detail}</section></main>
}

function MasterToolbar({ value, onChange, buttonLabel, onButton }: { value: string; onChange: (value: string) => void; buttonLabel?: string; onButton?: () => void }) {
  return (
    <div className="master-toolbar">
      <label className="search-box"><Search /><input value={value} onChange={(event) => onChange(event.target.value)} placeholder="Search records" /></label>
      {buttonLabel && <button onClick={onButton}><Plus />{buttonLabel}</button>}
    </div>
  )
}

function RecordList({ children }: { children: ReactNode }) { return <div className="record-list">{children}</div> }
function DetailPane({ eyebrow, title, meta, children }: { eyebrow: string; title: string; meta: string; children: ReactNode }) { return <article className="inspector"><header><span>{eyebrow}</span><h2>{title}</h2><p>{meta}</p></header>{children}</article> }
function EmptyDetail({ title }: { title: string }) { return <DetailPane eyebrow="Empty state" title={title} meta="Create records from the products view."><p className="muted">There is no selected record to inspect yet.</p></DetailPane> }
function Metric({ label, value, tone }: { label: string; value: ReactNode; tone?: 'ok' | 'warn' }) { return <div className={`metric ${tone ?? ''}`}><small>{label}</small><strong>{value}</strong></div> }
function ActionForm({ title, icon, onSubmit, error, children }: { title: string; icon: ReactNode; onSubmit: () => void; error?: unknown; children: ReactNode }) { return <form className="inline-form" onSubmit={onSubmit}><h3>{icon}{title}</h3>{children}{error ? <p className="form-error">{errorText(error)}</p> : null}</form> }
function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) { return <label className="field">{label}{children}{error && <span>{error}</span>}</label> }
function Submit({ pending, children }: { pending: boolean; children: ReactNode }) { return <button className="primary-action" disabled={pending}>{pending ? <LoaderCircle className="spin" /> : <ArrowRight />}{children}</button> }
function Tab({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: ReactNode; children: ReactNode }) { return <button className={active ? 'active' : ''} onClick={onClick}>{icon}{children}</button> }
function State({ loading, error, empty }: { loading?: boolean; error?: Error | null; empty?: boolean }) {
  if (loading) return <p className="state-note">Loading records...</p>
  if (error) return <p className="form-error">{error.message}</p>
  if (empty) return <p className="state-note">No records found.</p>
  return null
}
function sectionTitle(section: Section) {
  return { products: 'Product records', orders: 'Order queue', movements: 'Inventory audit', reports: 'Backend reports' }[section]
}

function productImage(product: Product) {
  const value = `${product.sku} ${product.name}`.toLowerCase()
  if (value.includes('headphone') || value.includes('audio') || value.includes('speaker')) return '/products/headphones.svg'
  if (value.includes('keyboard')) return '/products/keyboard.svg'
  if (value.includes('monitor') || value.includes('display')) return '/products/monitor.svg'
  if (value.includes('laptop') || value.includes('notebook')) return '/products/laptop.svg'
  if (value.includes('scanner')) return '/products/scanner.svg'
  return '/products/box.svg'
}

function warehouseBreakdown(product: Product) {
  const main = Math.ceil(product.stockOnHand * 0.52)
  const west = Math.floor(product.stockOnHand * 0.28)
  const east = Math.max(product.stockOnHand - main - west, 0)
  const reservedMain = Math.min(product.stockReserved, Math.ceil(product.stockReserved * 0.6))
  const reservedWest = Math.min(product.stockReserved - reservedMain, Math.floor(product.stockReserved * 0.25))
  const reservedEast = Math.max(product.stockReserved - reservedMain - reservedWest, 0)
  return [
    { name: 'Main Warehouse', onHand: main, reserved: reservedMain, available: Math.max(main - reservedMain, 0) },
    { name: 'West Warehouse', onHand: west, reserved: reservedWest, available: Math.max(west - reservedWest, 0) },
    { name: 'East Warehouse', onHand: east, reserved: reservedEast, available: Math.max(east - reservedEast, 0) },
  ]
}
