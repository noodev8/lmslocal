const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Import configuration and routes
const { testConnection } = require('./src/config/database');
const { validateInput } = require('./src/middleware/validation');
const healthRoutes = require('./src/routes/health');
const authRoutes = require('./src/routes/auth');
const protectedRoutes = require('./src/routes/protected');
const organisationRoutes = require('./src/routes/organisation');
const userRoutes = require('./src/routes/user');
const competitionRoutes = require('./src/routes/competition');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware setup
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`📝 ${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Input validation middleware (for all POST routes)
app.use('/api', (req, res, next) => {
    if (req.method === 'POST') {
        validateInput(req, res, next);
    } else {
        next();
    }
});

// Routes
app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/protected', protectedRoutes);
app.use('/api/organisation', organisationRoutes);
app.use('/api/user', userRoutes);
app.use('/api/competition', competitionRoutes);

// Default route
app.get('/', (req, res) => {
    res.json({
        message: 'LMSLocal Server is running',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('❌ Server error:', error.message);
    res.status(500).json({
        return_code: 'SERVER_ERROR',
        message: 'Internal server error',
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use('*', (req, res) => {
    console.log(`❓ Route not found: ${req.method} ${req.path}`);
    res.status(404).json({
        return_code: 'ROUTE_NOT_FOUND',
        message: 'Route not found',
        timestamp: new Date().toISOString()
    });
});

// Start server
const startServer = async () => {
    try {
        console.log('🚀 Starting LMSLocal Server...');
        console.log('📋 Environment:', process.env.NODE_ENV || 'development');
        
        // Test database connection
        const dbConnected = await testConnection();
        if (!dbConnected) {
            console.warn('⚠️  Database connection failed - server starting in standalone mode');
            console.warn('🔧 Please configure PostgreSQL on VPS to allow your IP address');
        }
        
        // Start Express server
        app.listen(PORT, () => {
            console.log('🟢 Server running successfully');
            console.log(`📍 Server URL: http://localhost:${PORT}`);
            console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
            console.log('🔄 Press Ctrl+C to stop server\n');
        });
        
    } catch (error) {
        console.error('❌ Server startup failed:', error.message);
        process.exit(1);
    }
};

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server gracefully...');
    process.exit(0);
});

// Start the server
startServer();