// Fraud Detection Service - Rule-based real-time scoring
// Educational/Demo purposes - not production ready

import pool from '../database/connection.js';

// Fraud detection rules and weights
const FRAUD_RULES = {
  // Velocity rules
  VELOCITY_SAME_CARD: {
    weight: 25,
    threshold: 5, // transactions in last 10 minutes
    timeWindow: 10 * 60 * 1000 // 10 minutes in milliseconds
  },
  VELOCITY_SAME_USER: {
    weight: 20,
    threshold: 10, // transactions in last 30 minutes
    timeWindow: 30 * 60 * 1000 // 30 minutes in milliseconds
  },
  
  // Amount rules
  HIGH_AMOUNT: {
    weight: 15,
    threshold: 5000 // $5000+ transactions
  },
  UNUSUAL_AMOUNT: {
    weight: 10,
    threshold: 10000 // $10000+ transactions
  },
  
  // Time-based rules
  NIGHT_TRANSACTION: {
    weight: 5,
    startHour: 22, // 10 PM
    endHour: 6     // 6 AM
  },
  WEEKEND_TRANSACTION: {
    weight: 3,
    weekendDays: [0, 6] // Sunday, Saturday
  },
  
  // Geographic rules (simulated)
  GEO_MISMATCH: {
    weight: 20,
    // This would normally check IP geolocation vs card BIN country
    // For demo, we'll simulate based on certain conditions
  },
  
  // Card rules
  NEW_CARD: {
    weight: 10,
    threshold: 24 * 60 * 60 * 1000 // 24 hours in milliseconds
  },
  EXPIRING_CARD: {
    weight: 5,
    threshold: 30 // days until expiry
  }
};

// Risk level thresholds
const RISK_THRESHOLDS = {
  LOW: 30,
  MEDIUM: 60,
  HIGH: 80,
  CRITICAL: 90
};

// Calculate velocity score for same card
const calculateCardVelocity = async (paymentMethodId, timeWindow) => {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) as count 
       FROM transactions 
       WHERE payment_method_id = $1 
       AND created_at > NOW() - INTERVAL '${timeWindow / 1000} seconds'
       AND status IN ('authorized', 'captured')`,
      [paymentMethodId]
    );
    
    return parseInt(result.rows[0].count);
  } catch (error) {
    console.error('Error calculating card velocity:', error);
    return 0;
  }
};

// Calculate velocity score for same user
const calculateUserVelocity = async (userId, timeWindow) => {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) as count 
       FROM transactions 
       WHERE user_id = $1 
       AND created_at > NOW() - INTERVAL '${timeWindow / 1000} seconds'
       AND status IN ('authorized', 'captured')`,
      [userId]
    );
    
    return parseInt(result.rows[0].count);
  } catch (error) {
    console.error('Error calculating user velocity:', error);
    return 0;
  }
};

// Check if transaction is during suspicious hours
const isNightTransaction = (timestamp) => {
  const hour = new Date(timestamp).getHours();
  return hour >= FRAUD_RULES.NIGHT_TRANSACTION.startHour || 
         hour <= FRAUD_RULES.NIGHT_TRANSACTION.endHour;
};

// Check if transaction is on weekend
const isWeekendTransaction = (timestamp) => {
  const day = new Date(timestamp).getDay();
  return FRAUD_RULES.WEEKEND_TRANSACTION.weekendDays.includes(day);
};

// Check if card is new (recently added)
const isNewCard = async (paymentMethodId) => {
  try {
    const result = await pool.query(
      `SELECT created_at FROM payment_methods WHERE id = $1`,
      [paymentMethodId]
    );
    
    if (result.rows.length === 0) return false;
    
    const cardAge = Date.now() - new Date(result.rows[0].created_at).getTime();
    return cardAge < FRAUD_RULES.NEW_CARD.threshold;
  } catch (error) {
    console.error('Error checking card age:', error);
    return false;
  }
};

// Check if card is expiring soon
const isExpiringCard = async (paymentMethodId) => {
  try {
    const result = await pool.query(
      `SELECT expiry_month, expiry_year FROM payment_methods WHERE id = $1`,
      [paymentMethodId]
    );
    
    if (result.rows.length === 0) return false;
    
    const { expiry_month, expiry_year } = result.rows[0];
    const expiryDate = new Date(expiry_year, expiry_month - 1);
    const daysUntilExpiry = (expiryDate - new Date()) / (1000 * 60 * 60 * 24);
    
    return daysUntilExpiry <= FRAUD_RULES.EXPIRING_CARD.threshold;
  } catch (error) {
    console.error('Error checking card expiry:', error);
    return false;
  }
};

// Simulate geographic mismatch (in real implementation, this would use IP geolocation)
const hasGeoMismatch = (ipAddress, cardBrand) => {
  // For demo purposes, simulate geo mismatch for certain IP patterns
  // In production, this would check IP geolocation vs card BIN country
  if (!ipAddress) return false;
  
  // Simulate mismatch for IPs ending in certain patterns
  const ipSuffix = ipAddress.split('.').pop();
  return parseInt(ipSuffix) % 7 === 0; // 1/7 chance of geo mismatch
};

// Main fraud detection function
export const analyzeTransaction = async (transactionData) => {
  const {
    userId,
    paymentMethodId,
    amount,
    currency,
    ipAddress,
    userAgent,
    timestamp = new Date()
  } = transactionData;

  const riskScore = 0;
  const triggeredRules = [];
  const features = {};

  try {
    // 1. Velocity Checks
    const cardVelocity = await calculateCardVelocity(
      paymentMethodId, 
      FRAUD_RULES.VELOCITY_SAME_CARD.timeWindow
    );
    
    if (cardVelocity >= FRAUD_RULES.VELOCITY_SAME_CARD.threshold) {
      riskScore += FRAUD_RULES.VELOCITY_SAME_CARD.weight;
      triggeredRules.push({
        rule: 'VELOCITY_SAME_CARD',
        weight: FRAUD_RULES.VELOCITY_SAME_CARD.weight,
        value: cardVelocity,
        threshold: FRAUD_RULES.VELOCITY_SAME_CARD.threshold
      });
    }
    features.cardVelocity = cardVelocity;

    const userVelocity = await calculateUserVelocity(
      userId, 
      FRAUD_RULES.VELOCITY_SAME_USER.timeWindow
    );
    
    if (userVelocity >= FRAUD_RULES.VELOCITY_SAME_USER.threshold) {
      riskScore += FRAUD_RULES.VELOCITY_SAME_USER.weight;
      triggeredRules.push({
        rule: 'VELOCITY_SAME_USER',
        weight: FRAUD_RULES.VELOCITY_SAME_USER.weight,
        value: userVelocity,
        threshold: FRAUD_RULES.VELOCITY_SAME_USER.threshold
      });
    }
    features.userVelocity = userVelocity;

    // 2. Amount Checks
    if (amount >= FRAUD_RULES.HIGH_AMOUNT.threshold) {
      riskScore += FRAUD_RULES.HIGH_AMOUNT.weight;
      triggeredRules.push({
        rule: 'HIGH_AMOUNT',
        weight: FRAUD_RULES.HIGH_AMOUNT.weight,
        value: amount,
        threshold: FRAUD_RULES.HIGH_AMOUNT.threshold
      });
    }
    features.amount = amount;

    if (amount >= FRAUD_RULES.UNUSUAL_AMOUNT.threshold) {
      riskScore += FRAUD_RULES.UNUSUAL_AMOUNT.weight;
      triggeredRules.push({
        rule: 'UNUSUAL_AMOUNT',
        weight: FRAUD_RULES.UNUSUAL_AMOUNT.weight,
        value: amount,
        threshold: FRAUD_RULES.UNUSUAL_AMOUNT.threshold
      });
    }

    // 3. Time-based Checks
    if (isNightTransaction(timestamp)) {
      riskScore += FRAUD_RULES.NIGHT_TRANSACTION.weight;
      triggeredRules.push({
        rule: 'NIGHT_TRANSACTION',
        weight: FRAUD_RULES.NIGHT_TRANSACTION.weight,
        value: new Date(timestamp).getHours()
      });
    }
    features.isNightTransaction = isNightTransaction(timestamp);

    if (isWeekendTransaction(timestamp)) {
      riskScore += FRAUD_RULES.WEEKEND_TRANSACTION.weight;
      triggeredRules.push({
        rule: 'WEEKEND_TRANSACTION',
        weight: FRAUD_RULES.WEEKEND_TRANSACTION.weight,
        value: new Date(timestamp).getDay()
      });
    }
    features.isWeekendTransaction = isWeekendTransaction(timestamp);

    // 4. Card-based Checks
    const isNew = await isNewCard(paymentMethodId);
    if (isNew) {
      riskScore += FRAUD_RULES.NEW_CARD.weight;
      triggeredRules.push({
        rule: 'NEW_CARD',
        weight: FRAUD_RULES.NEW_CARD.weight,
        value: true
      });
    }
    features.isNewCard = isNew;

    const isExpiring = await isExpiringCard(paymentMethodId);
    if (isExpiring) {
      riskScore += FRAUD_RULES.EXPIRING_CARD.weight;
      triggeredRules.push({
        rule: 'EXPIRING_CARD',
        weight: FRAUD_RULES.EXPIRING_CARD.weight,
        value: true
      });
    }
    features.isExpiringCard = isExpiring;

    // 5. Geographic Checks (simulated)
    const geoMismatch = hasGeoMismatch(ipAddress, 'visa'); // Simplified
    if (geoMismatch) {
      riskScore += FRAUD_RULES.GEO_MISMATCH.weight;
      triggeredRules.push({
        rule: 'GEO_MISMATCH',
        weight: FRAUD_RULES.GEO_MISMATCH.weight,
        value: true
      });
    }
    features.hasGeoMismatch = geoMismatch;

    // Determine risk level
    let riskLevel = 'low';
    if (riskScore >= RISK_THRESHOLDS.CRITICAL) {
      riskLevel = 'critical';
    } else if (riskScore >= RISK_THRESHOLDS.HIGH) {
      riskLevel = 'high';
    } else if (riskScore >= RISK_THRESHOLDS.MEDIUM) {
      riskLevel = 'medium';
    }

    // Additional features for ML training
    features.timestamp = timestamp;
    features.currency = currency;
    features.ipAddress = ipAddress;
    features.userAgent = userAgent;

    return {
      riskScore: Math.min(riskScore, 100), // Cap at 100
      riskLevel,
      triggeredRules,
      features,
      analysisTimestamp: new Date()
    };

  } catch (error) {
    console.error('Fraud detection error:', error);
    return {
      riskScore: 50, // Default medium risk on error
      riskLevel: 'medium',
      triggeredRules: [{ rule: 'ANALYSIS_ERROR', weight: 0, value: error.message }],
      features: {},
      analysisTimestamp: new Date()
    };
  }
};

// Get fraud statistics
export const getFraudStats = async (timeRange = '24h') => {
  try {
    let timeCondition = '';
    switch (timeRange) {
      case '1h':
        timeCondition = "AND created_at > NOW() - INTERVAL '1 hour'";
        break;
      case '24h':
        timeCondition = "AND created_at > NOW() - INTERVAL '24 hours'";
        break;
      case '7d':
        timeCondition = "AND created_at > NOW() - INTERVAL '7 days'";
        break;
      case '30d':
        timeCondition = "AND created_at > NOW() - INTERVAL '30 days'";
        break;
    }

    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_transactions,
        COUNT(CASE WHEN risk_level = 'low' THEN 1 END) as low_risk,
        COUNT(CASE WHEN risk_level = 'medium' THEN 1 END) as medium_risk,
        COUNT(CASE WHEN risk_level = 'high' THEN 1 END) as high_risk,
        COUNT(CASE WHEN risk_level = 'critical' THEN 1 END) as critical_risk,
        AVG(risk_score) as avg_risk_score,
        MAX(risk_score) as max_risk_score
      FROM fraud_scores 
      WHERE created_at > NOW() - INTERVAL '${timeRange.replace('d', ' days').replace('h', ' hours')}'
    `);

    return result.rows[0];
  } catch (error) {
    console.error('Error getting fraud stats:', error);
    return null;
  }
};