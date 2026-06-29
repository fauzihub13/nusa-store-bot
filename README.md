# 🛒 Telegram Store Bot

Bot Telegram untuk jual beli produk digital dengan payment gateway Midtrans.

## Features

- 🛍️ Katalog produk dengan kategori
- 🛒 Keranjang belanja
- 💳 Pembayaran via Midtrans (QRIS, VA, E-Wallet)
- 📦 Auto delivery produk digital
- 📊 Web admin panel
- 👥 Manajemen user

## Prerequisites

- Node.js 18+
- MySQL database
- Telegram Bot Token (via @BotFather)
- Midtrans Account (sandbox untuk testing)

## Setup

### 1. Clone & Install

```bash
cd telegram-store-bot
npm install
```

### 2. Database Setup

Buat database MySQL:

```sql
CREATE DATABASE telegram_store_bot;
```

### 3. Environment Variables

Copy `.env.example` to `.env` dan isi:

```bash
cp .env.example .env
```

Isi variabel:
- `BOT_TOKEN` - Token dari @BotFather
- `MIDTRANS_CLIENT_KEY` - Dari dashboard Midtrans
- `MIDTRANS_SERVER_KEY` - Dari dashboard Midtrans
- `DATABASE_URL` - URL database MySQL

### 4. Database Migration

```bash
npx prisma db push
npx prisma generate
```

### 5. Seed Database

```bash
node prisma/seed.js
```

### 6. Run

```bash
# Development
npm run dev

# Production
npm start
```

## Admin Panel

Akses admin panel di: `http://localhost:3000/admin`

Default login:
- Username: `admin`
- Password: `admin123`

## Telegram Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Mulai bot |
| `/catalog` | Lihat katalog |
| `/cart` | Keranjang belanja |
| `/orders` | Riwayat pesanan |
| `/help` | Bantuan |

## Project Structure

```
telegram-store-bot/
├── server.js                 # Express server
├── prisma/
│   ├── schema.prisma         # Database schema
│   └── seed.js               # Seed data
├── bot/
│   ├── index.js              # Bot setup
│   ├── handlers/             # Command handlers
│   └── utils/midtrans.js     # Midtrans helper
├── routes/
│   ├── api.js                # API (webhook)
│   └── admin.js              # Admin routes
├── views/                    # EJS templates
├── public/css/               # Stylesheets
└── .env                      # Environment variables
```

## Midtrans Webhook

Untuk testing webhook, gunakan Midtrans Dashboard:
1. Login ke https://dashboard.midtrans.com
2. Go to Settings > Webhook
3. Set URL ke: `https://your-domain.com/api/midtrans/notification`

## License

ISC
