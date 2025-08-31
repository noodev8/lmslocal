/*
=======================================================================================================================================
Input Validation Utilities - Centralized validation and sanitization functions
=======================================================================================================================================
Purpose: Provide consistent input validation across all routes with proper error messages
Created: As part of Code Quality Improvement Plan
=======================================================================================================================================
*/

/**
 * Validate and sanitize integer input
 * @param {any} value - Value to validate
 * @param {string} fieldName - Name of field for error messages
 * @param {Object} options - Validation options
 * @param {number} options.min - Minimum allowed value
 * @param {number} options.max - Maximum allowed value
 * @param {boolean} options.required - Whether field is required (default: true)
 * @returns {number|null} Validated integer or null if invalid
 */
const validateInteger = (value, fieldName, options = {}) => {
  const { min = 1, max = 2147483647, required = true } = options;
  
  // Handle required field validation
  if (value === null || value === undefined || value === '') {
    if (required) {
      throw new ValidationError(`${fieldName} is required`);
    }
    return null;
  }

  // Convert to number if string
  const numValue = typeof value === 'string' ? parseInt(value, 10) : value;
  
  // Check if valid integer
  if (!Number.isInteger(numValue) || isNaN(numValue)) {
    throw new ValidationError(`${fieldName} must be a valid integer`);
  }

  // Check range
  if (numValue < min) {
    throw new ValidationError(`${fieldName} must be at least ${min}`);
  }
  
  if (numValue > max) {
    throw new ValidationError(`${fieldName} cannot exceed ${max}`);
  }

  return numValue;
};

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @param {boolean} required - Whether email is required
 * @returns {string|null} Validated email or null if invalid
 */
const validateEmail = (email, required = true) => {
  if (!email || email.trim() === '') {
    if (required) {
      throw new ValidationError('Email is required');
    }
    return null;
  }

  const sanitizedEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(sanitizedEmail)) {
    throw new ValidationError('Please enter a valid email address');
  }

  if (sanitizedEmail.length > 320) { // RFC 5321 limit
    throw new ValidationError('Email address is too long');
  }

  return sanitizedEmail;
};

/**
 * Validate and sanitize string input
 * @param {string} value - String to validate
 * @param {string} fieldName - Name of field for error messages
 * @param {Object} options - Validation options
 * @param {number} options.minLength - Minimum string length
 * @param {number} options.maxLength - Maximum string length
 * @param {boolean} options.required - Whether field is required
 * @param {RegExp} options.pattern - Regex pattern to match
 * @param {boolean} options.trim - Whether to trim whitespace
 * @returns {string|null} Validated string or null if invalid
 */
const validateString = (value, fieldName, options = {}) => {
  const { 
    minLength = 0, 
    maxLength = 1000, 
    required = true, 
    pattern = null,
    trim = true 
  } = options;
  
  if (value === null || value === undefined) {
    if (required) {
      throw new ValidationError(`${fieldName} is required`);
    }
    return null;
  }

  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`);
  }

  const processedValue = trim ? value.trim() : value;
  
  if (processedValue === '' && required) {
    throw new ValidationError(`${fieldName} is required`);
  }

  if (processedValue.length < minLength) {
    throw new ValidationError(`${fieldName} must be at least ${minLength} characters long`);
  }

  if (processedValue.length > maxLength) {
    throw new ValidationError(`${fieldName} cannot exceed ${maxLength} characters`);
  }

  if (pattern && !pattern.test(processedValue)) {
    throw new ValidationError(`${fieldName} format is invalid`);
  }

  return processedValue;
};

/**
 * Validate boolean input
 * @param {any} value - Value to validate as boolean
 * @param {string} fieldName - Name of field for error messages
 * @param {boolean} required - Whether field is required
 * @returns {boolean|null} Validated boolean or null if not provided
 */
const validateBoolean = (value, fieldName, required = true) => {
  if (value === null || value === undefined) {
    if (required) {
      throw new ValidationError(`${fieldName} is required`);
    }
    return null;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const lowerValue = value.toLowerCase();
    if (lowerValue === 'true' || lowerValue === '1' || lowerValue === 'yes') {
      return true;
    }
    if (lowerValue === 'false' || lowerValue === '0' || lowerValue === 'no') {
      return false;
    }
  }

  if (typeof value === 'number') {
    return Boolean(value);
  }

  throw new ValidationError(`${fieldName} must be a valid boolean value`);
};

/**
 * Validate date input
 * @param {any} value - Date value to validate
 * @param {string} fieldName - Name of field for error messages
 * @param {Object} options - Validation options
 * @param {boolean} options.required - Whether field is required
 * @param {Date} options.minDate - Minimum allowed date
 * @param {Date} options.maxDate - Maximum allowed date
 * @returns {Date|null} Validated date or null if invalid
 */
const validateDate = (value, fieldName, options = {}) => {
  const { required = true, minDate = null, maxDate = null } = options;
  
  if (value === null || value === undefined || value === '') {
    if (required) {
      throw new ValidationError(`${fieldName} is required`);
    }
    return null;
  }

  const date = new Date(value);
  
  if (isNaN(date.getTime())) {
    throw new ValidationError(`${fieldName} must be a valid date`);
  }

  if (minDate && date < minDate) {
    throw new ValidationError(`${fieldName} cannot be before ${minDate.toISOString().split('T')[0]}`);
  }

  if (maxDate && date > maxDate) {
    throw new ValidationError(`${fieldName} cannot be after ${maxDate.toISOString().split('T')[0]}`);
  }

  return date;
};

/**
 * Sanitize input to prevent XSS and injection attacks
 * @param {string} input - Input string to sanitize
 * @returns {string} Sanitized string
 */
const sanitizeInput = (input) => {
  if (typeof input !== 'string') {
    return input;
  }

  return input
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
};

/**
 * Validate request body against schema
 * @param {Object} body - Request body to validate
 * @param {Object} schema - Validation schema
 * @returns {Object} Validated and sanitized data
 */
const validateRequestBody = (body, schema) => {
  const validatedData = {};
  const errors = [];

  for (const [field, rules] of Object.entries(schema)) {
    try {
      const value = body[field];
      
      switch (rules.type) {
        case 'integer':
          validatedData[field] = validateInteger(value, field, rules.options);
          break;
        case 'string':
          validatedData[field] = validateString(value, field, rules.options);
          break;
        case 'email':
          validatedData[field] = validateEmail(value, rules.required !== false);
          break;
        case 'boolean':
          validatedData[field] = validateBoolean(value, field, rules.required !== false);
          break;
        case 'date':
          validatedData[field] = validateDate(value, field, rules.options);
          break;
        default:
          throw new ValidationError(`Unknown validation type: ${rules.type}`);
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        errors.push(error.message);
      } else {
        errors.push(`Validation error for ${field}: ${error.message}`);
      }
    }
  }

  if (errors.length > 0) {
    throw new ValidationError(errors.join('; '));
  }

  return validatedData;
};

/**
 * Custom validation error class
 */
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

module.exports = {
  validateInteger,
  validateEmail,
  validateString,
  validateBoolean,
  validateDate,
  sanitizeInput,
  validateRequestBody,
  ValidationError
};