const prisma = require('../../lib/prisma');

async function cartHandler(ctx, action, productId) {
  // Show cart
  if (!action) {
    return ctx.reply('🛒 Keranjang tidak tersedia. Silakan beli langsung.', {
      reply_markup: {
        inline_keyboard: [[{ text: '🛍️ Lihat Katalog', callback_data: 'back_to_catalog' }]],
      },
    });
  }

  // Add to cart - redirect to buy
  if (action === 'add') {
    return buyHandler(ctx, productId);
  }

  // Remove from cart - not used
  if (action === 'remove') {
    return ctx.answerCallbackQuery({ text: 'Fitur tidak tersedia' });
  }
}

module.exports = { cartHandler };
