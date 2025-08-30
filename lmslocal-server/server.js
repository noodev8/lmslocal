/*
=======================================================================================================================================
LMSLocal Express Server
=======================================================================================================================================
Purpose: Main Express server for Last Man Standing application
Port: 3015
Database: PostgreSQL
=======================================================================================================================================
*/

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Import routes
const loginRoute = require('./routes/login');
const registerRoute = require('./routes/register');
const updateProfileRoute = require('./routes/update-profile');
const forgotPasswordRoute = require('./routes/forgot-password');
const resetPasswordRoute = require('./routes/reset-password');
const verifyEmailRoute = require('./routes/verify-email');
const resendVerificationRoute = require('./routes/resend-verification');
const mycompetitionsRoute = require('./routes/mycompetitions');
const createCompetitionRoute = require('./routes/create-competition');
const teamListsRoute = require('./routes/team-lists');
const getTeamsRoute = require('./routes/get-teams');
const getCompetitionPlayersRoute = require('./routes/get-competition-players');
const removePlayerRoute = require('./routes/remove-player');
const createRoundRoute = require('./routes/create-round');
const updateRoundRoute = require('./routes/update-round');
const getRoundsRoute = require('./routes/get-rounds');
const addFixturesBulkRoute = require('./routes/add-fixtures-bulk');
const replaceFixturesBulkRoute = require('./routes/replace-fixtures-bulk');
const getFixturesRoute = require('./routes/get-fixtures');
const setFixtureResultRoute = require('./routes/set-fixture-result');
// const lockUnlockRoundRoute = require('./routes/lock-unlock-round'); // DISABLED: Round status removed
const lockUnlockCompetitionRoute = require('./routes/lock-unlock-competition');
const getCompetitionStatusRoute = require('./routes/get-competition-status');
// const joinCompetitionBySlugRoute = require('./routes/join-competition-by-slug'); // DISABLED - using single login
const getPlayerCurrentRoundRoute = require('./routes/get-player-current-round');
const setPickRoute = require('./routes/set-pick');
const adminSetPickRoute = require('./routes/admin-set-pick');
const calculateResultsRoute = require('./routes/calculate-results');
const joinCompetitionRoute = require('./routes/join-competition');
// const playerLoginRoute = require('./routes/player-login'); // DISABLED - using single login
const validateAccessCodeRoute = require('./routes/validate-access-code');
// const registerAndJoinCompetitionRoute = require('./routes/register-and-join-competition'); // DISABLED - using single login
const joinByAccessCodeRoute = require('./routes/join-by-access-code');
// const joinByCodeRoute = require('./routes/join-by-code'); // DISABLED - using single login
const playerDashboardRoute = require('./routes/player-dashboard');
const checkUserTypeRoute = require('./routes/check-user-type');
const getAllowedTeamsRoute = require('./routes/get-allowed-teams');
const unselectPickRoute = require('./routes/unselect-pick');
const getCurrentPickRoute = require('./routes/get-current-pick');
const getCalculatedFixturesRoute = require('./routes/get-calculated-fixtures');
const getCompetitionStandingsRoute = require('./routes/get-competition-standings');
const joinCompetitionByCodeRoute = require('./routes/join-competition-by-code');
const getFixturePickCountRoute = require('./routes/get-fixture-pick-count');
const getRoundHistoryRoute = require('./routes/get-round-history');

const app = express();
const PORT = process.env.PORT || 3015;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));

// General rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    return_code: "RATE_LIMIT_EXCEEDED",
    message: "Too many requests, please try again later"
  }
});
app.use(limiter);

// Aggressive rate limiting for database-heavy endpoints
const dbIntensiveLimit = rateLimit({
  windowMs: 10 * 1000, // 10 seconds
  max: 5, // Max 5 requests per 10 seconds per IP
  message: {
    return_code: "RATE_LIMIT_EXCEEDED",
    message: "Too many database requests. Please wait 10 seconds before trying again."
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by IP + endpoint to prevent rapid clicks on same endpoint
    return `${req.ip}-${req.path}`;
  }
});

// CORS configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001', 
  'http://localhost:3002',
  'http://localhost:3003'
];

// Function to check if origin is allowed
const isOriginAllowed = (origin) => {
  if (!origin) return true; // Allow requests with no origin
  if (allowedOrigins.includes(origin)) return true;
  if (process.env.CLIENT_URL === origin) return true;
  
  // Allow any local network IP on port 3000 (for mobile browser access)
  const localNetworkPattern = /^http:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+):3000$/;
  if (localNetworkPattern.test(origin)) return true;
  
  return false;
};

app.use(cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));


// Rate limiting will be applied within the competition router for specific endpoints

// Routes
app.use('/login', loginRoute);
app.use('/register', registerRoute);
app.use('/update-profile', updateProfileRoute);
app.use('/forgot-password', forgotPasswordRoute);
app.use('/reset-password', resetPasswordRoute);
app.use('/verify-email', verifyEmailRoute);
app.use('/resend-verification', resendVerificationRoute);
app.use('/mycompetitions', mycompetitionsRoute);
app.use('/create-competition', createCompetitionRoute);
app.use('/team-lists', teamListsRoute);
app.use('/get-teams', getTeamsRoute);
app.use('/get-competition-players', getCompetitionPlayersRoute);
app.use('/remove-player', removePlayerRoute);
app.use('/create-round', createRoundRoute);
app.use('/update-round', updateRoundRoute);
app.use('/get-rounds', getRoundsRoute);
app.use('/add-fixtures-bulk', addFixturesBulkRoute);
app.use('/replace-fixtures-bulk', replaceFixturesBulkRoute);
app.use('/get-fixtures', getFixturesRoute);
app.use('/set-fixture-result', setFixtureResultRoute);
// app.use('/lock-unlock-round', lockUnlockRoundRoute); // DISABLED: Round status removed
app.use('/lock-unlock-competition', lockUnlockCompetitionRoute);
app.use('/get-competition-status', getCompetitionStatusRoute);
// app.use('/join-competition-by-slug', joinCompetitionBySlugRoute); // DISABLED - using single login
app.use('/get-player-current-round', getPlayerCurrentRoundRoute);
app.use('/set-pick', setPickRoute);
app.use('/admin-set-pick', adminSetPickRoute);
app.use('/calculate-results', calculateResultsRoute);
app.use('/join-competition', joinCompetitionRoute);
// app.use('/player-login', playerLoginRoute); // DISABLED - using single login
app.use('/validate-access-code', validateAccessCodeRoute);
// app.use('/register-and-join-competition', registerAndJoinCompetitionRoute); // DISABLED - using single login
app.use('/join-by-access-code', joinByAccessCodeRoute);
// app.use('/join-by-code', joinByCodeRoute); // DISABLED - using single login
app.use('/player-dashboard', playerDashboardRoute);
app.use('/check-user-type', checkUserTypeRoute);
app.use('/get-allowed-teams', getAllowedTeamsRoute);
app.use('/unselect-pick', unselectPickRoute);
app.use('/get-current-pick', getCurrentPickRoute);
app.use('/get-calculated-fixtures', getCalculatedFixturesRoute);
app.use('/get-competition-standings', getCompetitionStandingsRoute);
app.use('/join-competition-by-code', joinCompetitionByCodeRoute);
app.use('/get-fixture-pick-count', getFixturePickCountRoute);
app.use('/get-round-history', getRoundHistoryRoute);

// Default route for testing
app.get('/', (req, res) => {
  res.json({
    return_code: "SUCCESS",
    message: "LMSLocal API Server",
    version: "1.0.0",
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    return_code: "ENDPOINT_NOT_FOUND",
    message: "Endpoint not found"
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    return_code: "SERVER_ERROR",
    message: "Internal server error"
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`=======================================================================`);
  console.log(`LMSLocal Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Database: ${process.env.DB_NAME}@${process.env.DB_HOST}:${process.env.DB_PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`=======================================================================`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process, just log the error
});

// Handle uncaught exceptions  
process.on('uncaughtException', (error) => {
  console.error('=== UNCAUGHT EXCEPTION ===');
  console.error('Error:', error);
  console.error('Stack:', error.stack);
  console.error('Memory at crash:', process.memoryUsage());
  console.error('========================');
  // Log but don't exit in development
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

// Handle process signals
process.on('SIGTERM', () => {
  console.log('=== SIGTERM received ===');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('=== SIGINT received ===');
  process.exit(0);
});

// Handle exit
process.on('exit', (code) => {
  console.log(`=== Process exiting with code ${code} ===`);
});

module.exports = app;