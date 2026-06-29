const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { verifyNotification } = require('../bot/utils/midtrans');
const { bot } = require('../bot');

router.post('/midtrans/notification', async (req, res) => {
  console.log('[WEBHOOK] Received:', JSON.stringify(req.body));
  try {
    const result = await verifyNotification(req.body);

    if (!result.success) {
      console.error('[WEBHOOK] Verification failed:', result.error);
      return res.status(400).json({ error: 'Verification failed' });
    }

    console.log('[WEBHOOK] Verified:', result);
    const { orderId, transactionStatus, fraudStatus, paymentType } = result;

    const order = await prisma.order.findUnique({
      where: { orderId },
      include: { user: true, items: { include: { product: true } } },
    });

    if (!order) {
      console.error('[WEBHOOK] Order not found:', orderId);
      return res.status(404).json({ error: 'Order not found' });
    }

    let newStatus = 'pending';
    if ((transactionStatus === 'capture' || transactionStatus === 'settlement') && fraudStatus === 'accept') {
      newStatus = 'paid';
    } else if (transactionStatus === 'deny' || transactionStatus === 'expire' || transactionStatus === 'cancel') {
      newStatus = 'failed';
    }

    console.log('[WEBHOOK] Order:', order.orderId, 'Status:', order.status, '->', newStatus);

    await prisma.order.update({
      where: { id: order.id },
      data: { status: newStatus, paymentType },
    });

    if (newStatus === 'paid') {
      await deliverOrder(order);
    }

    res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('[WEBHOOK] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function deliverOrder(order) {
  try {
    let inviteLink = null;
    const product = order.items[0]?.product;

    if (product?.groupId) {
      try {
        const link = await bot.api.createChatInviteLink(product.groupId, {
          member_limit: 1,
          expire_date: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60),
          name: `Order ${order.orderId}`,
        });
        inviteLink = link.invite_link;
        console.log('[DELIVER] Invite link created:', inviteLink);
      } catch (linkError) {
        console.error('[DELIVER] Failed to create invite link:', linkError.message);
      }
    }

    await prisma.order.update({
      where: { id: order.id },
      data: { status: 'delivered', inviteLink },
    });

    const productName = product?.name || 'Produk';
    const durationDays = product?.durationDays || 0;
    let message = `✅ *Pesanan Berhasil!*` +
      `\n\n📦 *${productName}*` +
      `\n⏳ Durasi: *${durationDays} hari*` +
      `\n📅 Berlaku hingga: *${new Date(Date.now() + durationDays * 86400000).toLocaleDateString('id-ID')}*`;

    if (inviteLink) {
      message += `\n\n🔗 *Link Grup:*\n${inviteLink}` +
        `\n\n⚠️ *PENTING:*` +
        `\n• Link Grup *1 orang*` +
        `\n• Link Grup *Expired *7 hari*` +
        `\n• Jangan share`;
    }

    await bot.api.sendMessage(String(order.user.telegramId), message, { parse_mode: 'Markdown' });
    console.log('[DELIVER] Sent to user:', order.user.telegramId);

    // Report to admin group
    const reportChatId = process.env.STORE_REPORT_ID;
    if (reportChatId) {
      const report = `📊 *LAPORAN TRANSAKSI*` +
        `\n\n👤 *@${order.user.username || '-'}*` +
        `\n📦 ${productName}` +
        `\n💰 Rp${order.totalAmount.toLocaleString('id-ID')}` +
        `\n⏳ ${durationDays} hari` +
        `\n📅 ${new Date().toLocaleString('id-ID')}` +
        `\n📋 \`${order.orderId}\``;

      try {
        await bot.api.sendMessage(reportChatId, report, { parse_mode: 'Markdown' });
        console.log('[DELIVER] Report sent');
      } catch (reportError) {
        console.error('[DELIVER] Failed to send report:', reportError.message);
      }
    }
  } catch (error) {
    console.error('[DELIVER] Error:', error);
  }
}

router.get('/orders/:orderId/status', async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { orderId: req.params.orderId },
    select: { status: true, totalAmount: true },
  });
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

router.get('/test-webhook', (req, res) => {
  res.json({ message: 'OK', timestamp: new Date().toISOString() });
});

module.exports = router;
