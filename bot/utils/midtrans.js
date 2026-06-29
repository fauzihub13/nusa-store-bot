const axios = require('axios');
const crypto = require('crypto');

const MIDTRANS_SNAP_URL = process.env.MIDTRANS_IS_PRODUCTION === 'true'
  ? 'https://app.midtrans.com/snap/v1/transactions'
  : 'https://app.sandbox.midtrans.com/snap/v1/transactions';

const MIDTRANS_API_URL = process.env.MIDTRANS_IS_PRODUCTION === 'true'
  ? 'https://api.midtrans.com'
  : 'https://api.sandbox.midtrans.com';

const serverKey = process.env.MIDTRANS_SERVER_KEY;
const auth = Buffer.from(`${serverKey}:`).toString('base64');

async function createMidtransTransaction({ orderId, amount, customerName, customerEmail }) {
  try {
    const payload = {
      transaction_details: {
        order_id: orderId,
        gross_amount: amount,
      },
      item_details: [
        { id: orderId, price: amount, quantity: 1, name: `Order ${orderId}` },
      ],
      customer_details: {
        first_name: customerName,
        email: customerEmail,
      },
      callbacks: {
        finish: process.env.FINISH_REDIRECT_URL || `${process.env.BASE_URL}/admin/orders`,
      },
      custom_expiry: {
        order_time: new Date().toISOString(),
        expiry_duration: 6,
        unit: 'hour',
      },
    };

    console.log('[MIDTRANS] Snap request:', JSON.stringify(payload, null, 2));

    const response = await axios.post(MIDTRANS_SNAP_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
    });

    const data = response.data;
    console.log('[MIDTRANS] Snap response:', JSON.stringify(data, null, 2));

    return {
      success: true,
      token: data.token,
      redirectUrl: data.redirect_url,
    };
  } catch (error) {
    console.error('[MIDTRANS] Error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.status_message || error.message,
    };
  }
}

async function verifyNotification(notification) {
  try {
    const { order_id, status_code, gross_amount, signature_key } = notification;

    const expectedSignature = crypto
      .createHash('sha512')
      .update(`${order_id}${status_code}${gross_amount}${serverKey}`)
      .digest('hex');

    if (signature_key && signature_key !== expectedSignature) {
      return { success: false, error: 'Invalid signature' };
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
    console.error('[VERIFY] Error:', error);
    return { success: false, error: error.message };
  }
}

module.exports = { createMidtransTransaction, verifyNotification };
