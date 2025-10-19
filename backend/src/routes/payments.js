import express from 'express';
import { authorizePayment, capturePayment, refundPayment, getTransaction, listTransactions, listPaymentMethods, addPaymentMethod } from '../controllers/paymentController.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateTransaction, validateUUID, validateCaptureOrRefund } from '../middleware/validation.js';

const router = express.Router();

// All payment routes require authentication
router.use(authenticateToken);

// Payment processing routes
router.get('/methods', listPaymentMethods);
router.post('/methods', addPaymentMethod);
router.post('/authorize', validateTransaction, authorizePayment);
router.post('/:transactionId/capture', validateUUID, validateCaptureOrRefund, capturePayment);
router.post('/:transactionId/refund', validateUUID, validateCaptureOrRefund, refundPayment);
router.get('/history', listTransactions);
router.get('/:transactionId', validateUUID, getTransaction);

export default router;