import crypto from 'node:crypto';
import { getDb } from '../_lib/db.js';

export const config = { api: { bodyParser: false } };

async function readForm(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 16 * 1024) throw new Error('Payload too large');
    chunks.push(chunk);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
}

function safeEqualHex(a, b) {
  if (!/^[a-f0-9]{64}$/i.test(a || '') || !/^[a-f0-9]{64}$/i.test(b || '')) return false;
  const aa = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

function hmac(value) {
  return crypto.createHmac('sha256', process.env.DUITKU_API_KEY).update(value).digest('hex');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method Not Allowed');
  }

  let conn;
  try {
    if (!process.env.DUITKU_MERCHANT_CODE || !process.env.DUITKU_API_KEY) {
      throw new Error('Duitku environment variables are not configured');
    }

    const form = await readForm(req);
    const merchantCode = form.get('merchantCode') || '';
    const amount = form.get('amount') || '';
    const merchantOrderId = form.get('merchantOrderId') || '';
    const signature = form.get('signature') || '';
    const resultCode = form.get('resultCode') || '';
    const reference = form.get('reference') || '';

    if (!merchantCode || !amount || !merchantOrderId || !signature || !/^\d+$/.test(amount)) {
      return res.status(400).send('Invalid callback parameters');
    }
    if (merchantCode !== process.env.DUITKU_MERCHANT_CODE) {
      return res.status(403).send('Invalid merchant');
    }

    const expected = hmac(merchantCode + amount + merchantOrderId);
    if (!safeEqualHex(expected, signature)) {
      return res.status(403).send('Invalid signature');
    }

    // A failed/pending callback must never mark an invoice as paid.
    if (resultCode !== '00') return res.status(200).send('SUCCESS');

    // Confirm the transaction against Duitku before touching billing records.
    const baseUrl = (process.env.DUITKU_BASE_URL || 'https://passport.duitku.com').replace(/\/$/, '');
    const verifyResponse = await fetch(`${baseUrl}/webapi/api/merchant/transactionStatus`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchantCode,
        merchantOrderId,
        signature: hmac(merchantCode + merchantOrderId)
      }),
      signal: AbortSignal.timeout(12000)
    });
    if (!verifyResponse.ok) throw new Error(`Duitku status API HTTP ${verifyResponse.status}`);
    const verified = await verifyResponse.json();

    if (
      verified.statusCode !== '00' ||
      verified.merchantOrderId !== merchantOrderId ||
      String(verified.amount) !== String(amount) ||
      (reference && verified.reference && verified.reference !== reference)
    ) {
      throw new Error('Duitku transaction status/amount/reference mismatch');
    }

    const db = getDb();
    conn = await db.getConnection();
    await conn.beginTransaction();

    const [rows] = await conn.execute(
      `SELECT p.id AS payment_id, p.invoice_id, p.amount, p.status AS payment_status,
              i.customer_id, i.status AS invoice_status
       FROM payments p
       INNER JOIN invoices i ON i.id = p.invoice_id
       WHERE p.merchant_order_id = ?
       LIMIT 1 FOR UPDATE`,
      [merchantOrderId]
    );

    if (rows.length !== 1) throw new Error('Local payment record not found');
    const payment = rows[0];
    if (Number(payment.amount) !== Number(amount)) throw new Error('Local payment amount mismatch');

    // Idempotency: duplicate callbacks are acknowledged but not re-applied.
    if (payment.payment_status === 'PAID') {
      await conn.commit();
      return res.status(200).send('SUCCESS');
    }
    if (payment.payment_status !== 'PENDING') throw new Error('Payment is not pending');

    await conn.execute(
      `UPDATE payments
       SET status = 'PAID', duitku_reference = ?, payment_method = ?, paid_at = NOW(), updated_at = NOW()
       WHERE id = ? AND status = 'PENDING'`,
      [reference || verified.reference || null, form.get('paymentCode') || null, payment.payment_id]
    );
    await conn.execute(
      `UPDATE invoices SET status = 'PAID', paid_at = NOW(), updated_at = NOW()
       WHERE id = ? AND status <> 'PAID'`,
      [payment.invoice_id]
    );

    // Clear isolation only if there is no other overdue unpaid invoice.
    await conn.execute(
      `UPDATE customers c
       SET c.is_isolated = 0, c.updated_at = NOW()
       WHERE c.id = ?
         AND NOT EXISTS (
           SELECT 1 FROM invoices i
           WHERE i.customer_id = c.id
             AND i.status <> 'PAID'
             AND i.due_date < CURRENT_DATE()
         )`,
      [payment.customer_id]
    );

    await conn.commit();
    return res.status(200).send('SUCCESS');
  } catch (error) {
    if (conn) {
      try { await conn.rollback(); } catch {}
    }
    console.error('Duitku callback processing error:', error.message);
    return res.status(500).send('Callback processing failed');
  } finally {
    if (conn) conn.release();
  }
}
