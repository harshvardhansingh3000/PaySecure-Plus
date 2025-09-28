// Mock Acquirer Service - Simulates third-party payment processor
// Educational/Demo purposes only - not production ready

const MOCK_RESPONSES = {
    // Simulate different response scenarios
    scenarios: {
      success: { success: true, decline_reason: null },
      insufficient_funds: { success: false, decline_reason: 'insufficient_funds' },
      invalid_card: { success: false, decline_reason: 'invalid_card' },
      expired_card: { success: false, decline_reason: 'expired_card' },
      fraud_detected: { success: false, decline_reason: 'fraud_detected' },
      network_error: { success: false, decline_reason: 'network_error' }
    }
  };
  
  // Simulate network delay
  const simulateNetworkDelay = () => {
    return new Promise(resolve => {
      setTimeout(resolve, Math.random() * 1000 + 500); // 500-1500ms delay
    });
  };
  
  // Generate mock transaction ID
  const generateMockTransactionId = () => {
    return 'TXN_' + Math.random().toString(36).substring(2, 9).toUpperCase();
  };
  
  // Determine response scenario based on amount and card details
  const determineScenario = (amount, lastFour, brand) => {
    // Simulate different failure scenarios
    if (amount > 10000) {
      return Math.random() < 0.3 ? 'insufficient_funds' : 'success';
    }
    
    if (lastFour === '0000') {
      return 'invalid_card';
    }
    
    if (lastFour === '0001') {
      return 'expired_card';
    }
    
    if (lastFour === '0002') {
      return 'fraud_detected';
    }
    
    if (lastFour === '0003') {
      return 'network_error';
    }
    
    // 95% success rate for valid cards
    return Math.random() < 0.95 ? 'success' : 'insufficient_funds';
  };
  
  // Mock authorize transaction
  export const authorizeTransaction = async (transactionData) => {
    await simulateNetworkDelay();
    
    const { amount, currency, lastFour, brand, expiryMonth, expiryYear } = transactionData;
    
    // Check if card is expired
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    
    if (expiryYear < currentYear || (expiryYear === currentYear && expiryMonth < currentMonth)) {
      return {
        success: false,
        transaction_id: null,
        decline_reason: 'expired_card',
        response_code: '54',
        response_message: 'Card expired'
      };
    }
    
    const scenario = determineScenario(amount, lastFour, brand);
    const response = MOCK_RESPONSES.scenarios[scenario];
    
    if (response.success) {
      return {
        success: true,
        transaction_id: generateMockTransactionId(),
        decline_reason: null,
        response_code: '00',
        response_message: 'Approved',
        auth_code: Math.random().toString(36).substr(2, 6).toUpperCase()
      };
    } else {
      const declineMessages = {
        insufficient_funds: 'Insufficient funds',
        invalid_card: 'Invalid card number',
        expired_card: 'Card expired',
        fraud_detected: 'Fraud detected',
        network_error: 'Network error'
      };
      
      return {
        success: false,
        transaction_id: null,
        decline_reason: response.decline_reason,
        response_code: '05',
        response_message: declineMessages[response.decline_reason]
      };
    }
  };
  
  // Mock capture transaction
  export const captureTransaction = async (authorizationId, amount) => {
    await simulateNetworkDelay();
    
    // Simulate 99% success rate for captures
    if (Math.random() < 0.99) {
      return {
        success: true,
        transaction_id: generateMockTransactionId(),
        response_code: '00',
        response_message: 'Capture successful'
      };
    } else {
      return {
        success: false,
        transaction_id: null,
        response_code: '96',
        response_message: 'System error'
      };
    }
  };
  
  // Mock refund transaction
  export const refundTransaction = async (originalTransactionId, amount) => {
    await simulateNetworkDelay();
    
    // Simulate 98% success rate for refunds
    if (Math.random() < 0.98) {
      return {
        success: true,
        transaction_id: generateMockTransactionId(),
        response_code: '00',
        response_message: 'Refund successful'
      };
    } else {
      return {
        success: false,
        transaction_id: null,
        response_code: '96',
        response_message: 'Refund failed'
      };
    }
  };