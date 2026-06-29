const { Bot, session } = require('grammy');
const { startHandler } = require('./handlers/start');
const { catalogHandler, showProductHandler } = require('./handlers/catalog');
const { buyHandler, payHandler } = require('./handlers/buy');
const { ordersHandler, checkStatusHandler, repayHandler } = require('./handlers/orders');

const bot = new Bot(process.env.BOT_TOKEN);

bot.catch((err) => console.error('[BOT ERROR]', err.message));

bot.use(session({ initial: () => ({ waitingForOrderId: false }) }));

// Commands
bot.command('start', startHandler);
bot.command('catalog', async (ctx) => catalogHandler(ctx));
bot.command('orders', async (ctx) => ordersHandler(ctx));
bot.command('status', async (ctx) => {
  ctx.session.waitingForOrderId = true;
  return ctx.reply('📋 Masukkan Order ID:', { parse_mode: 'Markdown' });
});
bot.command('help', (ctx) => {
  return ctx.reply([
    '🛒 *NusaStore*', '',
    '📋 *Commands:*',
    '/catalog - Lihat produk',
    '/orders - Riwayat pesanan',
    '/status - Cek status pesanan',
    '/help - Bantuan',
  ].join('\n'), { parse_mode: 'Markdown' });
});

// Text handler
bot.on('message:text', async (ctx) => {
  if (ctx.message.text.startsWith('/')) return;
  if (ctx.session.waitingForOrderId) {
    ctx.session.waitingForOrderId = false;
    return checkStatusHandler(ctx, ctx.message.text.trim());
  }
});

// Callback handler
bot.on('callback_query:data', async (ctx) => {
  const data = ctx.callbackQuery.data;
  console.log('[CALLBACK]', data);

  if (data === 'start_menu') return startHandler(ctx);
  if (data === 'back_to_catalog') return catalogHandler(ctx);
  if (data.startsWith('product_')) return showProductHandler(ctx, data.replace('product_', ''));
  if (data.startsWith('buy_')) return buyHandler(ctx, data.replace('buy_', ''));
  if (data.startsWith('pay_')) return payHandler(ctx, data.replace('pay_', ''));
  if (data === 'myorders') return ordersHandler(ctx);
  if (data.startsWith('checkstatus_')) return checkStatusHandler(ctx, data.replace('checkstatus_', ''));
  if (data.startsWith('repay_')) return repayHandler(ctx, data.replace('repay_', ''));
  if (data === 'try_check_status') {
    ctx.session.waitingForOrderId = true;
    return ctx.reply('📋 Masukkan Order ID:', { parse_mode: 'Markdown' });
  }
});

module.exports = { bot };
