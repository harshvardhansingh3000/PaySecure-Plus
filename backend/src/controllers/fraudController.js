import pool from '../database/connection.js';
import { analyzeTransaction, getFraudStats } from '../services/fraudDetection.js';

// Analyze transaction for fraud
export const analyzeTransactionForFraud = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const userId = req.user.id;

    // Get transaction details
    const transactionResult = await pool.query(
      `SELECT t.*, pm.last_four, pm.brand, pm.expiry_month, pm.expiry_year
       FROM transactions t
       LEFT JOIN payment_methods pm ON t.payment_method_id = pm.id
       WHERE t.id = $1 AND t.user_id = $2`,
      [transactionId, userId]
    );

    if (transactionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    const transaction = transactionResult.rows[0];

    // Perform fraud analysis
    const fraudAnalysis = await analyzeTransaction({
      userId: transaction.user_id,
      paymentMethodId: transaction.payment_method_id,
      amount: parseFloat(transaction.amount),
      currency: transaction.currency,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: transaction.created_at
    });

    // Save fraud analysis to database
    const fraudResult = await pool.query(
      `INSERT INTO fraud_scores (transaction_id, risk_score, risk_level, rules_triggered, features, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        transactionId,
        fraudAnalysis.riskScore,
        fraudAnalysis.riskLevel,
        JSON.stringify(fraudAnalysis.triggeredRules),
        JSON.stringify(fraudAnalysis.features),
        req.ip,
        req.get('User-Agent')
      ]
    );

    // Log fraud analysis
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, new_values, ip_address, user_agent)
       VALUES ($1, 'fraud_analysis', 'fraud_score', $2, $3, $4, $5)`,
      [
        userId,
        fraudResult.rows[0].id,
        JSON.stringify({ riskScore: fraudAnalysis.riskScore, riskLevel: fraudAnalysis.riskLevel }),
        req.ip,
        req.get('User-Agent')
      ]
    );

    res.json({
      success: true,
      message: 'Fraud analysis completed',
      data: {
        transaction: {
          id: transaction.id,
          amount: transaction.amount,
          currency: transaction.currency,
          status: transaction.status
        },
        fraudAnalysis: {
          riskScore: fraudAnalysis.riskScore,
          riskLevel: fraudAnalysis.riskLevel,
          triggeredRules: fraudAnalysis.triggeredRules,
          analysisTimestamp: fraudAnalysis.analysisTimestamp
        }
      }
    });
  } catch (error) {
    console.error('Fraud analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get fraud statistics
export const getFraudStatistics = async (req, res) => {
  try {
    const { timeRange = '24h' } = req.query;
    const userId = req.user.id;

    // Check if user is admin for system-wide stats
    const userResult = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const isAdmin = userResult.rows[0].role === 'admin';

    let stats;
    if (isAdmin) {
      // Admin gets system-wide stats
      stats = await getFraudStats(timeRange);
    } else {
      // Regular users get their own stats
      const result = await pool.query(`
        SELECT 
          COUNT(*) as total_transactions,
          COUNT(CASE WHEN fs.risk_level = 'low' THEN 1 END) as low_risk,
          COUNT(CASE WHEN fs.risk_level = 'medium' THEN 1 END) as medium_risk,
          COUNT(CASE WHEN fs.risk_level = 'high' THEN 1 END) as high_risk,
          COUNT(CASE WHEN fs.risk_level = 'critical' THEN 1 END) as critical_risk,
          AVG(fs.risk_score) as avg_risk_score,
          MAX(fs.risk_score) as max_risk_score
        FROM fraud_scores fs
        JOIN transactions t ON fs.transaction_id = t.id
        WHERE t.user_id = $1
        AND fs.created_at > NOW() - INTERVAL '${timeRange.replace('d', ' days').replace('h', ' hours')}'
      `, [userId]);
      
      stats = result.rows[0];
    }

    res.json({
      success: true,
      data: {
        timeRange,
        statistics: {
          totalTransactions: parseInt(stats.total_transactions) || 0,
          riskDistribution: {
            low: parseInt(stats.low_risk) || 0,
            medium: parseInt(stats.medium_risk) || 0,
            high: parseInt(stats.high_risk) || 0,
            critical: parseInt(stats.critical_risk) || 0
          },
          averageRiskScore: parseFloat(stats.avg_risk_score) || 0,
          maxRiskScore: parseInt(stats.max_risk_score) || 0
        }
      }
    });
  } catch (error) {
    console.error('Fraud statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get flagged transactions
export const getFlaggedTransactions = async (req, res) => {
  try {
    const { riskLevel = 'high', limit = 50 } = req.query;
    const userId = req.user.id;

    // Check if user is admin
    const userResult = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const isAdmin = userResult.rows[0].role === 'admin';

    let query, params;
    if (isAdmin) {
      // Admin sees all flagged transactions
      query = `
        SELECT 
          fs.id,
          fs.risk_score,
          fs.risk_level,
          fs.rules_triggered,
          fs.created_at as analysis_time,
          t.id as transaction_id,
          t.amount,
          t.currency,
          t.status,
          t.created_at as transaction_time,
          u.email as user_email,
          pm.last_four,
          pm.brand
        FROM fraud_scores fs
        JOIN transactions t ON fs.transaction_id = t.id
        JOIN users u ON t.user_id = u.id
        LEFT JOIN payment_methods pm ON t.payment_method_id = pm.id
        WHERE fs.risk_level = $1
        ORDER BY fs.risk_score DESC, fs.created_at DESC
        LIMIT $2
      `;
      params = [riskLevel, parseInt(limit)];
    } else {
      // Regular users see only their own flagged transactions
      query = `
        SELECT 
          fs.id,
          fs.risk_score,
          fs.risk_level,
          fs.rules_triggered,
          fs.created_at as analysis_time,
          t.id as transaction_id,
          t.amount,
          t.currency,
          t.status,
          t.created_at as transaction_time,
          pm.last_four,
          pm.brand
        FROM fraud_scores fs
        JOIN transactions t ON fs.transaction_id = t.id
        LEFT JOIN payment_methods pm ON t.payment_method_id = pm.id
        WHERE fs.risk_level = $1 AND t.user_id = $2
        ORDER BY fs.risk_score DESC, fs.created_at DESC
        LIMIT $3
      `;
      params = [riskLevel, userId, parseInt(limit)];
    }

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: {
        riskLevel,
        transactions: result.rows.map(row => ({
          fraudScoreId: row.id,
          riskScore: row.risk_score,
          riskLevel: row.risk_level,
          triggeredRules: row.rules_triggered,
          analysisTime: row.analysis_time,
          transaction: {
            id: row.transaction_id,
            amount: row.amount,
            currency: row.currency,
            status: row.status,
            createdAt: row.transaction_time,
            paymentMethod: {
              lastFour: row.last_four,
              brand: row.brand
            }
          },
          userEmail: row.user_email || null
        }))
      }
    });
  } catch (error) {
    console.error('Flagged transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};