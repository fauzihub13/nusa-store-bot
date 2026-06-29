const axios = require('axios');
const crypto = require('crypto');

const MIDTRANS_API_URL = process.env.MIDTRANS_IS_PRODUCTION === 'true'
  ? 'https://api.midtrans.com'
  : 'https://api.sandbox.midtrans.com';

const serverKey = process.env.MIDTRANS_SERVER_KEY;
const auth = Buffer.from(`${serverKey}:`).toString('base64');

async function createMidtransTransaction({ orderId, amount, customerName, customerEmail }) {
  try {
    const notificationUrl = process.env.NOTIFICATION_URL || `${process.env.BASE_URL}/api/midtrans/notification`;

    const payload = {
      payment_type: 'qris',
      transaction_details: {
        order_id: orderId,
        gross_amount: amount,
      },
      item_details: [
        {
          id: orderId,
          price: amount,
          quantity: 1,
          name: `Order ${orderId}`,
        },
      ],
      customer_details: {
        first_name: customerName,
        email: customerEmail,
      },
      callbacks: {
        finish: process.env.FINISH_REDIRECT_URL || `${process.env.BASE_URL}/admin/orders`,
      },
    };

    const response = await axios.post(`${MIDTRANS_API_URL}/v2/charge`, payload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
    });

    const data = response.data;

    // Extract QR code URL from actions
    let qrCodeUrl = null;
    if (data.actions) {
      const qrAction = data.actions.find((a) => a.name === 'generate-qr-code');
      if (qrAction) {
        qrCodeUrl = qrAction.url;
      }
    }

    return {
      success: true,
      transactionId: data.transaction_id,
      orderId: data.order_id,
      qrCodeUrl,
      redirectUrl: qrCodeUrl || null,
      rawResponse: data,
    };
  } catch (error) {
    console.error('Midtrans error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

async function verifyNotification(notification) {
  try {
    const { order_id, status_code, gross_amount, signature_key } = notification;

    // Handle notification without signature (Core API)
    if (!signature_key) {
      console.log('[VERIFY] No signature_key, accepting notification');
      return {
        success: true,
        orderId: notification.order_id,
        transactionStatus: notification.transaction_status,
        fraudStatus: notification.fraud_status || 'accept',
        paymentType: notification.payment_type,
        grossAmount: notification.gross_amount,
      };
    }

    // Verify signature
    const expectedSignature = crypto
      .createHash('sha512')
      .update(`${order_id}${status_code}${gross_amount}${serverKey}`)
      .digest('hex');

    if (signature_key !== expectedSignature) {
      console.log('[VERIFY] Signature mismatch:', { expected: expectedSignature, received: signature_key });
      return {
        success: false,
        error: 'Invalid signature',
      };
    }

    return {
      success: true,
      orderId: notification.order_id,
      transactionStatus: notification.transaction_status,
      fraudStatus: notification.fraud_status,
      paymentType: notification.payment_type,
      grossAmount: notification.gross_amount,
    };
  } catch (error) {
    console.error('Notification verification error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

module.exports = { createMidtransTransaction, verifyNotification };
