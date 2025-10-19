import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../database/connection.js';

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
};

// User registration
export const register = async (req, res) => {
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

    // Create user
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role)
       VALUES ($1, $2, $3, $4, 'user')
       RETURNING id, email, first_name, last_name, role, created_at`,
      [email, passwordHash, firstName, lastName]
    );

    const user = result.rows[0];

    // Generate token
    const token = generateToken(user.id);

    // Log registration
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, new_values, ip_address, user_agent)
       VALUES ($1, 'user_registered', 'user', $2, $3, $4, $5)`,
      [
        user.id,
        user.id,
        JSON.stringify({ email: user.email, role: user.role }),
        req.ip,
        req.get('User-Agent')
      ]
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role
        },
        token
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// User login
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Get user from database
    const result = await pool.query(
      'SELECT id, email, password_hash, first_name, last_name, role, is_active FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      // Log failed login attempt
      await pool.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, ip_address, user_agent)
         VALUES ($1, 'login_failed', 'user', $2, $3)`,
        [user.id, req.ip, req.get('User-Agent')]
      );

      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Generate token
    const token = generateToken(user.id);
    res.cookie("paysecure_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours in ms
    });
    // Log successful login
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address, user_agent)
       VALUES ($1, 'login_success', 'user', $2, $3, $4)`,
      [user.id, user.id, req.ip, req.get('User-Agent')]
    );

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role
        },
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get current user profile
export const getProfile = async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        user: {
          id: req.user.id,
          email: req.user.email,
          firstName: req.user.first_name,
          lastName: req.user.last_name,
          role: req.user.role
        }
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Logout (client-side token removal, but log the action)
export const logout = async (req, res) => {
  try {
    // Log logout
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, ip_address, user_agent)
       VALUES ($1, 'logout', 'user', $2, $3)`,
      [req.user.id, req.ip, req.get('User-Agent')]
    );
    res.clearCookie("paysecure_session", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });
    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// List users
export const listUsers = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, email, first_name, last_name, role, created_at
       FROM users
       ORDER BY created_at DESC`
    );

    res.json({
      success: true,
      data: { users: result.rows.map((row) => ({
        id: row.id,
        email: row.email,
        firstName: row.first_name,
        lastName: row.last_name,
        role: row.role,
        createdAt: row.created_at,
      })) },
    });
  } catch (error) {
    console.error("List users error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Update user role
export const updateUserRole = async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  const allowedRoles = ["user", "admin"];

  if (!allowedRoles.includes(role)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid role supplied." });
  }

  if (req.user.id === id) {
    return res
      .status(400)
      .json({ success: false, message: "You cannot change your own role." });
  }

  try {
    const result = await pool.query(
      `UPDATE users
       SET role = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, email, first_name, last_name, role`,
      [role, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const updated = result.rows[0];

    res.json({
      success: true,
      data: {
        user: {
          id: updated.id,
          email: updated.email,
          firstName: updated.first_name,
          lastName: updated.last_name,
          role: updated.role,
        },
      },
    });
  } catch (error) {
    console.error("Update user role error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};