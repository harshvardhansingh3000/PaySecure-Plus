import express from 'express';
import { authorizePayment, capturePayment, refundPayment, getTransaction } from '../controllers/paymentController.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateTransaction, validateUUID } from '../middleware/validation.js';

const router = express.Router();

// All payment routes require authentication
router.use(authenticateToken);

// Payment processing routes
router.post('/authorize', validateTransaction, authorizePayment);
router.post('/:transactionId/capture', validateUUID, validateTransaction, capturePayment);
router.post('/:transactionId/refund', validateUUID, validateTransaction, refundPayment);
router.get('/:transactionId', validateUUID, getTransaction);

export default router;