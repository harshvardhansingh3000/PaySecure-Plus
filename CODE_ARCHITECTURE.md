# PaySecure Gateway - Code Architecture & Component Guide

## 🏗️ Overall Architecture

Frontend (React) → Backend (Express) → Database (PostgreSQL)
↓
Security Layer
(Helmet, CORS, Rate Limiting)
↓
Authentication Layer
(JWT, bcrypt, RBAC)
↓
Business Logic
(Payments, Fraud Detection)
↓
Data Layer
(Tokenization, Audit Logging)



---

## 📁 File Structure & Components

### `/backend/src/index.js` - Main Application Entry Point
**Purpose**: Application bootstrap and configuration
**Key Responsibilities**:
- Initialize database connection and schema
- Configure security middleware
- Set up routes and error handling
- Start the Express server

**Key Components**:
```javascript
// Database initialization
await testConnection();
await initializeDatabase();

// Security middleware stack
app.use(helmet());           // Security headers
app.use(cors());            // Cross-origin requests
app.use(limiter);           // Rate limiting
app.use(express.json());    // Body parsing

// Route mounting
app.use('/api/auth', authRoutes);
app.use('/api/payments', paymentRoutes);
```

**Benefits**:
- Centralized application configuration
- Proper middleware ordering for security
- Clean separation of concerns
- Easy to maintain and extend

---

### `/backend/src/database/connection.js` - Database Management
**Purpose**: Database connection pooling and schema management
**Key Responsibilities**:
- Create and manage PostgreSQL connection pool
- Initialize database schema on startup
- Provide connection testing functionality

**Key Components**:
```javascript
// Connection pool configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Schema initialization
export const initializeDatabase = async () => {
  const schema = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(schema);
};

// Connection testing
export const testConnection = async () => {
  const result = await pool.query('SELECT NOW()');
  return result.rows[0].now;
};
```

**Benefits**:
- Efficient connection pooling for performance
- Automatic schema initialization
- Connection health monitoring
- Environment-based configuration

---

### `/backend/src/middleware/auth.js` - Authentication Middleware
**Purpose**: JWT token verification and user authentication
**Key Responsibilities**:
- Verify JWT tokens from Authorization headers
- Extract and validate user information
- Implement role-based access control
- Handle token expiration and errors

**Key Components**:
```javascript
// Token verification
export const authenticateToken = async (req, res, next) => {
  const token = authHeader && authHeader.split(' ')[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  
  // Verify user still exists and is active
  const user = await pool.query('SELECT * FROM users WHERE id = $1', [decoded.userId]);
  req.user = user.rows[0];
  next();
};

// Role-based access control
export const requireRole = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    next();
  };
};
```

**Benefits**:
- Secure token-based authentication
- Automatic user validation
- Flexible role-based permissions
- Proper error handling for expired/invalid tokens

---

### `/backend/src/middleware/validation.js` - Input Validation
**Purpose**: Request validation and sanitization
**Key Responsibilities**:
- Validate request body data
- Sanitize inputs to prevent injection attacks
- Provide clear error messages
- Ensure data integrity

**Key Components**:
```javascript
// User registration validation
export const validateUserRegistration = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/),
  body('firstName').trim().isLength({ min: 2, max: 50 }),
  handleValidationErrors
];

// Error handling
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};
```

**Benefits**:
- Prevents malicious input attacks
- Ensures data quality and consistency
- Provides clear validation error messages
- Reduces server-side processing errors

---

### `/backend/src/controllers/authController.js` - Authentication Logic
**Purpose**: User authentication and account management
**Key Responsibilities**:
- Handle user registration with password hashing
- Process user login with credential verification
- Manage user profiles and sessions
- Log authentication events for audit

**Key Components**:
```javascript
// User registration
export const register = async (req, res) => {
  // Check for existing user
  const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  
  // Hash password with bcrypt
  const passwordHash = await bcrypt.hash(password, 12);
  
  // Create user in database
  const result = await pool.query(
    'INSERT INTO users (email, password_hash, first_name, last_name) VALUES ($1, $2, $3, $4) RETURNING *',
    [email, passwordHash, firstName, lastName]
  );
  
  // Generate JWT token
  const token = generateToken(user.id);
  
  // Log registration for audit
  await pool.query('INSERT INTO audit_logs (user_id, action, ...) VALUES (...)');
};

// User login
export const login = async (req, res) => {
  // Get user from database
  const user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  
  // Verify password with bcrypt
  const isValidPassword = await bcrypt.compare(password, user.password_hash);
  
  // Generate JWT token
  const token = generateToken(user.id);
  
  // Log successful login
  await pool.query('INSERT INTO audit_logs (user_id, action, ...) VALUES (...)');
};
```

**Benefits**:
- Secure password handling with bcrypt
- JWT token generation for stateless authentication
- Comprehensive audit logging
- Proper error handling and user feedback

---

### `/backend/src/controllers/paymentController.js` - Payment Processing Logic
**Purpose**: Core payment gateway functionality
**Key Responsibilities**:
- Process payment authorization requests
- Handle payment capture and refund operations
- Integrate with mock acquirer service
- Manage transaction lifecycle and status updates

**Key Components**:
```javascript
// Payment authorization
export const authorizePayment = async (req, res) => {
  // Get payment method details
  const paymentMethod = await pool.query('SELECT * FROM payment_methods WHERE id = $1', [paymentMethodId]);
  
  // Create transaction record
  const transaction = await pool.query(
    'INSERT INTO transactions (user_id, payment_method_id, amount, currency, status) VALUES (...)',
    [userId, paymentMethodId, amount, currency, 'pending']
  );
  
  // Call mock acquirer
  const acquirerResponse = await authorizeTransaction({
    amount, currency, lastFour: paymentMethod.last_four, brand: paymentMethod.brand
  });
  
  // Update transaction status
  const status = acquirerResponse.success ? 'authorized' : 'failed';
  await pool.query('UPDATE transactions SET status = $1, external_id = $2 WHERE id = $3', 
    [status, acquirerResponse.transaction_id, transaction.id]);
  
  // Log transaction for audit
  await pool.query('INSERT INTO audit_logs (user_id, action, ...) VALUES (...)');
};
```

**Benefits**:
- Complete payment lifecycle management
- Integration with external payment processors
- Comprehensive transaction tracking
- Audit compliance for financial operations

---

### `/backend/src/services/mockAcquirer.js` - Mock Payment Processor
**Purpose**: Simulate third-party payment processor behavior
**Key Responsibilities**:
- Simulate realistic payment processor responses
- Handle different failure scenarios
- Provide network delay simulation
- Generate mock transaction IDs and auth codes

**Key Components**:
```javascript
// Mock authorization
export const authorizeTransaction = async (transactionData) => {
  // Simulate network delay
  await simulateNetworkDelay();
  
  // Check card expiration
  if (expiryYear < currentYear || (expiryYear === currentYear && expiryMonth < currentMonth)) {
    return { success: false, decline_reason: 'expired_card' };
  }
  
  // Determine response scenario
  const scenario = determineScenario(amount, lastFour, brand);
  
  // Return appropriate response
  if (scenario === 'success') {
    return {
      success: true,
      transaction_id: generateMockTransactionId(),
      response_code: '00',
      response_message: 'Approved',
      auth_code: generateAuthCode()
    };
  } else {
    return {
      success: false,
      decline_reason: scenario,
      response_code: '05',
      response_message: getDeclineMessage(scenario)
    };
  }
};
```

**Benefits**:
- Realistic payment processor simulation
- Multiple failure scenario testing
- Network delay simulation for realistic testing
- Configurable success/failure rates

---

### `/backend/database/schema.sql` - Database Schema
**Purpose**: Define database structure and relationships
**Key Responsibilities**:
- Create tables with proper relationships
- Define constraints and indexes
- Ensure data integrity and performance
- Support audit and compliance requirements

**Key Components**:
```sql
-- Users table with RBAC
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    is_active BOOLEAN DEFAULT true
);

-- Payment methods with tokenization
CREATE TABLE payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    last_four VARCHAR(4) NOT NULL,
    brand VARCHAR(20) NOT NULL
);

-- Transactions with lifecycle tracking
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    payment_method_id UUID REFERENCES payment_methods(id),
    amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'authorized', 'captured', 'failed', 'refunded'))
);

-- Audit logs for compliance
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    old_values JSONB,
    new_values JSONB
);
```

**Benefits**:
- Secure data storage with UUID primary keys
- Proper referential integrity with foreign keys
- Tokenization approach for PCI compliance
- Comprehensive audit logging
- Performance optimization with strategic indexes

---

## 🔄 Data Flow Examples

### User Registration Flow
1. **Request**: POST /api/auth/register with user data
2. **Validation**: Input validation middleware checks data format
3. **Controller**: authController.register() processes request
4. **Database**: Check for existing user, hash password, create user record
5. **Response**: Return user data and JWT token
6. **Audit**: Log registration action in audit_logs table

### Payment Authorization Flow
1. **Request**: POST /api/payments/authorize with payment data
2. **Authentication**: JWT middleware verifies user token
3. **Validation**: Transaction validation middleware checks data
4. **Controller**: paymentController.authorizePayment() processes request
5. **Database**: Get payment method, create transaction record
6. **Service**: mockAcquirer.authorizeTransaction() simulates processor
7. **Database**: Update transaction status based on acquirer response
8. **Response**: Return transaction details and acquirer response
9. **Audit**: Log authorization action in audit_logs table

---

## 🛡️ Security Implementation Details

### Password Security
- **bcrypt hashing**: 12 rounds for strong password protection
- **Complexity requirements**: 8+ chars, mixed case, numbers, special chars
- **No plain text storage**: Passwords never stored in plain text

### Token Security
- **JWT tokens**: Stateless authentication with 24-hour expiry
- **Secret key**: Environment variable for token signing
- **Token verification**: Every request validates token and user status

### Input Security
- **Validation**: All inputs validated and sanitized
- **SQL injection prevention**: Parameterized queries only
- **XSS prevention**: Input sanitization and output encoding

### Audit Security
- **Comprehensive logging**: All actions logged with context
- **IP tracking**: Request IP addresses logged
- **User agent tracking**: Browser/client information logged
- **Data change tracking**: Old and new values logged for modifications

---

## 📈 Performance Considerations

### Database Optimization
- **Connection pooling**: Efficient database connection management
- **Strategic indexes**: Optimized queries for common access patterns
- **UUID primary keys**: Better performance than auto-incrementing integers

### Caching Strategy
- **JWT tokens**: Stateless authentication reduces database queries
- **User sessions**: Minimal database lookups for authentication

### Rate Limiting
- **API protection**: 100 requests per 15 minutes per IP
- **DoS prevention**: Protects against abuse and attacks

---

## 🔧 Configuration Management

### Environment Variables
```env
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://user:pass@localhost:5432/db
JWT_SECRET=your-secret-key
FRONTEND_URL=http://localhost:3000
```

### Security Configuration
- **Helmet**: Security headers for XSS, CSRF protection
- **CORS**: Controlled cross-origin request handling
- **Rate limiting**: Configurable request limits
- **Body parsing**: 10MB limit for request payloads

---

## 🧪 Testing Strategy

### Unit Testing
- **Controllers**: Test business logic in isolation
- **Services**: Test mock acquirer responses
- **Middleware**: Test authentication and validation

### Integration Testing
- **API endpoints**: Test complete request/response cycles
- **Database operations**: Test CRUD operations
- **Authentication flows**: Test login/register/logout

### End-to-End Testing
- **Payment flows**: Test complete payment authorization/capture/refund
- **User journeys**: Test complete user registration and management
- **Error scenarios**: Test failure cases and error handling
