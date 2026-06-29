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
    '💳 *Konfirmasi Pembelian:*', '',
    `📦 *${product.name}*`,
    `⏳ Durasi: *${product.durationDays} hari*`,
    `💰 Harga: *Rp${product.price.toLocaleString('id-ID')}*`, '',
    'Klik "Bayar Sekarang" untuk melanjutkan.',
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

  const midtransResult = await createMidtransTransaction({
    orderId, amount: product.price,
    customerName: ctx.from.first_name,
    customerEmail: `${ctx.from.username || 'user'}@t.me`,
  });

  if (!midtransResult.success) return ctx.reply('❌ Gagal membuat transaksi.');

  await prisma.order.update({ where: { id: order.id }, data: { qrCodeUrl: midtransResult.qrCodeUrl } });

  const caption = [
    '✅ *Transaksi Dibuat!*', '',
    `📋 Order ID: \`${orderId}\``,
    `📦 Produk: *${product.name}*`,
    `⏳ Durasi: *${product.durationDays} hari*`,
    `💰 Total: *Rp${product.price.toLocaleString('id-ID')}*`, '',
    'Scan QR di atas untuk membayar.',
    'Link grup Telegram akan dikirim setelah pembayaran berhasil.',
  ].join('\n');

  if (midtransResult.qrCodeUrl) {
    return ctx.replyWithPhoto(midtransResult.qrCodeUrl, {
      caption: caption + `\n\n🔗 [Buka Link QR](${midtransResult.qrCodeUrl})`,
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '📦 Cek Status', callback_data: 'myorders' }], [HOME_BUTTON]] },
    });
  }

  return ctx.reply(caption, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: [[{ text: '📦 Cek Status', callback_data: 'myorders' }], [HOME_BUTTON]] },
  });
}

module.exports = { buyHandler, payHandler };
