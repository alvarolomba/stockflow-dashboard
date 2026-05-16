# StockFlow Dashboard

React + TypeScript dashboard for the `stockflow-api` Spring Boot backend.

## Live Links

- Dashboard: [https://stock-flow-dashboard.vercel.app](https://stock-flow-dashboard.vercel.app)
- Backend API: [https://stockflow-spring-api.onrender.com](https://stockflow-spring-api.onrender.com)
- Swagger UI: [https://stockflow-spring-api.onrender.com/swagger-ui.html](https://stockflow-spring-api.onrender.com/swagger-ui.html)
- Backend repository: [https://github.com/alvarolomba/stockflow-api](https://github.com/alvarolomba/stockflow-api)

## Demo Access

Use this shared account to explore the deployed dashboard with preloaded products, inventory movements, orders, and reports:

```text
Email: demo@alvarolomba.dev
Password: DemoPassword123!
```

This account contains demo data only. You can also register a new account from the dashboard.

## Features

- JWT login and registration
- Inventory and order metrics overview
- Product creation with SKU, price, stock, and low-stock threshold
- Inventory movement audit trail
- Stock reservation when orders are created
- Order payment and cancellation actions
- Low-stock, sales, and order-status reports
- API health status

## Tech Stack

- React
- TypeScript
- Vite
- Custom CSS
- TanStack Query
- React Hook Form
- Zod
- Lucide React

## Production

The dashboard is deployed on Vercel and talks to the Render-hosted Spring Boot API.

Set this environment variable in Vercel:

```text
VITE_API_BASE_URL=https://stockflow-spring-api.onrender.com
```

The backend must include the deployed frontend URL in `CORS_ALLOWED_ORIGINS`:

```text
https://stock-flow-dashboard.vercel.app
```

## Local Development

Local development is optional. The deployed dashboard and API are the primary demo targets.

Create `.env.local`:

```text
VITE_API_BASE_URL=http://localhost:8080
```

Run the app:

```bash
pnpm install
pnpm dev
```

Open:

```text
http://localhost:5173
```
