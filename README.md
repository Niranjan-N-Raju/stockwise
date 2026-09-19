# Stockwise

FEFO inventory management built with Next.js and MongoDB. Stock is grouped by SKU and expiry date, and the API prevents later-expiring stock from being used first.

## MongoDB Atlas setup

1. Create a cluster and database user in MongoDB Atlas.
2. Add your development IP address under Atlas Network Access.
3. Copy `.env.example` to `.env.local` and replace the placeholders with the Atlas connection string.
4. Keep `MONGODB_DB=inventory_management`, or choose another database name.

Never commit `.env.local`. If a password contains reserved URI characters such as `@`, `:`, `/`, or `#`, URL-encode it in the connection string.

## Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). If that port is occupied, Next.js prints the selected port.

Demo login:

- Username: `admin`
- Password: `inventory123`

Inventory is stored in the `inventory_items` collection in MongoDB Atlas. Receipts with the same SKU and expiry date are combined automatically.

## Commands

```bash
npm run dev
npm run build
npm run lint
```
