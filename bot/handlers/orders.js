const prisma = require('../../lib/prisma');
const { createMidtransTransaction } = require('../utils/midtrans');

const HOME_BUTTON = { text: '🏠 Beranda', callback_data: 'start_menu' };

async function ordersHandler(ctx) {
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(ctx.from.id) } });
  if (!user) return ctx.reply('Silakan /start terlebih dahulu.');

  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    include: { items: { include: { product: true } } },
    orderBy: { createdAt: 'desc' }, take: 10,
  });

  if (orders.length === 0) {
    return ctx.reply('📦 Belum ada pesanan.', {
      reply_markup: { inline_keyboard: [[{ text: '🛒 Lihat Produk', callback_data: 'back_to_catalog' }], [HOME_BUTTON]] },
    });
  }

  const statusEmoji = { pending: '⏳', paid: '✅', delivered: '✅', expired: '⏰', failed: '❌' };
  const lines = ['📦 *Pesanan:*', ''];
  const buttons = [];

  for (const order of orders) {
    const items = order.items.map((i) => i.product.name).join(', ');
    const emoji = statusEmoji[order.status] || '❓';
    lines.push(`${emoji} \`${order.orderId}\` | ${items}`);
    lines.push(`   Rp${order.totalAmount.toLocaleString('id-ID')} | ${order.status.toUpperCase()}`);
    buttons.push([{ text: `${emoji} ${order.orderId}`, callback_data: `checkstatus_${order.orderId}` }]);
    lines.push('');
  }

  buttons.push([{ text: '🛒 Beli Lagi', callback_data: 'back_to_catalog' }]);
  buttons.push([HOME_BUTTON]);

  return ctx.reply(lines.join('\n'), { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } });
}

async function checkStatusHandler(ctx, orderId) {
  if (!orderId) return ctx.reply('❌ Order ID tidak boleh kosong.');

  const order = await prisma.order.findUnique({
    where: { orderId },
    include: { items: { include: { product: true } } },
  });

  if (!order) {
    return ctx.reply(`❌ Order \`${orderId}\` tidak ditemukan.`, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '🔄 Coba Lagi', callback_data: 'try_check_status' }], [HOME_BUTTON]] },
    });
  }

  const product = order.items[0]?.product;
  const durationDays = product?.durationDays || 0;
  const expiresAt = new Date(order.createdAt.getTime() + durationDays * 86400000);
  const now = Date.now();
  const isActive = order.status === 'delivered' && now < expiresAt.getTime();
  const isExpired = order.status === 'delivered' && now >= expiresAt.getTime();

  const statusEmoji = { pending: '⏳', paid: '✅', delivered: '✅', expired: '⏰', failed: '❌' };
  const statusText = {
    pending: 'Menunggu Pembayaran',
    paid: 'Pembayaran Diterima',
    delivered: isActive ? 'Aktif' : 'Expired',
    expired: 'Expired',
    failed: 'Gagal',
  };

  const emoji = isExpired ? '⏰' : statusEmoji[order.status] || '❓';

  const lines = [
    `${emoji} *Detail Pesanan*`, '',
    `📋 ID: \`${order.orderId}\``,
    `📦 ${product?.name || '-'} (${durationDays} hari)`,
    `💰 Rp${order.totalAmount.toLocaleString('id-ID')}`,
    `📊 ${statusText[order.status] || order.status.toUpperCase()}`,
  ];

  if (order.status === 'pending') {
    lines.push('', '💳 Klik tombol di bawah untuk membayar.');
  }

  if (order.status === 'delivered') {
    lines.push(`📅 Expire: *${expiresAt.toLocaleDateString('id-ID')}*`);
    if (order.inviteLink) {
      lines.push('', '🔗 *Link Grup:*', order.inviteLink);
      lines.push('', '⚠️ *PENTING:*');
      lines.push('• Hanya untuk *1 orang*');
      lines.push('• Expired dalam *7 hari*');
      lines.push('• Jangan share');
    }
  }

  const buttons = [];

  if (order.status === 'pending' && order.snapUrl) {
    buttons.push([{ text: '💳 Bayar Sekarang', url: order.snapUrl }]);
  }

  if (order.status === 'delivered' && order.inviteLink) {
    buttons.push([{ text: '🔗 Join Grup', url: order.inviteLink }]);
  }

  buttons.push(
    [{ text: '🔄 Refresh', callback_data: `checkstatus_${order.orderId}` }],
    [{ text: '📦 Pesanan Saya', callback_data: 'myorders' }],
    [HOME_BUTTON],
  );

  return ctx.reply(lines.join('\n'), { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } });
}

async function repayHandler(ctx, orderId) {
  await ctx.answerCallbackQuery({ text: 'Memproses...' });

  const order = await prisma.order.findUnique({
    where: { orderId },
    include: { items: { include: { product: true } }, user: true },
  });

  if (!order) return ctx.reply('❌ Order tidak ditemukan.');
  if (order.status !== 'pending') return ctx.reply('⚠️ Pesanan ini sudah dibayar.');

  const product = order.items[0]?.product;

  // Generate new Snap URL if not exists
  if (!order.snapUrl) {
    const result = await createMidtransTransaction({
      orderId: order.orderId, amount: order.totalAmount,
      customerName: order.user.firstName || order.user.username,
      customerEmail: `${order.user.username || 'user'}@t.me`,
    });

    if (result.success) {
      await prisma.order.update({
        where: { id: order.id },
        data: { snapToken: result.token, snapUrl: result.redirectUrl },
      });
      order.snapUrl = result.redirectUrl;
    }
  }

  const text = [
    '💳 *Bayar Pesanan*', '',
    `📋 ID: \`${order.orderId}\``,
    `📦 ${product?.name || '-'} (${product?.durationDays || 0} hari)`,
    `💰 Rp${order.totalAmount.toLocaleString('id-ID')}`, '',
    'Klik tombol di bawah untuk membayar.',
  ].join('\n');

  if (order.snapUrl) {
    return ctx.reply(text, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '💳 Bayar Sekarang', url: order.snapUrl }],
          [{ text: '🔄 Refresh', callback_data: `checkstatus_${order.orderId}` }],
          [HOME_BUTTON],
        ],
      },
    });
  }

  return ctx.reply('❌ Gagal membuat link pembayaran.', {
    reply_markup: { inline_keyboard: [[HOME_BUTTON]] },
  });
}

module.exports = { ordersHandler, checkStatusHandler, repayHandler };
