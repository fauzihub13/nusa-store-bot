const prisma = require('../../lib/prisma');

async function startHandler(ctx) {
  const telegramId = ctx.from.id;

  let user = await prisma.user.findUnique({ where: { telegramId: BigInt(telegramId) } });
  if (!user) {
    user = await prisma.user.create({
      data: { telegramId: BigInt(telegramId), username: ctx.from.username, firstName: ctx.from.first_name, lastName: ctx.from.last_name },
    });
  }

  const text = [
    `Selamat datang, *${ctx.from.first_name}*!`, '',
    '🛒 *NusaStore*', 'Akses premium grup Telegram.', '',
    '📋 *Commands:*',
    '/catalog - Lihat produk',
    '/orders - Riwayat pesanan',
    '/status - Cek status pesanan',
  ].join('\n');

  const keyboard = {
    inline_keyboard: [
      [{ text: '🛒 Lihat Produk', callback_data: 'back_to_catalog' }],
      [{ text: '📦 Pesanan Saya', callback_data: 'myorders' }],
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

module.exports = { startHandler };
