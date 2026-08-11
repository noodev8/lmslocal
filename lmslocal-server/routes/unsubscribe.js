/*
=======================================================================================================================================
API Route: unsubscribe
=======================================================================================================================================
Purpose: Let someone change what email they receive, from a link in an email, without logging in.

Three entry points on one router:

  GET  /unsubscribe?token=&group=   a person clicking the footer link. Acts on `group` straight
                                    away, then renders the confirmation with toggles.
  POST /unsubscribe?token=&group=   the mail client's own unsubscribe button (RFC 8058). Acts and
                                    returns 200 with no page - nothing renders it.
  POST /unsubscribe/save            the toggle form on that page. Sets every group at once.

The GET acts before it renders rather than presenting a form to submit. One-click has to complete
without further interaction, and Gmail and Yahoo have required that of bulk senders since Feb
2024; a page that only offers toggles and waits does not satisfy it. The toggles are there to
refine or reverse the decision afterwards, including switching the group back on.

No login, by design - an unsubscribe link that demands a password is one people report as spam
instead. Identity comes from app_user.unsubscribe_token: opaque, random, permanent and revocable
on its own. It replaced a JWT signed with JWT_SECRET, the player login secret, which meant the
only way to invalidate a leaked unsubscribe link was to log every user out.

GET is an exception to the POST-only rule, as with verify-email: email links must be clickable.
=======================================================================================================================================
Return Codes: none - every response is an HTML page or, for one-click, plain text.
=======================================================================================================================================
*/

const express = require('express');
const {
  ALL,
  GROUPS,
  GROUP_LABELS,
  groupFor,
  getPreferences,
  setPreference,
  findUserByToken
} = require('../services/emailPreference');
const { logApiCall } = require('../utils/apiLogger');

const router = express.Router();

const getFrontendUrl = () => {
  if (process.env.CLIENT_URL) {
    const urls = process.env.CLIENT_URL.split(',').map((url) => url.trim());
    return urls[0] || 'http://localhost:3000';
  }
  return 'http://localhost:3000';
};

// Escape anything that came from the database before it goes into HTML.
const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const PAGE_CSS = `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
         background: #f8fafc; margin: 0; padding: 24px; color: #0f172a; }
  .card { max-width: 560px; margin: 0 auto; background: #fff; border-radius: 12px;
          box-shadow: 0 1px 3px rgba(0,0,0,.08); overflow: hidden; }
  .head { background: #1e293b; padding: 24px; text-align: center; }
  .head h1 { color: #fff; margin: 0; font-size: 20px; }
  .head p { color: #cbd5e1; margin: 6px 0 0; font-size: 13px; word-break: break-all; }
  .body { padding: 24px; }
  .done { background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46;
          padding: 14px 16px; border-radius: 8px; margin: 0 0 20px; }
  .done strong { display: block; margin-bottom: 3px; }
  .warn { background: #fffbeb; border: 1px solid #fde68a; color: #92400e;
          padding: 12px 16px; border-radius: 8px; margin: 0 0 20px; font-size: 14px; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: .04em;
       color: #64748b; margin: 0 0 12px; }
  .row { display: flex; gap: 12px; padding: 12px 0; border-top: 1px solid #f1f5f9; }
  .row:first-of-type { border-top: none; }
  .row label { font-weight: 500; cursor: pointer; }
  .row p { margin: 2px 0 0; font-size: 13px; color: #64748b; }
  .tag { font-size: 11px; color: #64748b; background: #f1f5f9;
         padding: 1px 6px; border-radius: 4px; margin-left: 6px; }
  input[type=checkbox] { width: 18px; height: 18px; margin-top: 2px; flex-shrink: 0; }
  .kill { border-top: 1px solid #e2e8f0; margin-top: 16px; padding-top: 16px; }
  button { background: #1e293b; color: #fff; border: 0; border-radius: 8px;
           padding: 12px 20px; font-size: 15px; font-weight: 500; cursor: pointer;
           margin-top: 20px; width: 100%; }
  button:hover { background: #0f172a; }
  .link { display: block; text-align: center; margin-top: 16px; font-size: 13px; color: #64748b; }
`;

const shell = (title, inner, subtitle) => `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} - LMS Local</title><style>${PAGE_CSS}</style></head>
<body><div class="card">
  <div class="head"><h1>LMS Local</h1>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div>
  <div class="body">${inner}</div>
</div></body></html>`;

const errorPage = (heading, message) =>
  shell(
    heading,
    `<div class="warn"><strong>${esc(heading)}</strong><br>${esc(message)}</div>
     <a class="link" href="${getFrontendUrl()}">Go to LMS Local</a>`
  );

/**
 * The preferences page: what just happened, then a toggle for every group.
 */
function preferencesPage(user, prefs, justUnsubscribed, saved = false) {
  /*
  Saving re-renders this same page, so without a banner the only evidence anything happened is
  that the toggles kept their new positions - which is exactly what a page that silently failed
  would also show. It says what is now off rather than just "saved", because that is the thing
  the person came here to change and the one they would otherwise reload to check.
  */
  const off = Object.values(GROUPS).filter((key) => !prefs.groups[key]);
  const savedBanner = !prefs.all
    ? `<div class="done"><strong>Preferences saved</strong>
       You are unsubscribed from everything. You will still get account emails such as password resets.</div>`
    : off.length === 0
    ? `<div class="done"><strong>Preferences saved</strong>You are subscribed to everything below.</div>`
    : `<div class="done"><strong>Preferences saved</strong>
       You will no longer get: ${off.map((key) => esc(GROUP_LABELS[key].label)).join(', ')}.</div>`;

  const done = justUnsubscribed
    ? `<div class="done"><strong>Unsubscribed from ${esc(GROUP_LABELS[justUnsubscribed].label)}</strong>
       ${esc(GROUP_LABELS[justUnsubscribed].blurb)}</div>`
    : saved
    ? savedBanner
    : '';

  /*
  Pick reminders live in player.game, so switching Game off stops them. Said plainly rather than
  quietly honoured - missing a pick costs a life, and someone turning off "game updates" to stop
  result emails will not have guessed that.
  */
  const warn =
    justUnsubscribed === GROUPS.PLAYER_GAME
      ? `<div class="warn">That includes <strong>pick reminders</strong>. Without them it is easy to
         miss a pick, and a missed pick costs a life. You can switch them back on below.</div>`
      : '';

  const rows = Object.values(GROUPS)
    .map((key) => {
      const meta = GROUP_LABELS[key];
      const on = prefs.groups[key];
      return `<div class="row">
        <input type="checkbox" id="${key}" name="groups" value="${key}"${on ? ' checked' : ''}>
        <div>
          <label for="${key}">${esc(meta.label)}<span class="tag">${esc(meta.consumer)} · ${esc(meta.section)}</span></label>
          <p>${esc(meta.blurb)}</p>
        </div>
      </div>`;
    })
    .join('');

  const inner = `
    ${done}
    ${warn}
    <form method="POST" action="/unsubscribe/save">
      <input type="hidden" name="token" value="${esc(user.unsubscribe_token)}">
      <h2>What you receive</h2>
      ${rows}
      <div class="kill">
        <div class="row">
          <input type="checkbox" id="killall" name="kill_all" value="1"${prefs.all ? '' : ' checked'}>
          <div>
            <label for="killall">Unsubscribe from everything</label>
            <p>Stops all of the above. You will still get account emails such as password resets.</p>
          </div>
        </div>
      </div>
      <button type="submit">Save preferences</button>
    </form>
    <a class="link" href="${getFrontendUrl()}">Go to LMS Local</a>
  `;

  return shell('Email preferences', inner, user.email);
}

/**
 * Shared by GET and the one-click POST: identify the user and act on the group.
 * @returns {Promise<{user: object, prefs: object, acted: string|null}|null>} null if the token is bad
 */
async function applyUnsubscribe(token, groupParam) {
  const user = await findUserByToken(token);
  if (!user) return null;

  // Accept a group key or a legacy per-email type, so a link cannot break on naming.
  const group = groupFor(groupParam);

  if (group) {
    await setPreference(user.id, group, false);
  }

  const prefs = await getPreferences(user.id);
  return { user: { ...user, unsubscribe_token: token }, prefs, acted: group };
}

// ======================================================================================
// GET - a person clicking the link in an email
// ======================================================================================
router.get('/', async (req, res) => {
  logApiCall('unsubscribe');

  try {
    const { token, group } = req.query;

    const result = await applyUnsubscribe(token, group);
    if (!result) {
      return res.send(
        errorPage(
          'Link not recognised',
          'This unsubscribe link is invalid or has expired. Use the link from a recent email, or change your preferences in your profile.'
        )
      );
    }

    return res.send(preferencesPage(result.user, result.prefs, result.acted));
  } catch (error) {
    console.error('unsubscribe GET error:', { error: error.message, stack: error.stack });
    return res.send(
      errorPage('Something went wrong', 'We could not update your preferences. Please try again.')
    );
  }
});

// ======================================================================================
// POST - the mail client's own unsubscribe button (RFC 8058 one-click)
// ======================================================================================
router.post('/', async (req, res) => {
  logApiCall('unsubscribe-one-click');

  try {
    const token = req.query.token || req.body?.token;
    const group = req.query.group || req.body?.group;

    const result = await applyUnsubscribe(token, group);

    /*
    Always 200, even for an unknown token. The caller is a mail provider, not a person: a 4xx
    here is reported back to the sender as a failing unsubscribe endpoint and counts against
    deliverability, and there is nothing the provider could do about a bad token anyway.
    */
    if (!result) {
      console.warn('unsubscribe one-click: token not recognised');
    }

    return res.status(200).type('text/plain').send('OK');
  } catch (error) {
    console.error('unsubscribe POST error:', { error: error.message });
    return res.status(200).type('text/plain').send('OK');
  }
});

// ======================================================================================
// POST /save - the toggle form on the preferences page
// ======================================================================================
router.post('/save', async (req, res) => {
  logApiCall('unsubscribe-save');

  try {
    const { token, kill_all } = req.body || {};

    const user = await findUserByToken(token);
    if (!user) {
      return res.send(errorPage('Link not recognised', 'This link is invalid or has expired.'));
    }

    /*
    An unchecked checkbox submits nothing at all, so absence is the signal for "off". Express
    gives a single checked box as a string and several as an array; normalise before comparing.
    */
    const raw = req.body?.groups;
    const checked = new Set(Array.isArray(raw) ? raw : raw ? [raw] : []);

    for (const key of Object.values(GROUPS)) {
      await setPreference(user.id, key, checked.has(key));
    }

    // The kill switch is inverted: ticking "unsubscribe from everything" disables 'all'.
    await setPreference(user.id, ALL, !kill_all);

    const prefs = await getPreferences(user.id);
    return res.send(preferencesPage({ ...user, unsubscribe_token: token }, prefs, null, true));
  } catch (error) {
    console.error('unsubscribe save error:', { error: error.message, stack: error.stack });
    return res.send(
      errorPage('Something went wrong', 'We could not save your preferences. Please try again.')
    );
  }
});

module.exports = router;
