# NusaStore - Telegram Store Bot

Bot Telegram untuk menjual akses premium grup Telegram dengan pembayaran QRIS via Midtrans.

## Fitur

- Bot Telegram untuk jual beli langganan
- Pembayaran via QRIS (Midtrans Core API)
- Auto generate link undangan grup Telegram (1 orang, expired 7 hari)
- Auto delivery setelah pembayaran berhasil
- Admin panel untuk manage produk, pesanan, dan user
- Laporan transaksi otomatis ke grup admin

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Bot:** GrammY
- **Database:** MySQL + Prisma ORM
- **Payment:** Midtrans Core API (QRIS)
- **Template:** EJS

## Setup

### 1. Clone & Install

```bash
git clone <repo-url>
cd telegram-store-bot
npm install
```

### 2. Database

```bash
# Buat database MySQL
mysql -u root -e "CREATE DATABASE telegram_store_bot;"

# Push schema
npx prisma db push

# Seed data
node prisma/seed.js
```

### 3. Environment Variables

Buat file `.env`:

```env
# Telegram Bot (dari @BotFather)
BOT_TOKEN=your_bot_token

# Midtrans (dari dashboard.midtrans.com)
MIDTRANS_CLIENT_KEY=SB-Mid-client-xxx
MIDTRANS_SERVER_KEY=SB-Mid-server-xxx
MIDTRANS_IS_PRODUCTION=false

# Database
DATABASE_URL="mysql://root:@localhost:3306/telegram_store_bot"

# Telegram Group ID (untuk generate invite link)
TELEGRAM_GROUP_ID=-1001234567890

# Grup Laporan Admin (untuk kirim laporan transaksi)
STORE_REPORT_ID=-1009876543210

# Server
PORT=3000
BASE_URL=https://your-domain.com

# Admin Panel
ADMIN_USERNAME=nusakece
ADMIN_PASSWORD=NusaJosjis2025

# Session
SESSION_SECRET=your_secret_key
```

### 4. Jalankan

```bash
npm start
```

Bot dan admin panel akan jalan di port 3000.

## Cara Pakai Bot

### User Commands

| Command | Fungsi |
|---------|--------|
| `/start` | Mulai bot, register user |
| `/catalog` | Lihat semua produk |
| `/orders` | Riwayat pesanan |
| `/status` | Cek status pesanan (input order ID) |
| `/help` | Bantuan |

### Flow Pembelian

1. User kirim `/catalog`
2. Pilih produk
3. Klik "Beli Sekarang"
4. Konfirmasi, klik "Bayar Sekarang"
5. Scan QR Code QRIS
6. Pembayaran berhasil → Auto kirim link grup Telegram
7. Laporan terkirim ke grup admin

## Admin Panel

Akses: `http://localhost:3000/admin`

### Login

- Username: `nusakece`
- Password: `NusaJosjis2025`

### Menu

| Menu | Fungsi |
|------|--------|
| Dashboard | Statistik + pesanan terbaru dengan info pembeli |
| Produk | CRUD produk, toggle on/off |
| Pesanan | Daftar semua pesanan + status membership + tanggal expire |
| Users | Daftar user terdaftar |

### Produk Fields

| Field | Keterangan |
|-------|------------|
| Nama | Nama produk |
| Deskripsi | Deskripsi produk |
| Harga | Harga dalam Rupiah |
| Durasi | Masa aktif dalam hari |
| Group ID | ID grup Telegram (untuk generate invite link) |
| Status | ON/OFF (hanya yang ON muncul di bot) |

## Database Schema

```
User
├── id
├── telegramId (unique)
├── username
├── firstName
├── lastName
├── role
└── createdAt

Product
├── id
├── name
├── description
├── price
├── durationDays
├── groupId
├── isActive
└── createdAt

Order
├── id
├── userId
├── totalAmount
├── status (pending/paid/delivered/failed)
├── paymentMethod
├── orderId (unique)
├── qrCodeUrl
├── inviteLink
├── createdAt
└── updatedAt

OrderItem
├── id
├── orderId
├── productId
├── quantity
└── price
```

## Webhook Midtrans

Set **Payment Notification URL** di Midtrans Dashboard:

```
https://your-domain.com/api/midtrans/notification
```

Atau gunakan ngrok untuk testing:

```bash
ngrok http 3000
```

Lalu update `BASE_URL` di `.env` dengan URL ngrok.

## Deployment

### Railway / Render / VPS

1. Push code ke GitHub
2. Deploy ke platform pilihan
3. Set environment variables
4. Install dependencies: `npm install`
5. Push database: `npx prisma db push`
6. Start: `npm start`

### PM2 (VPS)

```bash
npm install -g pm2
pm2 start server.js --name nusastore
pm2 save
pm2 startup
```

## Troubleshooting

| Masalah | Solusi |
|---------|--------|
| Bot tidak merespon | Cek BOT_TOKEN valid |
| QR Code tidak muncul | Cek MIDTRANS keys |
| Webhook tidak masuk | Set Payment Notification URL di Midtrans Dashboard |
| Invite link gagal | Cek TELEGRAM_GROUP_ID dan bot adalah admin grup |
| Laporan tidak terkirim | Cek STORE_REPORT_ID |

## License

ISC
