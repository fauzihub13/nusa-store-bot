const prisma = require('../../lib/prisma');

const HOME_BUTTON = { text: '🏠 Beranda', callback_data: 'start_menu' };

async function catalogHandler(ctx) {
  const products = await prisma.product.findMany({
    where: { isActive: true },
  });

  if (products.length === 0) {
    return ctx.reply('Belum ada produk tersedia.', {
      reply_markup: { inline_keyboard: [[HOME_BUTTON]] },
    });
  }

  const keyboard = products.map((p) => [
    {
      text: `${p.name} - Rp${p.price.toLocaleString('id-ID')} (${p.durationDays} hari)`,
      callback_data: `product_${p.id}`,
    },
  ]);
  keyboard.push([HOME_BUTTON]);

  const text = '🛒 *Pilih Produk:*';

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery();
    try {
      return await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboard } });
    } catch (e) {
      return await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboard } });
    }
  }
  return ctx.reply(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboard } });
}

async function showProductHandler(ctx, productId) {
  const product = await prisma.product.findUnique({
    where: { id: parseInt(productId) },
  });

  if (!product) return ctx.reply('Produk tidak ditemukan.');

  const text = [
    `📦 *${product.name}*`,
    '',
    product.description || '',
    '',
    `💰 Harga: *Rp${product.price.toLocaleString('id-ID')}*`,
    `⏳ Durasi: *${product.durationDays} hari*`,
  ].join('\n');

  const keyboard = {
    inline_keyboard: [
      [{ text: `💳 Beli Sekarang - Rp${product.price.toLocaleString('id-ID')}`, callback_data: `buy_${product.id}` }],
      [{ text: '🔙 Kembali', callback_data: 'back_to_catalog' }],
      [HOME_BUTTON],
    ],
  };

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery();
    try {
      return await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
    } catch (e) {
      return await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
    }
  }
  return ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
}

module.exports = { catalogHandler, showProductHandler };
