import express from "express";
import dotenv from "dotenv";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import pool, { testConnection, initializeDatabase } from "./database/connection.js";

dotenv.config();
const PORT = process.env.PORT || 3001;
const app = express();

// Initialize database connection and schema
const startServer = async () => {
  try {
    // Test database connection
    await testConnection();
    
    // Initialize database schema
    await initializeDatabase();
    
    // Start the server
    app.listen(PORT, () => {
      console.log(`🚀 PaySecure Gateway running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🔒 Security middleware enabled`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};
  

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
  });
app.use(limiter);

app.use(express.json({ limit: '10mb' }));

// Basic route
app.get('/', (req, res) => {
    res.json({ 
      message: 'PaySecure Gateway API', 
      status: 'running',
      timestamp: new Date().toISOString(),
      security: 'enabled'
    });
  });
  
  // Health check
  app.get('/health', async (req, res) => {
    try {
      const dbResult = await pool.query('SELECT NOW()');
      res.json({ 
        status: 'healthy', 
        uptime: process.uptime(),
        database: 'connected',
        dbTime: dbResult.rows[0].now
      });
    } catch (error) {
      res.status(500).json({ 
        status: 'unhealthy', 
        database: 'disconnected',
        error: error.message 
      });
    }
  });
  
// Start the server
startServer();