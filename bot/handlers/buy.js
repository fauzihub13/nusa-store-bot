const prisma = require('../../lib/prisma');
const { createMidtransTransaction } = require('../utils/midtrans');

const HOME_BUTTON = { text: '🏠 Beranda', callback_data: 'start_menu' };

async function buyHandler(ctx, productId) {
  const pid = parseInt(productId);
  const product = await prisma.product.findUnique({ where: { id: pid } });
  if (!product) return ctx.reply('Produk tidak ditemukan.');

  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(ctx.from.id) } });
  if (!user) return ctx.reply('Silakan /start terlebih dahulu.');

  const text = [
    '🛒 *Konfirmasi Pembelian*', '',
    `📦 *${product.name}*`,
    `⏳ Durasi: *${product.durationDays} hari*`,
    `💰 Harga: *Rp${product.price.toLocaleString('id-ID')}*`, '',
    'Klik "Bayar Sekarang" untuk membuat tagihan.',
  ].join('\n');

  const keyboard = {
    inline_keyboard: [
      [{ text: `💳 Bayar Sekarang - Rp${product.price.toLocaleString('id-ID')}`, callback_data: `pay_${pid}` }],
      [{ text: '🔙 Batal', callback_data: `product_${pid}` }],
      [HOME_BUTTON],
    ],
  };

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery();
    try { return await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard }); }
    catch (e) { return await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard }); }
  }
  return ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
}

async function payHandler(ctx, productId) {
  const pid = parseInt(productId);
  await ctx.answerCallbackQuery({ text: 'Memproses...' });

  const product = await prisma.product.findUnique({ where: { id: pid } });
  if (!product) return ctx.reply('Produk tidak ditemukan.');

  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(ctx.from.id) } });
  if (!user) return ctx.reply('Silakan /start ulang.');

  const shortId = Math.random().toString(36).substr(2, 6).toUpperCase();
  const orderId = `NS-${shortId}`;

  const order = await prisma.order.create({
    data: {
      userId: user.id, totalAmount: product.price, orderId,
      items: { create: { productId: pid, quantity: 1, price: product.price } },
    },
  });

  const result = await createMidtransTransaction({
    orderId, amount: product.price,
    customerName: ctx.from.first_name,
    customerEmail: `${ctx.from.username || 'user'}@t.me`,
  });

  if (!result.success) {
    return ctx.reply(`❌ Gagal membuat tagihan: ${result.error}`);
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { snapToken: result.token, snapUrl: result.redirectUrl },
  });

  const text = [
    '✅ *Tagihan Dibuat*', '',
    `📋 ID: \`${orderId}\``,
    `📦 ${product.name} (${product.durationDays} hari)`,
    `💰 Rp${product.price.toLocaleString('id-ID')}`, '',
    'Klik tombol di bawah untuk memilih metode pembayaran (QRIS, VA, E-Wallet).',
  ].join('\n');

  return ctx.reply(text, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '💳 Bayar Sekarang', url: result.redirectUrl }],
        [{ text: '📦 Cek Status', callback_data: 'myorders' }],
        [HOME_BUTTON],
      ],
    },
  });
}

module.exports = { buyHandler, payHandler };
