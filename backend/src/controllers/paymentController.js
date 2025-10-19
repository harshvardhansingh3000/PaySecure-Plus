import pool from '../database/connection.js';
import { authorizeTransaction, captureTransaction, refundTransaction } from '../services/mockAcquirer.js';
import { v4 as uuidv4 } from "uuid";

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
    const fraud = await evaluateAndPersistFraudScore({
      transaction: updatedTransaction,
      userId: req.user.id,
    });

    return res.status(201).json({
      success: true,
      data: {
        transaction: buildTransactionResponse(updatedTransaction, fraud),
      },
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
    const amountToCapture = amount ?? transaction.amount;
    const acquirerResponse = await captureTransaction(transaction.external_id, amountToCapture);

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
    const fraud = await fetchFraudScore(transactionId);

    res.json({
      success: acquirerResponse.success,
      message: acquirerResponse.success ? "Payment captured successfully" : "Payment capture failed",
      data: {
        transaction: buildTransactionResponse(updatedTransaction, fraud, transaction),
        acquirerResponse: {
          responseCode: acquirerResponse.response_code,
          responseMessage: acquirerResponse.response_message,
        },
      },
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
    const amountToRefund = amount ?? transaction.amount;
    const acquirerResponse = await refundTransaction(transaction.external_id, amountToRefund);

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
    const fraud = await fetchFraudScore(transactionId);

    res.json({
      success: acquirerResponse.success,
      message: acquirerResponse.success ? "Payment refunded successfully" : "Payment refund failed",
      data: {
        transaction: buildTransactionResponse(updatedTransaction, fraud, transaction),
        acquirerResponse: {
          responseCode: acquirerResponse.response_code,
          responseMessage: acquirerResponse.response_message,
        },
      },
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
          paymentMethod: row.last_four ? { lastFour: row.last_four, brand: row.brand } : null,
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

export const listPaymentMethods = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, token, brand, last_four, expiry_month, expiry_year, is_default, created_at
       FROM payment_methods
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    res.json({
      success: true,
      data: {
        paymentMethods: result.rows.map((row) => ({
          id: row.id,
          token: row.token,
          brand: row.brand,
          lastFour: row.last_four,
          expiryMonth: row.expiry_month,
          expiryYear: row.expiry_year,
          isDefault: row.is_default,
          createdAt: row.created_at,
        })),
      },
    });
  } catch (error) {
    console.error("List payment methods error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const addPaymentMethod = async (req, res) => {
  try {
    const { brand, lastFour, expiryMonth, expiryYear } = req.body;

    if (!brand || !/^\d{4}$/.test(lastFour || "")) {
      return res.status(400).json({ success: false, message: "Invalid card details provided." });
    }

    const token = `tok_${uuidv4().replace(/-/g, "")}`;

    const result = await pool.query(
      `INSERT INTO payment_methods (user_id, token, brand, last_four, expiry_month, expiry_year)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, token, brand, last_four, expiry_month, expiry_year, is_default, created_at`,
      [req.user.id, token, brand, lastFour, expiryMonth, expiryYear]
    );

    const method = result.rows[0];

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, new_values, ip_address, user_agent)
       VALUES ($1, 'payment_method_added', 'payment_method', $2, $3, $4, $5)`,
      [
        req.user.id,
        method.id,
        JSON.stringify({ brand: method.brand, lastFour: method.last_four }),
        req.ip,
        req.get("User-Agent"),
      ]
    );

    res.status(201).json({
      success: true,
      data: {
        paymentMethod: {
          id: method.id,
          token: method.token,
          brand: method.brand,
          lastFour: method.last_four,
          expiryMonth: method.expiry_month,
          expiryYear: method.expiry_year,
          isDefault: method.is_default,
          createdAt: method.created_at,
        },
      },
    });
  } catch (error) {
    console.error("Add payment method error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ... existing code ...

async function evaluateAndPersistFraudScore({ transaction, userId }) {
  const velocityResult = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM transactions
     WHERE user_id = $1
       AND created_at >= NOW() - INTERVAL '24 hours'`,
    [userId]
  );

  const velocityCount = velocityResult.rows[0]?.count ?? 0;

  const fraudScore = scoreTransactionRisk({
    amount: Number(transaction.amount || 0),
    transactionType: transaction.transaction_type,
    velocityCount,
  });

  await pool.query("DELETE FROM fraud_scores WHERE transaction_id = $1", [transaction.id]);

  await pool.query(
    `INSERT INTO fraud_scores (id, transaction_id, risk_score, risk_level, rules_triggered)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      uuidv4(),
      transaction.id,
      fraudScore.riskScore,
      fraudScore.riskLevel,
      JSON.stringify(fraudScore.rulesTriggered),
    ]
  );

  return fraudScore;
}

function scoreTransactionRisk({ amount, transactionType, velocityCount }) {
  const rulesTriggered = [];
  let riskScore = 0;

  if (amount >= 5000) {
    riskScore += 50;
    rulesTriggered.push("HIGH_VALUE");
  } else if (amount >= 1000) {
    riskScore += 25;
    rulesTriggered.push("MID_VALUE");
  }

  if (velocityCount > 5) {
    riskScore += 30;
    rulesTriggered.push("VELOCITY_SPIKE");
  } else if (velocityCount > 3) {
    riskScore += 15;
    rulesTriggered.push("VELOCITY_WARNING");
  }

  if (transactionType === "refund") {
    riskScore += 10;
    rulesTriggered.push("REFUND_ACTIVITY");
  }

  const riskLevel = riskScore >= 75 ? "high" : riskScore >= 40 ? "medium" : "low";
  return { riskScore, riskLevel, rulesTriggered };
}

async function fetchFraudScore(transactionId) {
  const result = await pool.query(
    `SELECT risk_score, risk_level, rules_triggered
     FROM fraud_scores
     WHERE transaction_id = $1`,
    [transactionId]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    riskScore: row.risk_score,
    riskLevel: row.risk_level,
    rulesTriggered: row.rules_triggered,
  };
}

function buildTransactionResponse(row, fraud = null, fallback = null) {
  return {
    id: row.id,
    amount: row.amount,
    currency: row.currency ?? fallback?.currency ?? null,
    status: row.status,
    transactionType: row.transaction_type,
    description: row.description ?? fallback?.description ?? null,
    externalId: row.external_id ?? fallback?.external_id ?? null,
    createdAt: row.created_at ?? fallback?.created_at ?? null,
    updatedAt: row.updated_at,
    paymentMethodId: row.payment_method_id ?? fallback?.payment_method_id ?? null,
    fraud,
  };
}