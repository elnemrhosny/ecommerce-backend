# ShopName — Ecommerce Backend

An Express REST API powering the ShopName ecommerce storefront, with MySQL persistence, cookie-based authentication, image uploads, reviews, and payment integration.

**Live store:** [ecommerce-frontend-two-blush.vercel.app](https://ecommerce-frontend-two-blush.vercel.app/)

This repository contains the API. The store link above opens the frontend.

## Features

- Product and category queries, filters, and administrative management.
- Email/password authentication and Google sign-in.
- JWT authentication using HTTP-only cookies and role-protected admin endpoints.
- Email verification through SMTP.
- Guest and signed-in shopping bags, wishlists, and order management.
- Product reviews, including validation and owner-scoped updates and deletion.
- Cloudinary image uploads and image management.
- Paymob checkout creation and payment callbacks.
- Centralized error handling and regression tests.

## Tech stack

Node.js · Express 5 · MySQL/mysql2 · Joi · JWT · bcrypt · Cloudinary · Multer · Nodemailer · Google Auth Library · Paymob

## Getting started

Use Node.js 22.12 or newer and npm for a consistent runtime across the frontend and backend.

Install dependencies from the backend repository:

```bash
npm ci
```

Create a `.env` file with your service credentials:

```dotenv
# MySQL — use the host and port supplied by your provider
DB_HOST=your-database-host
DB_PORT=3306
DB_USER=your-database-user
DB_PASSWORD=your-database-password
DB_NAME=your-database-name

# Authentication
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=7d
GOOGLE_CLIENT_ID=your-google-oauth-client-id

# Application URLs — local development examples
CLIENT_URL=http://localhost:5173
BACKEND_URL=http://localhost:8000

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# SMTP — the current transporter uses secure=false
EMAIL_HOST=your-smtp-host
EMAIL_PORT=587
EMAIL_USER=your-smtp-user
EMAIL_PASS=your-smtp-password

# Paymob
PAYMOB_SECRET_KEY=your-paymob-secret-key
PAYMOB_PUBLIC_KEY=your-paymob-public-key
PAYMOB_CARD_INTEGRATION_ID=your-card-integration-id
PAYMOB_HMAC_SECRET=your-callback-hmac-secret
```

Keep `.env` out of version control. Configure the Google, Cloudinary, SMTP, and Paymob values to use their respective features.

### Database setup

The API expects an existing MySQL schema; this repository does not include schema creation or migration scripts. Queries use MySQL's `UUID_TO_BIN` and `BIN_TO_UUID` functions, so use a compatible MySQL 8+ database.

The connection pool in `db.js` enables TLS and loads the database provider's CA certificate from:

```text
config/ca.pem
```

Ensure that certificate matches your database provider. The application uses tables for users, categories, products, product images, carts, cart items, wishlists, reviews, orders, order items, and email verification tokens.

### Start the API

```bash
npm start
```

The server currently listens on **port 8000**, configured in `app.js`.

## Commands

| Command | Description |
| --- | --- |
| `npm start` | Start the Express API. |
| `npm test` | Run tests in `tests/`, including product, review, ownership, validation, and error-handling regressions. |

Automated tests mock database operations and do not send email or modify the live database. The standalone `test.js` is a separate manual SMTP test and is not run by `npm test`.

## API overview

Route paths below are relative to the API origin.

| Route group | Purpose |
| --- | --- |
| `/products` | Product lookup, filtering, sorting, and pagination |
| `/categories` | Category queries |
| `/users` | Registration, login/logout, Google sign-in, profile changes, and email verification |
| `/carts` | Shopping bag items and quantities |
| `/wishlists` | Saved products |
| `/reviews` | Product/user review queries and review mutations |
| `/orders` | Orders and payment status |
| `/checkout` | Paymob checkout and callbacks |
| `/admin` | Protected product, image, category, and order management |

### Authentication endpoints

```text
POST /users/register
POST /users/login
POST /users/google
POST /users/logout
GET  /users/auth
GET  /users/verify-email?token=...
POST /users/resend-token
```

The frontend sends cookies using Axios `withCredentials: true`. Cookie options in `functions/authentication.js` include `httpOnly`, `secure`, `SameSite=None`, and partitioning. Local testing must use a browser/setup compatible with those settings.

### Reviews

```text
GET    /reviews/product?product_id=PRODUCT_UUID
GET    /reviews/user
POST   /reviews
PATCH  /reviews
DELETE /reviews/:review_id
```

Creating a review requires `product_id` and `rating`, with an optional `comment`. Updating requires `review_id` and at least one of `rating` or `comment`. Authentication and ownership are enforced on mutation endpoints. Product review lists include `reviewer_name` for display in the storefront.

### Checkout

`POST /checkout/create-session` creates a Paymob checkout session for an authenticated user. `POST /checkout/callback` receives payment notifications and validates their HMAC.

`BACKEND_URL` must be reachable by Paymob for callbacks. `CLIENT_URL` is used for the return to `/order-status` and for email-verification links. Payment intentions currently default to EGP in `functions/paymob.js`; frontend price formatting is configured separately.

## Production configuration

Set the frontend origin without a trailing slash:

```dotenv
CLIENT_URL=https://ecommerce-frontend-two-blush.vercel.app
BACKEND_URL=https://your-deployed-api-domain
```

CORS in `app.js` allows `CLIENT_URL` and the configured local development origins. Add any additional preview or custom-domain origins deliberately. Configure the frontend's `VITE_SERVER_URL` to point to this API.

Configure an authorized email sender in `functions/emails.js`, the provider's database CA, and the relevant Google OAuth origins and Paymob callback settings. Deploy backend review changes together with the matching frontend, then verify database connectivity, real authentication, email delivery, uploads, and payments against the configured services.

## Project structure

```text
app.js            Express setup, CORS, route mounting, and server startup
db.js             MySQL connection pool and TLS configuration
routes/           HTTP endpoints
functions/        Validation, database access, authentication, and service helpers
middlewares/      Upload handling and shared error handling
config/           Database CA and Google client configuration
tests/            Automated regression tests
```
