const prisma = require("../../lib/prisma");
const { createMidtransTransaction } = require("../utils/midtrans");

const HOME_BUTTON = { text: "🏠 Beranda", callback_data: "start_menu" };

async function ordersHandler(ctx) {
  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(ctx.from.id) },
  });
  if (!user) return ctx.reply("Silakan /start terlebih dahulu.");

  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    include: { items: { include: { product: true } } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  if (orders.length === 0) {
    return ctx.reply("📦 Belum ada pesanan.", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🛒 Lihat Produk", callback_data: "back_to_catalog" }],
          [HOME_BUTTON],
        ],
      },
    });
  }

  const statusEmoji = {
    pending: "⏳",
    paid: "✅",
    delivered: "✅",
    expired: "⏰",
    failed: "❌",
  };
  const lines = ["📦 *Riwayat Pesanan:*", ""];
  const buttons = [];

  for (const order of orders) {
    const items = order.items
      .map((i) => `${i.product.name} x${i.quantity}`)
      .join(", ");
    const emoji = statusEmoji[order.status] || "❓";
    lines.push(`${emoji} *${order.orderId}*`);
    lines.push(`   ${items} | Rp${order.totalAmount.toLocaleString("id-ID")}`);
    lines.push(`   ${order.status.toUpperCase()}`);
    buttons.push([
      {
        text: `${emoji} Cek ${order.orderId}`,
        callback_data: `checkstatus_${order.orderId}`,
      },
    ]);
    lines.push("");
  }

  buttons.push([{ text: "🛒 Beli Lagi", callback_data: "back_to_catalog" }]);
  buttons.push([HOME_BUTTON]);

  return ctx.reply(lines.join("\n"), {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: buttons },
  });
}

async function checkStatusHandler(ctx, orderId) {
  if (!orderId) return ctx.reply("❌ Order ID tidak boleh kosong.");

  const order = await prisma.order.findUnique({
    where: { orderId },
    include: { items: { include: { product: true } } },
  });

  if (!order) {
    return ctx.reply(`❌ Order *${orderId}* tidak ditemukan.`, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔄 Coba Lagi", callback_data: "try_check_status" }],
          [HOME_BUTTON],
        ],
      },
    });
  }

  const statusEmoji = {
    pending: "⏳",
    paid: "✅",
    delivered: "✅",
    expired: "⏰",
    failed: "❌",
  };
  const statusText = {
    pending: "Menunggu Pembayaran",
    paid: "Pembayaran Diterima",
    delivered: "Aktif",
    expired: "Kadaluarsa",
    failed: "Gagal",
  };
  const emoji = statusEmoji[order.status] || "❓";
  const items = order.items
    .map((i) => `${i.product.name} (${i.product.durationDays} hari)`)
    .join(", ");

  const lines = [
    `${emoji} *Status Pesanan*`,
    "",
    `📋 Order ID: \`${order.orderId}\``,
    `📦 Produk: ${items}`,
    `💰 Total: Rp${order.totalAmount.toLocaleString("id-ID")}`,
    `📊 Status: *${statusText[order.status] || order.status.toUpperCase()}*`,
    `📅 Dibuat: ${order.createdAt.toLocaleString("id-ID")}`,
  ];

  if (order.status === "delivered" && order.inviteLink) {
    lines.push("", "🔗 *Link Grup Telegram:*", order.inviteLink);
    lines.push("", "⚠️ *PENTING:*");
    lines.push("• Link ini hanya untuk *1 orang*");
    lines.push("• Link *expired dalam 7 hari*");
    lines.push("• Jangan share ke orang lain");
  }

  const buttons = [];
  if (order.status === "pending") {
    buttons.push([
      { text: "💳 Bayar Sekarang", callback_data: `repay_${order.orderId}` },
    ]);
  }
  if (order.status === "delivered" && order.inviteLink) {
    buttons.push([{ text: "🔗 Join Grup", url: order.inviteLink }]);
  }
  buttons.push(
    [{ text: "🔄 Refresh", callback_data: `checkstatus_${order.orderId}` }],
    [{ text: "📦 Pesanan Saya", callback_data: "myorders" }],
    [HOME_BUTTON],
  );

  return ctx.reply(lines.join("\n"), {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: buttons },
  });
}

async function repayHandler(ctx, orderId) {
  await ctx.answerCallbackQuery({ text: "Memproses..." });

  const order = await prisma.order.findUnique({
    where: { orderId },
    include: { items: { include: { product: true } }, user: true },
  });

  if (!order) return ctx.reply("❌ Order tidak ditemukan.");
  if (order.status !== "pending")
    return ctx.reply("⚠️ Pesanan ini tidak dapat dibayar.");

  const items = order.items
    .map((i) => `${i.product.name} x${i.quantity}`)
    .join(", ");
  const caption = [
    "💳 *Bayar Pesanan*",
    "",
    `📋 Order ID: \`${order.orderId}\``,
    `📦 Produk: ${items}`,
    `💰 Total: *Rp${order.totalAmount.toLocaleString("id-ID")}*`,
    "",
    "Scan QR di atas untuk membayar.",
  ].join("\n");

  if (order.qrCodeUrl) {
    return ctx.replyWithPhoto(order.qrCodeUrl, {
      caption: caption + `\n\n🔗 [Buka Link QR](${order.qrCodeUrl})`,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🔄 Refresh",
              callback_data: `checkstatus_${order.orderId}`,
            },
          ],
          [HOME_BUTTON],
        ],
      },
    });
  }

  const midtransResult = await createMidtransTransaction({
    orderId: order.orderId,
    amount: order.totalAmount,
    customerName: order.user.firstName || order.user.username,
    customerEmail: `${order.user.username || "user"}@t.me`,
  });

  if (!midtransResult.success) return ctx.reply("❌ Gagal membuat transaksi.");

  await prisma.order.update({
    where: { id: order.id },
    data: { qrCodeUrl: midtransResult.qrCodeUrl },
  });

  if (midtransResult.qrCodeUrl) {
    return ctx.replyWithPhoto(midtransResult.qrCodeUrl, {
      caption: caption + `\n\n🔗 [Buka Link QR](${midtransResult.qrCodeUrl})`,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🔄 Refresh",
              callback_data: `checkstatus_${order.orderId}`,
            },
          ],
          [HOME_BUTTON],
        ],
      },
    });
  }

  return ctx.reply(caption, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔄 Refresh", callback_data: `checkstatus_${order.orderId}` }],
        [HOME_BUTTON],
      ],
    },
  });
}

module.exports = { ordersHandler, checkStatusHandler, repayHandler };
