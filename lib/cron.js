const cron = require('node-cron');
const prisma = require('../lib/prisma');

function startCronJob(bot) {
  // Setiap jam 5 pagi WIB (UTC+7) = jam 22:00 UTC
  cron.schedule('0 22 * * *', async () => {
    console.log('[CRON] Starting membership check at', new Date().toISOString());

    try {
      const now = new Date();

      // Cari semua order yang delivered dan sudah expired
      const deliveredOrders = await prisma.order.findMany({
        where: { status: 'delivered' },
        include: {
          user: true,
          items: { include: { product: true } },
        },
      });

      let kickedCount = 0;
      let checkedCount = 0;

      for (const order of deliveredOrders) {
        const product = order.items[0]?.product;
        if (!product) continue;

        const durationDays = product.durationDays || 0;
        const expiresAt = new Date(order.createdAt.getTime() + durationDays * 86400000);

        checkedCount++;

        // Cek apakah sudah expired
        if (now >= expiresAt) {
          console.log(`[CRON] Order ${order.orderId} expired on ${expiresAt.toISOString()}`);

          // Update status ke expired
          await prisma.order.update({
            where: { id: order.id },
            data: { status: 'expired' },
          });

          // Kick user dari grup
          const groupId = product.groupId;
          if (groupId) {
            try {
              await bot.api.banChatMember(groupId, String(order.user.telegramId));
              // Unban supaya bisa join lagi kalau beli lagi
              await bot.api.unbanChatMember(groupId, String(order.user.telegramId));
              kickedCount++;
              console.log(`[CRON] Kicked user ${order.user.telegramId} from group ${groupId}`);

              // Kirim notifikasi ke user
              try {
                await bot.api.sendMessage(
                  String(order.user.telegramId),
                  `⏰ *Membership Expired*\n\n` +
                  `📦 Produk: *${product.name}*\n` +
                  `📅 Expired: *${expiresAt.toLocaleDateString('id-ID')}*\n\n` +
                  `Anda telah dikeluarkan dari grup.\n` +
                  `Gunakan /catalog untuk memperpanjang.`,
                  { parse_mode: 'Markdown' }
                );
              } catch (msgError) {
                console.error('[CRON] Failed to notify user:', msgError.message);
              }
            } catch (kickError) {
              console.error(`[CRON] Failed to kick user ${order.user.telegramId}:`, kickError.message);
            }
          }
        }
      }

      console.log(`[CRON] Done. Checked: ${checkedCount}, Kicked: ${kickedCount}`);
    } catch (error) {
      console.error('[CRON] Error:', error);
    }
  }, {
    timezone: 'Asia/Jakarta',
  });

  console.log('[CRON] Membership check scheduled at 05:00 WIB daily');
}

module.exports = { startCronJob };
