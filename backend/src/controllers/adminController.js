import pool from '../database/connection.js';
import bcrypt from 'bcryptjs';

// Get all users (admin only)
export const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '', role = '' } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        id, email, first_name, last_name, role, is_active, 
        created_at, updated_at
      FROM users 
      WHERE 1=1
    `;
    const queryParams = [];
    let paramCount = 0;

    // Add search filter
    if (search) {
      paramCount++;
      query += ` AND (email ILIKE $${paramCount} OR first_name ILIKE $${paramCount} OR last_name ILIKE $${paramCount})`;
      queryParams.push(`%${search}%`);
    }

    // Add role filter
    if (role) {
      paramCount++;
      query += ` AND role = $${paramCount}`;
      queryParams.push(role);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    queryParams.push(parseInt(limit), offset);

    const result = await pool.query(query, queryParams);

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM users WHERE 1=1';
    const countParams = [];
    let countParamCount = 0;

    if (search) {
      countParamCount++;
      countQuery += ` AND (email ILIKE $${countParamCount} OR first_name ILIKE $${countParamCount} OR last_name ILIKE $${countParamCount})`;
      countParams.push(`%${search}%`);
    }

    if (role) {
      countParamCount++;
      countQuery += ` AND role = $${countParamCount}`;
      countParams.push(role);
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    // Log admin action
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, ip_address, user_agent)
       VALUES ($1, 'admin_view_users', 'user', $2, $3)`,
      [req.user.id, req.ip, req.get('User-Agent')]
    );

    res.json({
      success: true,
      data: {
        users: result.rows.map(user => ({
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          isActive: user.is_active,
          createdAt: user.created_at,
          updatedAt: user.updated_at
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update user role (admin only)
export const updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    // Validate role
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be "user" or "admin"'
      });
    }

    // Check if user exists
    const userResult = await pool.query(
      'SELECT id, email, role FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = userResult.rows[0];

    // Prevent admin from demoting themselves
    if (user.id === req.user.id && role !== 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Cannot demote yourself from admin role'
      });
    }

    // Update user role
    const updateResult = await pool.query(
      'UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [role, userId]
    );

    const updatedUser = updateResult.rows[0];

    // Log admin action
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, old_values, new_values, ip_address, user_agent)
       VALUES ($1, 'admin_update_role', 'user', $2, $3, $4, $5, $6)`,
      [
        req.user.id,
        userId,
        JSON.stringify({ role: user.role }),
        JSON.stringify({ role: updatedUser.role }),
        req.ip,
        req.get('User-Agent')
      ]
    );

    res.json({
      success: true,
      message: 'User role updated successfully',
      data: {
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          firstName: updatedUser.first_name,
          lastName: updatedUser.last_name,
          role: updatedUser.role,
          isActive: updatedUser.is_active
        }
      }
    });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Toggle user active status (admin only)
export const toggleUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if user exists
    const userResult = await pool.query(
      'SELECT id, email, is_active FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = userResult.rows[0];

    // Prevent admin from deactivating themselves
    if (user.id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot deactivate your own account'
      });
    }

    // Toggle user status
    const newStatus = !user.is_active;
    const updateResult = await pool.query(
      'UPDATE users SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [newStatus, userId]
    );

    const updatedUser = updateResult.rows[0];

    // Log admin action
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, old_values, new_values, ip_address, user_agent)
       VALUES ($1, 'admin_toggle_status', 'user', $2, $3, $4, $5, $6)`,
      [
        req.user.id,
        userId,
        JSON.stringify({ is_active: user.is_active }),
        JSON.stringify({ is_active: updatedUser.is_active }),
        req.ip,
        req.get('User-Agent')
      ]
    );

    res.json({
      success: true,
      message: `User ${newStatus ? 'activated' : 'deactivated'} successfully`,
      data: {
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          firstName: updatedUser.first_name,
          lastName: updatedUser.last_name,
          role: updatedUser.role,
          isActive: updatedUser.is_active
        }
      }
    });
  } catch (error) {
    console.error('Toggle user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get system statistics (admin only)
export const getSystemStats = async (req, res) => {
  try {
    // Get user statistics
    const userStats = await pool.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_users,
        COUNT(CASE WHEN role = 'user' THEN 1 END) as regular_users,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_users,
        COUNT(CASE WHEN is_active = false THEN 1 END) as inactive_users
      FROM users
    `);

    // Get transaction statistics
    const transactionStats = await pool.query(`
      SELECT 
        COUNT(*) as total_transactions,
        COUNT(CASE WHEN status = 'authorized' THEN 1 END) as authorized_transactions,
        COUNT(CASE WHEN status = 'captured' THEN 1 END) as captured_transactions,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_transactions,
        COUNT(CASE WHEN status = 'refunded' THEN 1 END) as refunded_transactions,
        SUM(CASE WHEN status = 'captured' THEN amount ELSE 0 END) as total_captured_amount,
        AVG(CASE WHEN status = 'captured' THEN amount ELSE NULL END) as avg_transaction_amount
      FROM transactions
    `);

    // Get fraud statistics
    const fraudStats = await pool.query(`
      SELECT 
        COUNT(*) as total_fraud_analyses,
        COUNT(CASE WHEN risk_level = 'low' THEN 1 END) as low_risk_count,
        COUNT(CASE WHEN risk_level = 'medium' THEN 1 END) as medium_risk_count,
        COUNT(CASE WHEN risk_level = 'high' THEN 1 END) as high_risk_count,
        COUNT(CASE WHEN risk_level = 'critical' THEN 1 END) as critical_risk_count,
        AVG(risk_score) as avg_risk_score
      FROM fraud_scores
    `);

    // Get recent activity (last 24 hours)
    const recentActivity = await pool.query(`
      SELECT 
        COUNT(CASE WHEN action = 'user_registered' THEN 1 END) as new_registrations,
        COUNT(CASE WHEN action = 'payment_authorized' THEN 1 END) as new_authorizations,
        COUNT(CASE WHEN action = 'fraud_analysis' THEN 1 END) as fraud_analyses
      FROM audit_logs
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `);

    // Log admin action
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, ip_address, user_agent)
       VALUES ($1, 'admin_view_stats', 'system', $2, $3)`,
      [req.user.id, req.ip, req.get('User-Agent')]
    );

    res.json({
      success: true,
      data: {
        users: userStats.rows[0],
        transactions: transactionStats.rows[0],
        fraud: fraudStats.rows[0],
        recentActivity: recentActivity.rows[0],
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Get system stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Create admin user (for initial setup)
export const createAdminUser = async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create admin user
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role)
       VALUES ($1, $2, $3, $4, 'admin')
       RETURNING id, email, first_name, last_name, role, created_at`,
      [email, passwordHash, firstName, lastName]
    );

    const user = result.rows[0];

    // Log admin creation
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, new_values, ip_address, user_agent)
       VALUES ($1, 'admin_user_created', 'user', $2, $3, $4, $5)`,
      [
        req.user.id,
        user.id,
        JSON.stringify({ email: user.email, role: user.role }),
        req.ip,
        req.get('User-Agent')
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Admin user created successfully',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          createdAt: user.created_at
        }
      }
    });
  } catch (error) {
    console.error('Create admin user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};