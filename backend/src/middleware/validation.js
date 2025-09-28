import { body, param, validationResult } from 'express-validator';
// body → used to validate fields in the request body (like req.body.email).

// param → used to validate route parameters (like req.params.id).

// validationResult → a function that collects all validation errors after checks are run.
// Validation error handler middleware
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(error => ({
        field: error.path,
        message: error.msg,
        value: error.value
      }))
    });
  }
  next();
};

// User registration validation
export const validateUserRegistration = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
    // body('email') → validates the email field in the request body.

    // .isEmail() → checks if it is a valid email format.
    
    // .normalizeEmail() → converts email to lowercase and removes extra spaces.
    
    // .withMessage(...) → custom error message if the check fails.
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    // .isLength({ min: 8 }) → password must be at least 8 characters.

    // .matches(...) → password must include:
    
    // at least one lowercase letter
    
    // at least one uppercase letter
    
    // at least one number
    
    // at least one special character (@, $, !, %, *, ?, &)
    body('firstName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  body('lastName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  handleValidationErrors
];

// User login validation
export const validateUserLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  handleValidationErrors
];

// Payment method validation
export const validatePaymentMethod = [
  body('token')
    .notEmpty()
    .withMessage('Payment token is required'),
  body('lastFour')
    .isLength({ min: 4, max: 4 })
    .isNumeric()
    .withMessage('Last four digits must be exactly 4 numbers'),
  body('brand')
    .isIn(['visa', 'mastercard', 'amex', 'discover'])
    .withMessage('Valid card brand is required'),
  body('expiryMonth')
    .isInt({ min: 1, max: 12 })
    .withMessage('Expiry month must be between 1 and 12'),
  body('expiryYear')
    .isInt({ min: new Date().getFullYear() })
    .withMessage('Expiry year must be current year or later'),
  handleValidationErrors
];

// Transaction validation
export const validateTransaction = [
  body('amount')
    .isDecimal({ decimal_digits: '0,2' })
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive decimal with up to 2 decimal places'),
  body('currency')
    .isLength({ min: 3, max: 3 })
    .isUppercase()
    .withMessage('Currency must be a 3-letter uppercase code (e.g., USD)'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  handleValidationErrors
];

// UUID parameter validation
export const validateUUID = [
  param('id')
    .isUUID()
    .withMessage('Invalid ID format'),
  handleValidationErrors
];