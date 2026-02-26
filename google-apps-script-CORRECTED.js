// Google Apps Script for Colloquium Portal Backend
// UPDATED VERSION — paste this entire file into Apps Script, replacing all existing code

const RSVP_SHEET    = 'RSVPs';
const TRIBUTE_SHEET = 'Tributes';

// ── Handle POST requests ───────────────────────────────────────────────────────
function doPost(e) {
  try {
    const data   = JSON.parse(e.postData.contents);
    const action = e.parameter.action;

    switch (action) {
      case 'rsvp':          return handleRSVP(data);
      case 'tribute':       return handleTribute(data);
      case 'updateTribute': return updateTribute(data);
      default:              return respond(false, 'Unknown action: ' + action);
    }
  } catch (err) {
    return respond(false, err.message);
  }
}

// ── Handle GET requests ────────────────────────────────────────────────────────
function doGet(e) {
  const action   = e.parameter.action;
  const callback = e.parameter.callback; // JSONP support

  let result;
  switch (action) {
    case 'getRSVPs':            result = getRSVPs();            break;
    case 'getTributes':         result = getTributes();         break;
    case 'getApprovedTributes': result = getApprovedTributes(); break;
    case 'getStats':            result = getStats();            break;
    default:                    result = respond(false, 'Unknown action: ' + action); break;
  }

  // If a JSONP callback was requested, wrap the response
  if (callback) {
    const json = result.getContent();
    return ContentService
      .createTextOutput(callback + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return result;
}

// ── RSVP ──────────────────────────────────────────────────────────────────────
function handleRSVP(data) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  let   sheet = ss.getSheetByName(RSVP_SHEET);

  if (!sheet) {
    sheet = ss.insertSheet(RSVP_SHEET);
    sheet.appendRow([
      'Timestamp','Confirmation ID','Full Name','Email','Phone',
      'Organization','Designation','Attendance','Guest Count',
      'Dietary Requirements','Checked In'
    ]);
    sheet.setFrozenRows(1);
  }

  const confirmationId = 'COL-' + Utilities.getUuid().substring(0, 8).toUpperCase();

  sheet.appendRow([
    new Date(),
    confirmationId,
    data.fullName            || '',
    data.email               || '',
    data.phone               || '',
    data.organization        || '',
    data.designation         || '',
    data.attendance          || '',
    data.guestCount          || '1',
    data.dietaryRequirements || '',
    'No'
  ]);

  try { sendConfirmationEmail(data, confirmationId); } catch (err) {}

  return respond(true, 'RSVP saved', { confirmationId });
}

// ── Tribute (submit new) ───────────────────────────────────────────────────────
function handleTribute(data) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  let   sheet = ss.getSheetByName(TRIBUTE_SHEET);

  if (!sheet) {
    sheet = ss.insertSheet(TRIBUTE_SHEET);
    sheet.appendRow(['Timestamp','Author','Message','Approved','Included in Book']);
    sheet.setFrozenRows(1);
  }

  sheet.appendRow([
    new Date(),
    data.tributeAuthor  || 'Anonymous',
    data.tributeMessage || '',
    'Pending',
    'No'
  ]);

  try { sendTributeNotification(data); } catch (err) {}

  return respond(true, 'Tribute submitted');
}

// ── Update tribute status (Admin approve / reject / reset) ────────────────────
function updateTribute(data) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(TRIBUTE_SHEET);

  if (!sheet) return respond(false, 'Tributes sheet not found');

  const rows      = sheet.getDataRange().getValues();
  const author    = data.author;
  const newStatus = data.approved;

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][1] === author) {
      sheet.getRange(i + 1, 4).setValue(newStatus);
      return respond(true, 'Status updated to ' + newStatus);
    }
  }

  return respond(false, 'Tribute not found for: ' + author);
}

// ── Get ALL tributes — Admin view ─────────────────────────────────────────────
function getTributes() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(TRIBUTE_SHEET);

  if (!sheet) return respond(true, 'No tributes yet', { tributes: [] });

  const rows    = sheet.getDataRange().getValues();
  const headers = rows[0];

  const tributes = rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = row[idx]; });
    return { author: obj['Author'] || '', message: obj['Message'] || '', approved: obj['Approved'] || 'Pending' };
  });

  return respond(true, 'All tributes retrieved', { tributes });
}

// ── Get APPROVED tributes only — Public Tribute Wall ──────────────────────────
function getApprovedTributes() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(TRIBUTE_SHEET);

  if (!sheet) return respond(true, 'No tributes yet', { tributes: [] });

  const rows    = sheet.getDataRange().getValues();
  const headers = rows[0];

  const tributes = rows.slice(1)
    .map(row => {
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = row[idx]; });
      return obj;
    })
    .filter(t => t['Approved'] === 'Approved')
    .map(t => ({ author: t['Author'] || '', message: t['Message'] || '' }));

  return respond(true, 'Approved tributes retrieved', { tributes });
}

// ── Get all RSVPs ─────────────────────────────────────────────────────────────
function getRSVPs() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(RSVP_SHEET);

  if (!sheet) return respond(true, 'No RSVPs yet', { rsvps: [] });

  const rows    = sheet.getDataRange().getValues();
  const headers = rows[0];
  const rsvps   = rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = row[idx]; });
    return obj;
  });

  return respond(true, 'RSVPs retrieved', { rsvps });
}

// ── Stats ─────────────────────────────────────────────────────────────────────
function getStats() {
  const ss           = SpreadsheetApp.getActiveSpreadsheet();
  const rsvpSheet    = ss.getSheetByName(RSVP_SHEET);
  const tributeSheet = ss.getSheetByName(TRIBUTE_SHEET);

  const stats = { totalRSVPs:0, attending:0, notAttending:0, totalGuests:0, totalTributes:0, approvedTributes:0 };

  if (rsvpSheet) {
    const rows = rsvpSheet.getDataRange().getValues();
    stats.totalRSVPs = rows.length - 1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][7] === 'yes') { stats.attending++;    stats.totalGuests += parseInt(rows[i][8]) || 1; }
      else                      { stats.notAttending++; }
    }
  }

  if (tributeSheet) {
    const rows = tributeSheet.getDataRange().getValues();
    stats.totalTributes    = rows.length - 1;
    stats.approvedTributes = rows.slice(1).filter(r => r[3] === 'Approved').length;
  }

  return respond(true, 'Stats retrieved', { stats });
}

// ── Confirmation Email ────────────────────────────────────────────────────────
function sendConfirmationEmail(data, confirmationId) {
  const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' +
    encodeURIComponent(JSON.stringify({ name: data.fullName, email: data.email, confirmationId }));

  MailApp.sendEmail({
    to:      data.email,
    subject: "RSVP Confirmed — Professor's Colloquium",
    htmlBody: `
      <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;">
        <div style="background:#0f2044;color:white;padding:40px;text-align:center;">
          <h1 style="font-size:28px;margin:0;">RSVP Confirmed</h1>
          <p style="color:#d4af6a;margin-top:8px;">Professor's Colloquium</p>
        </div>
        <div style="padding:32px;background:#faf8f3;">
          <p style="font-size:17px;">Dear ${data.fullName},</p>
          <p>Thank you for confirming your attendance. We look forward to your presence.</p>
          <div style="background:white;border:1px solid #e8e0cc;padding:24px;border-radius:4px;margin:24px 0;">
            <p><strong>Date:</strong> Friday, 15th March 2026</p>
            <p><strong>Time:</strong> 3:00 PM — 6:00 PM</p>
            <p><strong>Venue:</strong> Grand Hall, University Campus</p>
            <p><strong>Dress Code:</strong> Business Formal</p>
          </div>
          <div style="text-align:center;background:white;border:1px solid #e8e0cc;padding:24px;border-radius:4px;">
            <p style="font-size:13px;text-transform:uppercase;letter-spacing:0.1em;color:#b8943f;">Your Check-in QR Code</p>
            <img src="${qrUrl}" alt="QR Code" style="margin:12px 0;" />
            <p style="font-family:monospace;font-weight:bold;color:#0f2044;font-size:18px;">${confirmationId}</p>
            <p style="font-size:13px;color:#888;">Present this at the event entrance</p>
          </div>
        </div>
        <div style="background:#1a1a2e;color:#888;padding:16px;text-align:center;font-size:12px;">
          © 2026 — Professor's Colloquium
        </div>
      </div>`
  });
}

// ── Tribute notification to organizer ─────────────────────────────────────────
function sendTributeNotification(data) {
  MailApp.sendEmail({
    to:      'events@university.edu',   // ← Change to your organizer email
    subject: 'New Tribute Submitted — Colloquium',
    htmlBody: `
      <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:24px;">
        <h2 style="color:#0f2044;">New Tribute Submitted</h2>
        <p><strong>From:</strong> ${data.tributeAuthor}</p>
        <blockquote style="border-left:3px solid #b8943f;padding-left:16px;color:#555;font-style:italic;">
          ${data.tributeMessage}
        </blockquote>
        <p>Log in to the Admin panel on your portal to approve or reject this tribute.</p>
        <p style="font-size:12px;color:#888;">Submitted: ${new Date().toLocaleString()}</p>
      </div>`
  });
}

// ── Response helper ───────────────────────────────────────────────────────────
function respond(success, message, extra) {
  const payload = Object.assign({ success, message }, extra || {});
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
