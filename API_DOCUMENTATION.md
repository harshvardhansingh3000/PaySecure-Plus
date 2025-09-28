## Authentication
All protected routes require a JWT token in the Authorization header:

## Response Format
All API responses follow this format:
```json
{
  "success": true/false,
  "message": "Human readable message",
  "data": { /* Response data */ },
  "errors": [ /* Validation errors if any */ ]
}
```

---

## 🔐 Authentication Endpoints

### POST /api/auth/register
**Purpose**: Register a new user account
**Authentication**: None required
**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe"
}
```
**Response**:
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "user"
    },
    "token": "jwt-token-here"
  }
}
```
**Benefits**: 
- Creates secure user account with bcrypt password hashing
- Returns JWT token for immediate authentication
- Logs registration for audit compliance

### POST /api/auth/login
**Purpose**: Authenticate user and get access token
**Authentication**: None required
**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```
**Response**:
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "user"
    },
    "token": "jwt-token-here"
  }
}
```
**Benefits**:
- Secure authentication with bcrypt password verification
- Returns user profile and JWT token
- Logs login attempts for security monitoring

### GET /api/auth/profile
**Purpose**: Get current user's profile information
**Authentication**: Required
**Response**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "user"
    }
  }
}
```
**Benefits**:
- Secure profile access with JWT verification
- Returns current user data

### POST /api/auth/logout
**Purpose**: Log user logout action
**Authentication**: Required
**Response**:
```json
{
  "success": true,
  "message": "Logout successful"
}
```
**Benefits**:
- Logs logout action for audit trail
- Client should remove token from storage

---

## 💳 Payment Processing Endpoints

### POST /api/payments/authorize
**Purpose**: Authorize a payment transaction
**Authentication**: Required
**Request Body**:
```json
{
  "paymentMethodId": "payment-method-uuid",
  "amount": 100.00,
  "currency": "USD",
  "description": "Payment for services"
}
```
**Response**:
```json
{
  "success": true,
  "message": "Payment authorized successfully",
  "data": {
    "transaction": {
      "id": "transaction-uuid",
      "amount": "100.00",
      "currency": "USD",
      "status": "authorized",
      "externalId": "TXN_ABC123",
      "createdAt": "2024-01-15T10:30:00.000Z"
    },
    "acquirerResponse": {
      "responseCode": "00",
      "responseMessage": "Approved",
      "authCode": "AUTH123"
    }
  }
}
```
**Benefits**:
- Secure payment authorization with mock acquirer
- Creates transaction record in database
- Returns detailed transaction and acquirer response
- Logs transaction for audit compliance

### POST /api/payments/:transactionId/capture
**Purpose**: Capture an authorized payment
**Authentication**: Required
**Request Body**:
```json
{
  "amount": 100.00
}
```
**Response**:
```json
{
  "success": true,
  "message": "Payment captured successfully",
  "data": {
    "transaction": {
      "id": "transaction-uuid",
      "amount": "100.00",
      "status": "captured",
      "externalId": "TXN_ABC123",
      "updatedAt": "2024-01-15T10:35:00.000Z"
    },
    "acquirerResponse": {
      "responseCode": "00",
      "responseMessage": "Capture successful"
    }
  }
}
```
**Benefits**:
- Captures authorized funds
- Updates transaction status
- Logs capture action for audit

### POST /api/payments/:transactionId/refund
**Purpose**: Refund a captured payment
**Authentication**: Required
**Request Body**:
```json
{
  "amount": 100.00
}
```
**Response**:
```json
{
  "success": true,
  "message": "Payment refunded successfully",
  "data": {
    "transaction": {
      "id": "transaction-uuid",
      "amount": "100.00",
      "status": "refunded",
      "externalId": "TXN_ABC123",
      "updatedAt": "2024-01-15T10:40:00.000Z"
    },
    "acquirerResponse": {
      "responseCode": "00",
      "responseMessage": "Refund successful"
    }
  }
}
```
**Benefits**:
- Processes payment refunds
- Updates transaction status
- Logs refund action for audit

### GET /api/payments/:transactionId
**Purpose**: Get transaction details
**Authentication**: Required
**Response**:
```json
{
  "success": true,
  "data": {
    "transaction": {
      "id": "transaction-uuid",
      "amount": "100.00",
      "currency": "USD",
      "status": "authorized",
      "transactionType": "authorize",
      "externalId": "TXN_ABC123",
      "description": "Payment for services",
      "metadata": { /* Acquirer response data */ },
      "paymentMethod": {
        "lastFour": "1234",
        "brand": "visa",
        "expiryMonth": 12,
        "expiryYear": 2025
      },
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  }
}
```
**Benefits**:
- Secure transaction lookup
- Returns complete transaction details
- Includes payment method information

---

## 🧪 Testing Endpoints

### POST /test/validation/user
**Purpose**: Test user validation rules
**Authentication**: None required
**Request Body**:
```json
{
  "email": "test@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe"
}
```

### POST /test/validation/payment
**Purpose**: Test payment method validation
**Authentication**: None required
**Request Body**:
```json
{
  "token": "payment-token",
  "lastFour": "1234",
  "brand": "visa",
  "expiryMonth": 12,
  "expiryYear": 2025
}
```

### POST /test/validation/transaction
**Purpose**: Test transaction validation
**Authentication**: None required
**Request Body**:
```json
{
  "amount": 100.00,
  "currency": "USD",
  "description": "Test transaction"
}
```

---

## 🛡️ Fraud Detection Endpoints

### POST /api/fraud/analyze/:transactionId
**Purpose**: Analyze a transaction for fraud risk
**Authentication**: Required
**Response**:
```json
{
  "success": true,
  "message": "Fraud analysis completed",
  "data": {
    "transaction": {
      "id": "transaction-uuid",
      "amount": "100.00",
      "currency": "USD",
      "status": "authorized"
    },
    "fraudAnalysis": {
      "riskScore": 45,
      "riskLevel": "medium",
      "triggeredRules": [
        {
          "rule": "NIGHT_TRANSACTION",
          "weight": 5,
          "value": 23
        }
      ],
      "analysisTimestamp": "2024-01-15T10:30:00.000Z"
    }
  }
}
```
**Benefits**:
- Real-time fraud risk assessment
- Rule-based scoring with detailed analysis
- Stores fraud data for ML training
- Logs analysis for audit compliance

### GET /api/fraud/statistics
**Purpose**: Get fraud detection statistics
**Authentication**: Required
**Query Parameters**:
- `timeRange` (optional): 1h, 24h, 7d, 30d (default: 24h)

**Response**:
```json
{
  "success": true,
  "data": {
    "timeRange": "24h",
    "statistics": {
      "totalTransactions": 150,
      "riskDistribution": {
        "low": 120,
        "medium": 25,
        "high": 4,
        "critical": 1
      },
      "averageRiskScore": 28.5,
      "maxRiskScore": 95
    }
  }
}
```
**Benefits**:
- Comprehensive fraud statistics
- Risk distribution analysis
- Admin and user-specific views
- Historical trend analysis

### GET /api/fraud/flagged
**Purpose**: Get flagged transactions by risk level
**Authentication**: Required
**Query Parameters**:
- `riskLevel` (optional): low, medium, high, critical (default: high)
- `limit` (optional): Number of results (default: 50)

**Response**:
```json
{
  "success": true,
  "data": {
    "riskLevel": "high",
    "transactions": [
      {
        "fraudScoreId": "fraud-uuid",
        "riskScore": 85,
        "riskLevel": "high",
        "triggeredRules": [
          {
            "rule": "VELOCITY_SAME_CARD",
            "weight": 25,
            "value": 8,
            "threshold": 5
          }
        ],
        "analysisTime": "2024-01-15T10:30:00.000Z",
        "transaction": {
          "id": "transaction-uuid",
          "amount": "5000.00",
          "currency": "USD",
          "status": "authorized",
          "createdAt": "2024-01-15T10:25:00.000Z",
          "paymentMethod": {
            "lastFour": "1234",
            "brand": "visa"
          }
        },
        "userEmail": "user@example.com"
      }
    ]
  }
}
```
**Benefits**:
- Flagged transaction monitoring
- Detailed fraud analysis results
- Admin oversight capabilities
- Risk-based transaction filtering

---

## 📊 System Endpoints

### GET /
**Purpose**: API status and information
**Response**:
```json
{
  "message": "PaySecure Gateway API",
  "status": "running",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "security": "enabled",
  "validation": "enabled",
  "authentication": "enabled",
  "payments": "enabled",
  "fraudDetection": "enabled"
}
```

### GET /health
**Purpose**: System health check
**Response**:
```json
{
  "status": "healthy",
  "uptime": 3600.123,
  "database": "connected",
  "dbTime": "2024-01-15T10:30:00.123456Z"
}
```

---

## 🔒 Security Features

### Input Validation
- Email format validation and normalization
- Password complexity requirements (8+ chars, uppercase, lowercase, number, special char)
- Amount validation (positive decimal with 2 decimal places)
- UUID format validation
- Card brand validation (visa, mastercard, amex, discover)

### Authentication & Authorization
- JWT tokens with 24-hour expiry
- bcrypt password hashing (12 rounds)
- Role-based access control (user, admin)
- Token verification on protected routes

### Rate Limiting
- 100 requests per 15 minutes per IP
- Prevents API abuse and DoS attacks

### Audit Logging
- All authentication actions logged
- All payment transactions logged
- IP address and user agent tracking
- Comprehensive audit trail for compliance

### Security Headers
- Helmet.js for security headers
- CORS configuration
- Request size limiting (10MB)