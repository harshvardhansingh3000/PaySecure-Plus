import express from 'express';
import { 
  getAllUsers, 
  updateUserRole, 
  toggleUserStatus, 
  getSystemStats, 
  createAdminUser 
} from '../controllers/adminController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validateUUID } from '../middleware/validation.js';
import { body } from 'express-validator';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticateToken);
router.use(requireRole(['admin']));

// User management routes
router.get('/users', getAllUsers);
router.put('/users/:userId/role', validateUUID, updateUserRole);
router.put('/users/:userId/status', validateUUID, toggleUserStatus);

// System management routes
router.get('/stats', getSystemStats);
router.post('/users', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
  body('firstName').trim().isLength({ min: 2, max: 50 }).withMessage('First name must be between 2 and 50 characters'),
  body('lastName').trim().isLength({ min: 2, max: 50 }).withMessage('Last name must be between 2 and 50 characters')
], createAdminUser);

export default router;