import express from 'express';
import { analyzeTransactionForFraud, getFraudStatistics, getFlaggedTransactions } from '../controllers/fraudController.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateUUID } from '../middleware/validation.js';

const router = express.Router();

// All fraud routes require authentication
router.use(authenticateToken);

// Fraud detection routes
router.post('/analyze/:transactionId', validateUUID, analyzeTransactionForFraud);
router.get('/statistics', getFraudStatistics);
router.get('/flagged', getFlaggedTransactions);

export default router;