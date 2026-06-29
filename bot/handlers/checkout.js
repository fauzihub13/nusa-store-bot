const prisma = require('../../lib/prisma');
const { createMidtransTransaction } = require('../utils/midtrans');

async function checkoutHandler(ctx, action, paymentMethod) {
  const cart = ctx.session.cart || [];

  if (!action) {
    if (cart.length === 0) {
      return ctx.reply('🛒 Keranjang kosong!', {
        reply_markup: {
          inline_keyboard: [[{ text: '🛍️ Lihat Katalog', callback_data: 'back_to_catalog' }]],
        },
      });
    }

    // Calculate total
    const productIds = cart.map((item) => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    let total = 0;
    for (const item of cart) {
      const product = products.find((p) => p.id === item.productId);
      if (product) {
        total += product.price * item.quantity;
      }
    }

    const text = [
      '💳 *Checkout:*',
      '',
      `💰 Total: *Rp${total.toLocaleString('id-ID')}*`,
      '',
      'Metode pembayaran: *QRIS*',
      '',
      'Klik "Bayar Sekarang" untuk melanjutkan.',
    ].join('\n');

    const keyboard = {
      inline_keyboard: [
        [{ text: '💳 Bayar Sekarang (QRIS)', callback_data: 'pay_qris' }],
        [{ text: '🔙 Kembali', callback_data: 'back_to_catalog' }],
      ],
    };

    return ctx.reply(text, {
      parse_mode: 'Markdown',
      ...keyboard,
    });
  }

  // Process payment
  if (action === 'pay') {
    await ctx.answerCallbackQuery({ text: 'Memproses...' });

    // Check stock availability
    for (const item of cart) {
      const stockCount = await prisma.stock.count({
        where: { productId: item.productId, isUsed: false },
      });
      if (stockCount < item.quantity) {
        return ctx.reply('❌ Stok tidak cukup untuk salah satu produk!');
      }
    }

    // Calculate total
    const productIds = cart.map((item) => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    let total = 0;
    const orderItems = [];
    for (const item of cart) {
      const product = products.find((p) => p.id === item.productId);
      if (product) {
        total += product.price * item.quantity;
        orderItems.push({
          productId: item.productId,
          quantity: item.quantity,
          price: product.price,
        });
      }
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(ctx.from.id) },
    });

    if (!user) {
      return ctx.reply('User tidak ditemukan. Silakan /start ulang.');
    }

    // Create order
    const orderId = `ORDER-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const order = await prisma.order.create({
      data: {
        userId: user.id,
        totalAmount: total,
        midtransOrderId: orderId,
        items: {
          create: orderItems,
        },
      },
    });

    // Create Midtrans transaction
    const midtransResult = await createMidtransTransaction({
      orderId: orderId,
      amount: total,
      customerName: ctx.from.first_name,
      customerEmail: `${ctx.from.username || 'user'}@t.me`,
    });

    if (!midtransResult.success) {
      return ctx.reply('❌ Gagal membuat transaksi. Coba lagi nanti.');
    }

    // Update order with Midtrans data
    await prisma.order.update({
      where: { id: order.id },
      data: {
        midtransToken: midtransResult.token,
        snapRedirectUrl: midtransResult.redirectUrl,
      },
    });

    // Clear cart
    ctx.session.cart = [];

    const text = [
      '✅ *Transaksi Dibuat!*',
      '',
      `📋 Order ID: \`${orderId}\``,
      `💰 Total: *Rp${total.toLocaleString('id-ID')}*`,
      '',
      'Klik tombol di bawah untuk membayar:',
    ].join('\n');

    const keyboard = {
      inline_keyboard: [
        [{ text: '💳 Bayar Sekarang', url: midtransResult.redirectUrl }],
        [{ text: '📦 Cek Status Pesanan', callback_data: 'myorders' }],
      ],
    };

    return ctx.reply(text, {
      parse_mode: 'Markdown',
      ...keyboard,
    });
  }
}

module.exports = { checkoutHandler };
