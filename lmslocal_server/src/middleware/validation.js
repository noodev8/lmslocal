// Input validation middleware
const validateInput = (req, res, next) => {
    try {
        // Log the request for debugging
        console.log(`🔍 Validating input for ${req.method} ${req.path}`);
        
        // Basic sanitization - trim strings
        if (req.body && typeof req.body === 'object') {
            for (const [key, value] of Object.entries(req.body)) {
                if (typeof value === 'string') {
                    req.body[key] = value.trim();
                }
            }
        }

        // Check for potentially malicious input
        const jsonStr = JSON.stringify(req.body);
        const suspiciousPatterns = [
            /<script/i,           // Script tags
            /javascript:/i,       // JavaScript URLs
            /vbscript:/i,         // VBScript URLs
            /on\w+\s*=/i,         // Event handlers
            /<iframe/i,           // Iframes
            /SELECT.*FROM/i,      // SQL injection attempts
            /UNION.*SELECT/i,     // SQL injection attempts
            /DROP.*TABLE/i,       // SQL injection attempts
            /INSERT.*INTO/i,      // SQL injection attempts
            /DELETE.*FROM/i       // SQL injection attempts
        ];

        for (const pattern of suspiciousPatterns) {
            if (pattern.test(jsonStr)) {
                console.log('🚫 Suspicious input detected');
                return res.status(400).json({
                    return_code: 'VALIDATION_ERROR',
                    message: 'Invalid input detected'
                });
            }
        }

        // Continue to next middleware
        next();

    } catch (error) {
        console.error('❌ Validation middleware error:', error.message);
        res.status(500).json({
            return_code: 'SERVER_ERROR',
            message: 'Input validation failed'
        });
    }
};

module.exports = {
    validateInput
};