import pool from '../database/connection.js';
import { authorizeTransaction, captureTransaction, refundTransaction } from '../services/mockAcquirer.js';

// Authorize a payment
export const authorizePayment = async (req, res) => {
  try {
    const { paymentMethodId, amount, currency, description } = req.body;
    const userId = req.user.id;

    // Get payment method details
    const paymentMethodResult = await pool.query(
      'SELECT * FROM payment_methods WHERE id = $1 AND user_id = $2',
      [paymentMethodId, userId]
    );

    if (paymentMethodResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Payment method not found'
      });
    }

    const paymentMethod = paymentMethodResult.rows[0];

    // Create transaction record
    const transactionResult = await pool.query(
      `INSERT INTO transactions (user_id, payment_method_id, amount, currency, status, transaction_type, description)
       VALUES ($1, $2, $3, $4, 'pending', 'authorize', $5)
       RETURNING *`,
      [userId, paymentMethodId, amount, currency, description]
    );

    const transaction = transactionResult.rows[0];

    // Call mock acquirer
    const acquirerResponse = await authorizeTransaction({
      amount,
      currency,
      lastFour: paymentMethod.last_four,
      brand: paymentMethod.brand,
      expiryMonth: paymentMethod.expiry_month,
      expiryYear: paymentMethod.expiry_year
    });

    // Update transaction based on acquirer response
    const status = acquirerResponse.success ? 'authorized' : 'failed';
    const updateResult = await pool.query(
      `UPDATE transactions 
       SET status = $1, external_id = $2, metadata = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [
        status,
        acquirerResponse.transaction_id,
        JSON.stringify(acquirerResponse),
        transaction.id
      ]
    );

    const updatedTransaction = updateResult.rows[0];

    // Log transaction
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, new_values, ip_address, user_agent)
       VALUES ($1, 'payment_authorized', 'transaction', $2, $3, $4, $5)`,
      [
        userId,
        transaction.id,
        JSON.stringify({ amount, currency, status }),
        req.ip,
        req.get('User-Agent')
      ]
    );

    res.json({
      success: acquirerResponse.success,
      message: acquirerResponse.success ? 'Payment authorized successfully' : 'Payment authorization failed',
      data: {
        transaction: {
          id: updatedTransaction.id,
          amount: updatedTransaction.amount,
          currency: updatedTransaction.currency,
          status: updatedTransaction.status,
          externalId: updatedTransaction.external_id,
          createdAt: updatedTransaction.created_at
        },
        acquirerResponse: {
          responseCode: acquirerResponse.response_code,
          responseMessage: acquirerResponse.response_message,
          authCode: acquirerResponse.auth_code
        }
      }
    });
  } catch (error) {
    console.error('Authorization error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Capture an authorized payment
export const capturePayment = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { amount } = req.body;
    const userId = req.user.id;

    // Get the authorized transaction
    const transactionResult = await pool.query(
      'SELECT * FROM transactions WHERE id = $1 AND user_id = $2 AND status = $3',
      [transactionId, userId, 'authorized']
    );

    if (transactionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Authorized transaction not found'
      });
    }

    const transaction = transactionResult.rows[0];

    // Call mock acquirer for capture
    const acquirerResponse = await captureTransaction(transaction.external_id, amount);

    // Update transaction status
    const status = acquirerResponse.success ? 'captured' : 'failed';
    const updateResult = await pool.query(
      `UPDATE transactions 
       SET status = $1, metadata = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [status, JSON.stringify(acquirerResponse), transactionId]
    );

    const updatedTransaction = updateResult.rows[0];

    // Log capture
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, new_values, ip_address, user_agent)
       VALUES ($1, 'payment_captured', 'transaction', $2, $3, $4, $5)`,
      [
        userId,
        transactionId,
        JSON.stringify({ amount, status }),
        req.ip,
        req.get('User-Agent')
      ]
    );

    res.json({
      success: acquirerResponse.success,
      message: acquirerResponse.success ? 'Payment captured successfully' : 'Payment capture failed',
      data: {
        transaction: {
          id: updatedTransaction.id,
          amount: updatedTransaction.amount,
          status: updatedTransaction.status,
          externalId: updatedTransaction.external_id,
          updatedAt: updatedTransaction.updated_at
        },
        acquirerResponse: {
          responseCode: acquirerResponse.response_code,
          responseMessage: acquirerResponse.response_message
        }
      }
    });
  } catch (error) {
    console.error('Capture error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Refund a captured payment
export const refundPayment = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { amount } = req.body;
    const userId = req.user.id;

    // Get the captured transaction
    const transactionResult = await pool.query(
      'SELECT * FROM transactions WHERE id = $1 AND user_id = $2 AND status = $3',
      [transactionId, userId, 'captured']
    );

    if (transactionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Captured transaction not found'
      });
    }

    const transaction = transactionResult.rows[0];

    // Call mock acquirer for refund
    const acquirerResponse = await refundTransaction(transaction.external_id, amount);

    // Update transaction status
    const status = acquirerResponse.success ? 'refunded' : 'failed';
    const updateResult = await pool.query(
      `UPDATE transactions 
       SET status = $1, metadata = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [status, JSON.stringify(acquirerResponse), transactionId]
    );

    const updatedTransaction = updateResult.rows[0];

    // Log refund
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, new_values, ip_address, user_agent)
       VALUES ($1, 'payment_refunded', 'transaction', $2, $3, $4, $5)`,
      [
        userId,
        transactionId,
        JSON.stringify({ amount, status }),
        req.ip,
        req.get('User-Agent')
      ]
    );

    res.json({
      success: acquirerResponse.success,
      message: acquirerResponse.success ? 'Payment refunded successfully' : 'Payment refund failed',
      data: {
        transaction: {
          id: updatedTransaction.id,
          amount: updatedTransaction.amount,
          status: updatedTransaction.status,
          externalId: updatedTransaction.external_id,
          updatedAt: updatedTransaction.updated_at
        },
        acquirerResponse: {
          responseCode: acquirerResponse.response_code,
          responseMessage: acquirerResponse.response_message
        }
      }
    });
  } catch (error) {
    console.error('Refund error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get transaction details
export const getTransaction = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT t.*, pm.last_four, pm.brand, pm.expiry_month, pm.expiry_year
       FROM transactions t
       LEFT JOIN payment_methods pm ON t.payment_method_id = pm.id
       WHERE t.id = $1 AND t.user_id = $2`,
      [transactionId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    const transaction = result.rows[0];

    res.json({
      success: true,
      data: {
        transaction: {
          id: transaction.id,
          amount: transaction.amount,
          currency: transaction.currency,
          status: transaction.status,
          transactionType: transaction.transaction_type,
          externalId: transaction.external_id,
          description: transaction.description,
          metadata: transaction.metadata,
          paymentMethod: {
            lastFour: transaction.last_four,
            brand: transaction.brand,
            expiryMonth: transaction.expiry_month,
            expiryYear: transaction.expiry_year
          },
          createdAt: transaction.created_at,
          updatedAt: transaction.updated_at
        }
      }
    });
  } catch (error) {
    console.error('Get transaction error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

export const listTransactions = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit ?? "25", 10) || 25, 100);
    const status = req.query.status;
    const userIdParam = req.query.userId;

    const isAdmin = req.user.role === "admin";
    const requestedUserId = isAdmin && userIdParam ? userIdParam : req.user.id;

    const values = [requestedUserId, limit];
    let filterSql = "";

    if (status) {
      filterSql += " AND t.status = $3";
      values.push(status);
    }

    const result = await pool.query(
      `SELECT t.id,
              t.amount,
              t.currency,
              t.status,
              t.transaction_type,
              t.description,
              t.created_at,
              t.updated_at,
              fs.risk_score,
              fs.risk_level,
              pm.last_four,
              pm.brand
       FROM transactions t
       LEFT JOIN fraud_scores fs ON fs.transaction_id = t.id
       LEFT JOIN payment_methods pm ON pm.id = t.payment_method_id
       WHERE t.user_id = $1${filterSql}
       ORDER BY t.created_at DESC
       LIMIT $2`,
      values
    );

    res.json({
      success: true,
      data: {
        transactions: result.rows.map((row) => ({
          id: row.id,
          amount: row.amount,
          currency: row.currency,
          status: row.status,
          transactionType: row.transaction_type,
          description: row.description,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          paymentMethod: row.last_four
            ? { lastFour: row.last_four, brand: row.brand }
            : null,
          fraud: row.risk_score !== null
            ? { riskScore: row.risk_score, riskLevel: row.risk_level }
            : null,
        })),
      },
    });
  } catch (error) {
    console.error("List transactions error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};