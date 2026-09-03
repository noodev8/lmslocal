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
const submitContactMessageRoute = require('./routes/submit-contact-message');
const createCompetitionRoute = require('./routes/create-competition');
const teamListsRoute = require('./routes/team-lists');
const getTeamsRoute = require('./routes/get-teams');
const getCompetitionPlayersRoute = require('./routes/get-competition-players');
const removePlayerRoute = require('./routes/remove-player');
// DISABLED: Manual fixture management - replaced by automated fixture service
// const createRoundRoute = require('./routes/create-round');
// const updateRoundRoute = require('./routes/update-round');
const updateCompetitionRoute = require('./routes/update-competition');
const setCompetitionReadyRoute = require('./routes/set-competition-ready');
const getCompetitionStartOutlookRoute = require('./routes/get-competition-start-outlook');
const getCompetitionStartOptionsRoute = require('./routes/get-competition-start-options');
// const setFixtureServiceOrganiserRoute = require('./routes/set-fixture-service-organiser'); // unregistered, see below
const resetCompetitionRoute = require('./routes/reset-competition');
const getResetQuoteRoute = require('./routes/get-reset-quote');
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
const buyPlayerBackInRoute = require('./routes/buy-player-back-in');
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
const getCompetitionByCodeRoute = require('./routes/get-competition-by-code');
const getJoinStatusRoute = require('./routes/get-join-status');
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
const loadCompetitionAnnouncementRoute = require('./routes/load-competition-announcement');
const sendEmailRoute = require('./routes/send-email');
const syncCompetitionStatusRoute = require('./routes/sync-competition-status');
const getEmailPreferencesRoute = require('./routes/get-email-preferences');
const updateEmailPreferencesBatchRoute = require('./routes/update-email-preferences-batch');
const unsubscribeRoute = require('./routes/unsubscribe');
// DISABLED: Manual fixture management - replaced by automated fixture service
// const organiserMidRoundSubmitTipRoute = require('./routes/organiser-mid-round-submit-tip');

// Admin Tool Routes (lmslocal-admin) - gated by app_user.is_admin + JWT_ADMIN_SECRET
const pushFixturesToCompetitionRoute = require('./routes/admin/push-fixtures-to-competition');
const getFixturePushTargetsRoute = require('./routes/admin/get-fixture-push-targets');
// Results are pushed one competition at a time - the old all-competitions route ran the whole
// batch in one transaction, so a timeout rolled every competition back. See its header.
const pushResultsToCompetitionRoute = require('./routes/admin/push-results-to-competition');
const getPushTargetsRoute = require('./routes/admin/get-push-targets');
const clearStagedBatchRoute = require('./routes/admin/clear-staged-batch');
const adminLoginRoute = require('./routes/admin/admin-login');
const getAdminStatsRoute = require('./routes/admin/get-admin-stats');
const getAdminGrowthRoute = require('./routes/admin/get-admin-growth');

// Shared-secret auth for machine-invoked routes (the email pipeline)
const { verifyServiceToken } = require('./middleware/service-auth');
const getAdminCompetitionsRoute = require('./routes/admin/get-admin-competitions');
const getAdminOrganisersRoute = require('./routes/admin/get-admin-organisers');
const getCompetitionStatsRoute = require('./routes/admin/get-competition-stats');
const deleteAdminCompetitionRoute = require('./routes/admin/delete-admin-competition');
const impersonateOrganiserRoute = require('./routes/admin/impersonate-organiser');
const getFixtureTeamListsRoute = require('./routes/admin/get-fixture-team-lists');
const addStagedFixturesRoute = require('./routes/admin/add-staged-fixtures');
// The forward fixture calendar - blocks keyed weeks ahead, promoted into the staging table above
// when their kickoffs are confirmed. See docs/competition-start.md.
const getFixtureBlocksRoute = require('./routes/admin/get-fixture-blocks');
const addFixtureBlockRoute = require('./routes/admin/add-fixture-block');
const updateFixtureBlockRoute = require('./routes/admin/update-fixture-block');
const deleteFixtureBlockRoute = require('./routes/admin/delete-fixture-block');
const promoteFixtureBlockRoute = require('./routes/admin/promote-fixture-block');
const getStagedResultsRoute = require('./routes/admin/get-staged-results');
const setStagedResultRoute = require('./routes/admin/set-staged-result');
const setFixtureServiceRoute = require('./routes/admin/set-fixture-service');
const setCompetitionStalledRoute = require('./routes/admin/set-competition-stalled');
const getBotsRoute = require('./routes/admin/get-bots');
const createBotsRoute = require('./routes/admin/create-bots');
const addBotsToCompetitionRoute = require('./routes/admin/add-bots-to-competition');
const removeBotFromCompetitionRoute = require('./routes/admin/remove-bot-from-competition');
const setBotPicksRoute = require('./routes/admin/set-bot-picks');
const setBotPickRoute = require('./routes/admin/set-bot-pick');
const getEmailTargetsRoute = require('./routes/admin/get-email-targets');
const previewEmailRoute = require('./routes/admin/preview-email');
const getEmailHistoryRoute = require('./routes/admin/get-email-history');
const getEmailVolumeRoute = require('./routes/admin/get-email-volume');
const adminSendEmailsRoute = require('./routes/admin/send-emails');
const adminMarkEmailsSentRoute = require('./routes/admin/mark-emails-sent');
const adminBroadcastAudienceRoute = require('./routes/admin/broadcast-audience');
const adminSendBroadcastRoute = require('./routes/admin/send-broadcast');

// Organizer Fixture Management Routes (for manual competitions - fixture_service = false)
const organizerAddFixturesRoute = require('./routes/organizer-add-fixtures');
const organizerGetFixturesForResultsRoute = require('./routes/organizer-get-fixtures-for-results');
const organizerSetResultRoute = require('./routes/organizer-set-result');
const organizerProcessResultsRoute = require('./routes/organizer-process-results');
const organizerUpdatePlayerPermissionsRoute = require('./routes/organizer-update-player-permissions');

// Mobile App Routes
const checkAppVersionRoute = require('./routes/check-app-version');
const registerDeviceTokenRoute = require('./routes/register-device-token');
const processMobileNotificationsRoute = require('./routes/process-mobile-notifications');

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

// Rate limiters answer with HTTP 200 and a return_code, like every other route.
//
// express-rate-limit defaults to 429. Axios rejects on any non-2xx, the response
// interceptor only recognises 401, so a throttled request used to surface as a
// generic thrown error - and nothing in lmslocal-web has ever checked for 429 or
// RATE_LIMIT_EXCEEDED, so the messages below were never shown to anyone. Callers
// already branch on return_code !== 'SUCCESS', so 200 puts a throttled request on
// the same handled path as any other failure.
//
// The RateLimit-* headers still carry the real state for anything monitoring it.
const RATE_LIMIT_STATUS = 200;

// General rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  statusCode: RATE_LIMIT_STATUS,
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
  statusCode: RATE_LIMIT_STATUS,
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

// Tighter limit for the public join-code lookup. It is unauthenticated and invite codes are only
// 4 digits, so the general 50-per-10s allowance would let the whole code space be walked in well
// under a minute. 30 a minute still leaves a player plenty of room to correct a typo, and a shared
// venue IP room to sign several people up, while making enumeration take hours rather than seconds.
const joinLookupLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  statusCode: RATE_LIMIT_STATUS,
  message: {
    return_code: "RATE_LIMIT_EXCEEDED",
    message: "Too many code lookups. Please wait a minute and try again."
  },
  standardHeaders: true,
  legacyHeaders: false
});

// A public form that sends email is a spam target. Generous enough that a person writing in
// twice, or correcting a typo and resending, is never blocked.
const contactLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  statusCode: RATE_LIMIT_STATUS,
  message: {
    return_code: "RATE_LIMIT_EXCEEDED",
    message: "That is a few messages in a short time. Please give it a few minutes."
  },
  standardHeaders: true,
  legacyHeaders: false
});

// CORS configuration - read from environment variable
const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map(url => url.trim())
  : [];

// Function to check if origin is allowed
const isOriginAllowed = (origin, req) => {
  if (!origin) return true; // Allow requests with no origin
  if (allowedOrigins.includes(origin)) return true;

  /*
  Same origin as this server. Not every page here is an API: /unsubscribe renders HTML with a form
  that POSTs back to /unsubscribe/save, and a browser sends an Origin header on that POST even
  though it is same-origin. Without this the server rejects its own form as cross-origin, which is
  what happened to the unsubscribe Save button in production - the page loaded, the toggles moved,
  and saving failed with "Not allowed by CORS".

  Compared against the request's own Host rather than a configured URL, so it stays correct in
  every environment without another env var to keep in step.
  */
  const host = req?.headers?.host;
  if (host && (origin === `https://${host}` || origin === `http://${host}`)) return true;

  // Allow any local network IP on port 3000 (for mobile browser access)
  const localNetworkPattern = /^http:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+):3000$/;
  if (localNetworkPattern.test(origin)) return true;

  return false;
};

/*
The delegate form of cors(), rather than a plain options object, because deciding whether an
origin is allowed needs the request: same-origin is only recognisable by comparing against this
request's own Host. See isOriginAllowed above.
*/
app.use(cors((req, callback) => {
  const origin = req.headers.origin;

  /*
  /unsubscribe is a server-rendered HTML page whose Save button is an ordinary form submission,
  not fetch/XHR. A form POST is a navigation: the browser sends it regardless of CORS and renders
  whatever comes back, so there is nothing here for CORS to protect and no header the response
  needs. It only ever broke because this delegate *rejects* a disallowed origin rather than merely
  omitting the headers.

  The same-origin rule below was the first attempt at this and was not enough: it compares Origin
  against req.headers.host, which behind a reverse proxy is whatever the proxy chose to forward -
  the loopback address unless nginx is configured to pass the original Host. That made the fix
  depend on proxy config in a way nothing in this repo can see or check. Exempting the path does
  not.
  */
  if (req.path === '/unsubscribe' || req.path.startsWith('/unsubscribe/')) {
    return callback(null, { origin: false });
  }

  if (!isOriginAllowed(origin, req)) {
    console.log('CORS blocked origin:', origin, 'host:', req.headers.host, 'path:', req.path);
    return callback(new Error('Not allowed by CORS'));
  }

  callback(null, {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Cache-Control', 'Pragma']
  });
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
app.use('/submit-contact-message', contactLimit, submitContactMessageRoute);
app.use('/create-competition', createCompetitionRoute);
app.use('/team-lists', teamListsRoute);
app.use('/get-teams', getTeamsRoute);
app.use('/get-competition-players', dbIntensiveLimit, getCompetitionPlayersRoute);
app.use('/remove-player', removePlayerRoute);
// DISABLED: Manual fixture management - replaced by automated fixture service
// app.use('/create-round', createRoundRoute);
// app.use('/update-round', updateRoundRoute);
app.use('/update-competition', updateCompetitionRoute);
app.use('/set-competition-ready', setCompetitionReadyRoute);
app.use('/get-competition-start-outlook', getCompetitionStartOutlookRoute);
app.use('/get-competition-start-options', getCompetitionStartOptionsRoute);
// UNREGISTERED: organisers cannot switch the fixture service themselves for now - the settings
// screen no longer offers it, so this would be a live endpoint with nothing driving it. The file
// is kept as the reference implementation for when the switch is worked through properly.
// app.use('/set-fixture-service-organiser', setFixtureServiceOrganiserRoute);
app.use('/reset-competition', resetCompetitionRoute);
app.use('/get-reset-quote', getResetQuoteRoute);
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
app.use('/buy-player-back-in', buyPlayerBackInRoute);
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
// Public, unauthenticated lookup for the /join/[code] page. Rate limited so invite codes
// cannot be enumerated quickly.
app.use('/get-competition-by-code', joinLookupLimit, getCompetitionByCodeRoute);
// Authenticated companion to the lookup above: answers only "are you already in this one?",
// so the join page can send a member straight in rather than showing them a Join button.
app.use('/get-join-status', getJoinStatusRoute);
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

/*
Email API Routes

The queue-and-send pipeline is machine-invoked (scheduler or operator), never called by the
web, admin or mobile clients. Every one of these routes was previously open to anyone who knew
the URL, and between them they accept user_id / competition_id from the request body and
dispatch real email - enough to mail arbitrary players repeatedly. They now require the
X-Service-Token header. See middleware/service-auth.js.

/unsubscribe is deliberately unauthenticated: it is the one-click link inside an email and
carries its own signed JWT in the query string.
*/
app.use('/load-pick-reminder', verifyServiceToken, loadPickReminderRoute);
app.use('/load-results-email', verifyServiceToken, loadResultsEmailRoute);
app.use('/load-competition-announcement', verifyServiceToken, loadCompetitionAnnouncementRoute);
app.use('/send-email', verifyServiceToken, sendEmailRoute);
app.use('/get-email-preferences', getEmailPreferencesRoute);
app.use('/update-email-preferences-batch', updateEmailPreferencesBatchRoute);
app.use('/unsubscribe', unsubscribeRoute);
// DISABLED: Manual fixture management - replaced by automated fixture service
// app.use('/organiser-mid-round-submit-tip', organiserMidRoundSubmitTipRoute);

/*
Scheduled Maintenance Routes

Machine-invoked on a timer, never by a client. Same X-Service-Token as the email pipeline
(middleware/service-auth.js) - these have no user context, so JWT auth does not apply.

/sync-competition-status runs nightly and promotes SETUP competitions whose Round 1 has locked.
It corrects a reporting column only; nothing that decides whether a player may join reads it.
See docs/player-onboarding.md §4.2.
*/
app.use('/sync-competition-status', verifyServiceToken, syncCompetitionStatusRoute);

/*
Admin Tool API Routes (lmslocal-admin)

Every one of these requires an admin token - see middleware/admin-auth.js. The fixture and
result routes replace /admin-add-fixtures, /admin-get-fixtures-for-results and
/admin-set-result, which were gated by the string '12221' in the request body and served the
now-deleted /admin-fixtures and /admin-results pages in lmslocal-web. The two push routes were
gated by BOT_MAGIC_2025, which those same public pages shipped in the browser bundle.
*/
app.use('/admin/admin-login', adminLoginRoute);
app.use('/admin/get-admin-stats', getAdminStatsRoute);
app.use('/admin/get-admin-growth', getAdminGrowthRoute);
app.use('/admin/get-admin-competitions', getAdminCompetitionsRoute);
app.use('/admin/get-admin-organisers', getAdminOrganisersRoute);
app.use('/admin/get-competition-stats', getCompetitionStatsRoute);
app.use('/admin/delete-admin-competition', deleteAdminCompetitionRoute);
app.use('/admin/impersonate-organiser', impersonateOrganiserRoute);
app.use('/admin/get-fixture-team-lists', getFixtureTeamListsRoute);
app.use('/admin/add-staged-fixtures', addStagedFixturesRoute);
app.use('/admin/get-fixture-blocks', getFixtureBlocksRoute);
app.use('/admin/add-fixture-block', addFixtureBlockRoute);
app.use('/admin/update-fixture-block', updateFixtureBlockRoute);
app.use('/admin/delete-fixture-block', deleteFixtureBlockRoute);
app.use('/admin/promote-fixture-block', promoteFixtureBlockRoute);
app.use('/admin/get-staged-results', getStagedResultsRoute);
app.use('/admin/set-staged-result', setStagedResultRoute);
app.use('/admin/set-fixture-service', setFixtureServiceRoute);
app.use('/admin/set-competition-stalled', setCompetitionStalledRoute);
app.use('/admin/get-fixture-push-targets', getFixturePushTargetsRoute);
app.use('/admin/push-fixtures-to-competition', pushFixturesToCompetitionRoute);
app.use('/admin/get-push-targets', getPushTargetsRoute);
app.use('/admin/push-results-to-competition', pushResultsToCompetitionRoute);
app.use('/admin/clear-staged-batch', clearStagedBatchRoute);
app.use('/admin/get-bots', getBotsRoute);
app.use('/admin/create-bots', createBotsRoute);
app.use('/admin/add-bots-to-competition', addBotsToCompetitionRoute);
app.use('/admin/remove-bot-from-competition', removeBotFromCompetitionRoute);
app.use('/admin/set-bot-picks', setBotPicksRoute);
app.use('/admin/set-bot-pick', setBotPickRoute);
/*
Emails screen. Each route carries verifyAdminToken itself rather than relying on a mount-time
gate, matching the rest of the /admin namespace.
*/
app.use('/admin/get-email-targets', getEmailTargetsRoute);
app.use('/admin/preview-email', previewEmailRoute);
app.use('/admin/get-email-history', getEmailHistoryRoute);
app.use('/admin/get-email-volume', getEmailVolumeRoute);
app.use('/admin/send-emails', adminSendEmailsRoute);
app.use('/admin/mark-emails-sent', adminMarkEmailsSentRoute);

/*
Broadcast has its own routes rather than joining the catalog: it carries operator-written text and
can reach every account, so it needs an audience count, a confirmation and a send cap that would be
noise on the eleven template emails. See routes/admin/send-broadcast.js.
*/
app.use('/admin/broadcast-audience', adminBroadcastAudienceRoute);
app.use('/admin/send-broadcast', adminSendBroadcastRoute);

// Organizer Fixture Management API Routes (manual competitions only - fixture_service = false)
app.use('/organizer-add-fixtures', organizerAddFixturesRoute);
app.use('/organizer-get-fixtures-for-results', organizerGetFixturesForResultsRoute);
app.use('/organizer-set-result', organizerSetResultRoute);
app.use('/organizer-process-results', organizerProcessResultsRoute);
app.use('/organizer-update-player-permissions', organizerUpdatePlayerPermissionsRoute);

// Mobile App API Routes
app.use('/check-app-version', checkAppVersionRoute);
app.use('/register-device-token', registerDeviceTokenRoute);
app.use('/process-mobile-notifications', processMobileNotificationsRoute);

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