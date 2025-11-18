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
const { testConnection, getPoolStatus } = require('./database');

// Import routes
const loginRoute = require('./routes/login');
const registerRoute = require('./routes/register');
const updateProfileRoute = require('./routes/update-profile');
const forgotPasswordRoute = require('./routes/forgot-password');
const resetPasswordRoute = require('./routes/reset-password');
const verifyEmailRoute = require('./routes/verify-email');
const resendVerificationRoute = require('./routes/resend-verification');
const submitOnboardingApplicationRoute = require('./routes/submit-onboarding-application');
const createCompetitionRoute = require('./routes/create-competition');
const teamListsRoute = require('./routes/team-lists');
const getTeamsRoute = require('./routes/get-teams');
const getCompetitionPlayersRoute = require('./routes/get-competition-players');
const removePlayerRoute = require('./routes/remove-player');
// DISABLED: Manual fixture management - replaced by automated fixture service
// const createRoundRoute = require('./routes/create-round');
// const updateRoundRoute = require('./routes/update-round');
const updateCompetitionRoute = require('./routes/update-competition');
const resetCompetitionRoute = require('./routes/reset-competition');
const deleteCompetitionRoute = require('./routes/delete-competition');
const getRoundsRoute = require('./routes/get-rounds');
// DISABLED: Manual fixture management - replaced by automated fixture service
// const addFixturesBulkRoute = require('./routes/add-fixtures-bulk');
const getFixturesRoute = require('./routes/get-fixtures');
// DISABLED: Manual fixture management - replaced by automated fixture service
// const resetFixturesRoute = require('./routes/reset-fixtures');
// const setFixtureResultRoute = require('./routes/set-fixture-result');
// const lockUnlockRoundRoute = require('./routes/lock-unlock-round'); // DISABLED: Round status removed
// const getCompetitionStatusRoute = require('./routes/get-competition-status'); // DISABLED: Superseded by get-user-dashboard
// const joinCompetitionBySlugRoute = require('./routes/join-competition-by-slug'); // DISABLED - using single login
// const getPlayerCurrentRoundRoute = require('./routes/get-player-current-round'); // DISABLED - not used in web frontend
const setPickRoute = require('./routes/set-pick');
const adminSetPickRoute = require('./routes/admin-set-pick');
const updatePlayerLivesRoute = require('./routes/update-player-lives');
const updatePlayerStatusRoute = require('./routes/update-player-status');
const updatePaymentStatusRoute = require('./routes/update-payment-status');
// REMOVED: calculate-results (orphaned code - never used)

// const playerLoginRoute = require('./routes/player-login'); // DISABLED - using single login
// const registerAndJoinCompetitionRoute = require('./routes/register-and-join-competition'); // DISABLED - using single login
// const joinByCodeRoute = require('./routes/join-by-code'); // DISABLED - using single login
const getUserDashboardRoute = require('./routes/get-user-dashboard');
const getBillingHistoryRoute = require('./routes/get-billing-history');
const createCheckoutSessionRoute = require('./routes/create-checkout-session');
const validatePromoCodeRoute = require('./routes/validate-promo-code');
const stripeWebhookRoute = require('./routes/stripe-webhook');

// PAYG Credit System Routes
const getUserCreditsRoute = require('./routes/get-user-credits');
const deductCreditRoute = require('./routes/deduct-credit');
const checkUserTypeRoute = require('./routes/check-user-type');
const getAllowedTeamsRoute = require('./routes/get-allowed-teams');
const unselectPickRoute = require('./routes/unselect-pick');
const getCurrentPickRoute = require('./routes/get-current-pick');
// DISABLED: Manual fixture management - replaced by automated fixture service
// const getCalculatedFixturesRoute = require('./routes/get-calculated-fixtures');
// const getCompetitionStandingsRoute = require('./routes/get-competition-standings'); // DISABLED - replaced by get-standings-summary + get-standings-group
const getStandingsSummaryRoute = require('./routes/get-standings-summary');
const getStandingsGroupRoute = require('./routes/get-standings-group');
const searchPlayersRoute = require('./routes/search-players');
const getPlayerHistoryRoute = require('./routes/get-player-history');
const joinCompetitionByCodeRoute = require('./routes/join-competition-by-code');
const getFixturePickCountRoute = require('./routes/get-fixture-pick-count');
const getRoundHistoryRoute = require('./routes/get-round-history');
const addOfflinePlayerRoute = require('./routes/add-offline-player');
const changePasswordRoute = require('./routes/change-password');
const deleteAccountRoute = require('./routes/delete-account');
const getPickStatisticsRoute = require('./routes/get-pick-statistics');
const getUnpickedPlayersRoute = require('./routes/get-unpicked-players');
// const getDashboardStatsRoute = require('./routes/get-dashboard-stats'); // DISABLED - consolidated into get-user-dashboard
// DISABLED: Manual fixture management - replaced by automated fixture service
// const submitResultsRoute = require('./routes/submit-results');
const hideCompetitionRoute = require('./routes/hide-competition');
const unhidePlayerRoute = require('./routes/unhide-player');

const updatePersonalCompetitionNameRoute = require('./routes/update-personal-competition-name');
const updatePlayerDisplayNameRoute = require('./routes/update-player-display-name');

// Promote/Marketing Routes
const getPromoteDataRoute = require('./routes/get-promote-data');
const getRoundResultsBreakdownRoute = require('./routes/get-round-results-breakdown');
const getRoundStatisticsRoute = require('./routes/get-round-statistics');

// Email Routes
const loadPickReminderRoute = require('./routes/load-pick-reminder');
const loadResultsEmailRoute = require('./routes/load-results-email');
const loadWelcomeCompetitionRoute = require('./routes/load-welcome-competition');
const sendEmailRoute = require('./routes/send-email');
const getEmailPreferencesRoute = require('./routes/get-email-preferences');
const updateEmailPreferencesBatchRoute = require('./routes/update-email-preferences-batch');
// DISABLED: Manual fixture management - replaced by automated fixture service
// const organiserMidRoundSubmitTipRoute = require('./routes/organiser-mid-round-submit-tip');

// Admin Routes
const pushFixturesToCompetitionsRoute = require('./routes/admin/push-fixtures-to-competitions');
const pushResultsToCompetitionsRoute = require('./routes/admin/push-results-to-competitions');
const adminAddFixturesRoute = require('./routes/admin-add-fixtures');
const adminGetFixturesForResultsRoute = require('./routes/admin-get-fixtures-for-results');
const adminSetResultRoute = require('./routes/admin-set-result');

// Organizer Fixture Management Routes (for manual competitions - fixture_service = false)
const organizerAddFixturesRoute = require('./routes/organizer-add-fixtures');
const organizerGetFixturesForResultsRoute = require('./routes/organizer-get-fixtures-for-results');
const organizerSetResultRoute = require('./routes/organizer-set-result');
const organizerProcessResultsRoute = require('./routes/organizer-process-results');
const organizerUpdatePlayerPermissionsRoute = require('./routes/organizer-update-player-permissions');

// Bot Routes
const botJoinRoute = require('./routes/bot-join');
const botPickRoute = require('./routes/bot-pick');

const app = express();
const PORT = process.env.PORT || 3015;

// Trust proxy configuration for rate limiting and IP detection
// IMPORTANT: Set to false in development, configure properly in production
// If behind reverse proxy (nginx, CloudFlare, etc.), set to number of proxies or IP ranges
// See: https://expressjs.com/en/guide/behind-proxies.html
if (process.env.NODE_ENV === 'production') {
  // Production: Set to number of proxies (1 for single reverse proxy)
  // Or use specific IP ranges for more security
  app.set('trust proxy', 1); // Adjust based on your proxy setup
} else {
  // Development: No reverse proxy
  app.set('trust proxy', false);
}

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
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: {
    return_code: "RATE_LIMIT_EXCEEDED",
    message: "Too many requests, please try again later"
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
app.use(limiter);

// Aggressive rate limiting for database-heavy endpoints
const dbIntensiveLimit = rateLimit({
  windowMs: 10 * 1000, // 10 seconds
  max: 50, // Max 50 requests per 10 seconds per IP
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

// CORS configuration - read from environment variable
const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map(url => url.trim())
  : [];

// Function to check if origin is allowed
const isOriginAllowed = (origin) => {
  if (!origin) return true; // Allow requests with no origin
  if (allowedOrigins.includes(origin)) return true;

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
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Cache-Control', 'Pragma']
}));

// Special webhook route with raw body parsing (MUST be before express.json())
// Stripe webhooks need raw body for signature verification
app.use('/stripe-webhook', express.raw({ type: 'application/json' }), (req, res, next) => {
  // Store raw body for webhook signature verification
  req.rawBody = req.body;
  next();
}, stripeWebhookRoute);

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
app.use('/submit-onboarding-application', submitOnboardingApplicationRoute);
app.use('/create-competition', createCompetitionRoute);
app.use('/team-lists', teamListsRoute);
app.use('/get-teams', getTeamsRoute);
app.use('/get-competition-players', dbIntensiveLimit, getCompetitionPlayersRoute);
app.use('/remove-player', removePlayerRoute);
// DISABLED: Manual fixture management - replaced by automated fixture service
// app.use('/create-round', createRoundRoute);
// app.use('/update-round', updateRoundRoute);
app.use('/update-competition', updateCompetitionRoute);
app.use('/reset-competition', resetCompetitionRoute);
app.use('/delete-competition', deleteCompetitionRoute);
app.use('/get-rounds', getRoundsRoute);
// DISABLED: Manual fixture management - replaced by automated fixture service
// app.use('/add-fixtures-bulk', addFixturesBulkRoute);
app.use('/get-fixtures', getFixturesRoute);
// DISABLED: Manual fixture management - replaced by automated fixture service
// app.use('/reset-fixtures', resetFixturesRoute);
// app.use('/set-fixture-result', setFixtureResultRoute);
// app.use('/lock-unlock-round', lockUnlockRoundRoute); // DISABLED: Round status removed
// app.use('/get-competition-status', getCompetitionStatusRoute); // DISABLED: Superseded by get-user-dashboard
// app.use('/join-competition-by-slug', joinCompetitionBySlugRoute); // DISABLED - using single login
// app.use('/get-player-current-round', getPlayerCurrentRoundRoute); // DISABLED - not used in web frontend
app.use('/set-pick', setPickRoute);
app.use('/admin-set-pick', adminSetPickRoute);
app.use('/update-player-lives', updatePlayerLivesRoute);
app.use('/update-player-status', updatePlayerStatusRoute);
app.use('/update-payment-status', updatePaymentStatusRoute);
// REMOVED: /calculate-results (orphaned code - never used)

// app.use('/player-login', playerLoginRoute); // DISABLED - using single login
// app.use('/register-and-join-competition', registerAndJoinCompetitionRoute); // DISABLED - using single login
// app.use('/join-by-code', joinByCodeRoute); // DISABLED - using single login
app.use('/get-user-dashboard', getUserDashboardRoute);

// PAYG Credit System API Routes
app.use('/get-billing-history', getBillingHistoryRoute);
app.use('/create-checkout-session', createCheckoutSessionRoute);
app.use('/validate-promo-code', validatePromoCodeRoute);
app.use('/get-user-credits', getUserCreditsRoute);
app.use('/deduct-credit', deductCreditRoute);

app.use('/check-user-type', checkUserTypeRoute);
app.use('/get-allowed-teams', getAllowedTeamsRoute);
app.use('/unselect-pick', unselectPickRoute);
app.use('/get-current-pick', getCurrentPickRoute);
// DISABLED: Manual fixture management - replaced by automated fixture service
// app.use('/get-calculated-fixtures', getCalculatedFixturesRoute);
// app.use('/get-competition-standings', getCompetitionStandingsRoute); // DISABLED - replaced by get-standings-summary + get-standings-group
app.use('/get-standings-summary', getStandingsSummaryRoute);
app.use('/get-standings-group', getStandingsGroupRoute);
app.use('/search-players', searchPlayersRoute);
app.use('/get-player-history', getPlayerHistoryRoute);
app.use('/join-competition-by-code', joinCompetitionByCodeRoute);
app.use('/get-fixture-pick-count', getFixturePickCountRoute);
app.use('/get-round-history', getRoundHistoryRoute);
app.use('/add-offline-player', addOfflinePlayerRoute);
app.use('/change-password', changePasswordRoute);
app.use('/delete-account', deleteAccountRoute);
app.use('/get-pick-statistics', getPickStatisticsRoute);
app.use('/get-unpicked-players', getUnpickedPlayersRoute);
// app.use('/get-dashboard-stats', getDashboardStatsRoute); // DISABLED - consolidated into get-user-dashboard
// DISABLED: Manual fixture management - replaced by automated fixture service
// app.use('/submit-results', submitResultsRoute);
app.use('/hide-competition', hideCompetitionRoute);
app.use('/unhide-player', unhidePlayerRoute);

app.use('/update-personal-competition-name', updatePersonalCompetitionNameRoute);
app.use('/update-player-display-name', updatePlayerDisplayNameRoute);

// Promote/Marketing API Routes
app.use('/get-promote-data', getPromoteDataRoute);
app.use('/get-round-results-breakdown', getRoundResultsBreakdownRoute);
app.use('/get-round-statistics', getRoundStatisticsRoute);

// Email API Routes
app.use('/load-pick-reminder', loadPickReminderRoute);
app.use('/load-results-email', loadResultsEmailRoute);
app.use('/load-welcome-competition', loadWelcomeCompetitionRoute);
app.use('/send-email', sendEmailRoute);
app.use('/get-email-preferences', getEmailPreferencesRoute);
app.use('/update-email-preferences-batch', updateEmailPreferencesBatchRoute);
// DISABLED: Manual fixture management - replaced by automated fixture service
// app.use('/organiser-mid-round-submit-tip', organiserMidRoundSubmitTipRoute);

// Admin API Routes
app.use('/admin/push-fixtures-to-competitions', pushFixturesToCompetitionsRoute);
app.use('/admin/push-results-to-competitions', pushResultsToCompetitionsRoute);
app.use('/admin-add-fixtures', adminAddFixturesRoute);
app.use('/admin-get-fixtures-for-results', adminGetFixturesForResultsRoute);
app.use('/admin-set-result', adminSetResultRoute);

// Organizer Fixture Management API Routes (manual competitions only - fixture_service = false)
app.use('/organizer-add-fixtures', organizerAddFixturesRoute);
app.use('/organizer-get-fixtures-for-results', organizerGetFixturesForResultsRoute);
app.use('/organizer-set-result', organizerSetResultRoute);
app.use('/organizer-process-results', organizerProcessResultsRoute);
app.use('/organizer-update-player-permissions', organizerUpdatePlayerPermissionsRoute);

// Bot API Routes (no rate limiting for testing)
app.use('/bot-join', botJoinRoute);
app.use('/bot-pick', botPickRoute);

// Default route for testing
app.get('/', (req, res) => {
  res.json({
    return_code: "SUCCESS",
    message: "LMSLocal API Server",
    version: "1.0.0",
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint for production monitoring
app.get('/health', async (req, res) => {
  try {
    // Test database connection
    const dbStatus = await testConnection();
    const poolStatus = getPoolStatus();
    
    const healthData = {
      return_code: "SUCCESS",
      status: dbStatus.success ? "healthy" : "degraded",
      service: "LMSLocal API Server",
      version: "1.0.0",
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
      },
      database: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        name: process.env.DB_NAME || 'lmslocal',
        status: dbStatus.success ? "connected" : "error",
        connections: {
          total: poolStatus.totalCount,
          idle: poolStatus.idleCount,
          waiting: poolStatus.waitingCount
        }
      }
    };

    // Add database error details if connection failed
    if (!dbStatus.success) {
      healthData.database.error = dbStatus.error;
    }

    res.json(healthData);
  } catch (error) {
    res.json({
      return_code: "ERROR",
      status: "unhealthy",
      service: "LMSLocal API Server",
      timestamp: new Date().toISOString(),
      error: "Health check failed",
      details: error.message
    });
  }
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

// Get server IP address for startup message
const getServerAddress = () => {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  
  // Debug: Log available network interfaces
  // console.log('Available network interfaces:');
  // for (const [name, addrs] of Object.entries(interfaces)) {
  //   for (const addr of addrs) {
  //     if (addr.family === 'IPv4') {
  //       console.log(`  ${name}: ${addr.address} (internal: ${addr.internal})`);
  //     }
  //   }
  // }
  
  // Try common Linux server interface names first (ignore internal flag)
  const commonNames = ['eth0', 'ens3', 'ens5', 'enp0s3', 'enp0s8', 'ens4', 'ens6', 'ens33'];
  
  for (const name of commonNames) {
    if (interfaces[name]) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && iface.address !== '127.0.0.1') {
          return iface.address;
        }
      }
    }
  }
  
  // Try any IPv4 address that's not localhost (ignore internal flag)
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && iface.address !== '127.0.0.1' && !iface.address.startsWith('169.254.')) {
        return iface.address;
      }
    }
  }
  
  console.log('No suitable IPv4 interface found, using localhost');
  return 'localhost';
};

// Start server
app.listen(PORT, async () => {
  const serverIP = getServerAddress();
  const isProduction = process.env.NODE_ENV === 'production';
  
  console.log(`=======================================================================`);
  console.log(`LMSLocal Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Database: ${process.env.DB_NAME}@${process.env.DB_HOST}:${process.env.DB_PORT}`);
  
  // Test database connection and show status
  try {
    const dbStatus = await testConnection();
    if (dbStatus.success) {
      console.log(`Database connection: HEALTHY`);
      console.log(`Database time: ${new Date(dbStatus.timestamp).toLocaleString()}`);
    } else {
      console.log(`Database connection: FAILED - ${dbStatus.error}`);
    }
  } catch (error) {
    console.log(`Database connection: ERROR - ${error.message}`);
  }
  
  console.log(`Health check: http://${serverIP}:${PORT}/health`);
  console.log(`API endpoint: http://${serverIP}:${PORT}/`);
  
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