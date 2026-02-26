// ═══════════════════════════════════════════════════════════════════════════════
// Google Apps Script - Colloquium Backend with Custom Email
// ═══════════════════════════════════════════════════════════════════════════════
//
// SETUP INSTRUCTIONS:
// 1. Paste this entire code into Apps Script (Extensions → Apps Script)
// 2. Deploy → New Deployment → Web App
// 3. Execute as: Me, Access: Anyone
// 4. Copy the deployment URL
//
// EMAIL SETUP:
// To send from profbbfakae70@gmail.com:
// 1. Go to Gmail settings (profbbfakae70@gmail.com)
// 2. Settings → Accounts → Send mail as → Add another email address
// 3. Add the email you want to send from
// 4. Verify it
//
// ═══════════════════════════════════════════════════════════════════════════════

const RSVP_SHEET = 'RSVPs';
const TRIBUTE_SHEET = 'Tributes';

// Event code - same for everyone
const EVENT_CODE = '33447';
const QR_CODE_URL = 'https://i.imgur.com/YOUR_QR_CODE.png'; // You'll need to upload the QR code to imgur or similar

// ══════════════════════════════════════════════════════════════════════════════
// POST HANDLER
// ══════════════════════════════════════════════════════════════════════════════

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = e.parameter.action;

    switch (action) {
      case 'rsvp':
        return handleRSVP(data);
      case 'tribute':
        return handleTribute(data);
      case 'updateTribute':
        return updateTribute(data);
      default:
        return respond(false, 'Unknown action: ' + action);
    }
  } catch (err) {
    return respond(false, err.message);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// GET HANDLER
// ══════════════════════════════════════════════════════════════════════════════

function doGet(e) {
  const action = e.parameter.action;
  const callback = e.parameter.callback;

  let result;
  switch (action) {
    case 'getRSVPs':
      result = getRSVPs();
      break;
    case 'getTributes':
      result = getTributes();
      break;
    case 'getApprovedTributes':
      result = getApprovedTributes();
      break;
    case 'getStats':
      result = getStats();
      break;
    default:
      result = respond(false, 'Unknown action: ' + action);
      break;
  }

  if (callback) {
    const json = result.getContent();
    return ContentService
      .createTextOutput(callback + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return result;
}

// ══════════════════════════════════════════════════════════════════════════════
// RSVP HANDLER
// ══════════════════════════════════════════════════════════════════════════════

function handleRSVP(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(RSVP_SHEET);

  if (!sheet) {
    sheet = ss.insertSheet(RSVP_SHEET);
    sheet.appendRow([
      'Timestamp', 'Full Name', 'Email', 'Phone',
      'Organization', 'Designation', 'Attendance', 'Event Code'
    ]);
    sheet.setFrozenRows(1);
  }

  sheet.appendRow([
    new Date(),
    data.fullName || '',
    data.email || '',
    data.phone || '',
    data.organization || '',
    data.designation || '',
    data.attendance || '',
    EVENT_CODE
  ]);

  try {
    sendConfirmationEmail(data);
  } catch (err) {
    Logger.log('Email error: ' + err.message);
  }

  return respond(true, 'RSVP saved');
}

// ══════════════════════════════════════════════════════════════════════════════
// TRIBUTE HANDLER
// ══════════════════════════════════════════════════════════════════════════════

function handleTribute(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(TRIBUTE_SHEET);

  if (!sheet) {
    sheet = ss.insertSheet(TRIBUTE_SHEET);
    sheet.appendRow(['Timestamp', 'Author', 'Message', 'Approved', 'Included in Book']);
    sheet.setFrozenRows(1);
  }

  sheet.appendRow([
    new Date(),
    data.tributeAuthor || 'Anonymous',
    data.tributeMessage || '',
    'Pending',
    'No'
  ]);

  return respond(true, 'Tribute submitted');
}

// ══════════════════════════════════════════════════════════════════════════════
// UPDATE TRIBUTE (Admin)
// ══════════════════════════════════════════════════════════════════════════════

function updateTribute(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(TRIBUTE_SHEET);

  if (!sheet) return respond(false, 'Tributes sheet not found');

  const rows = sheet.getDataRange().getValues();
  const author = data.author;
  const newStatus = data.approved;

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][1] === author) {
      sheet.getRange(i + 1, 4).setValue(newStatus);
      return respond(true, 'Status updated to ' + newStatus);
    }
  }

  return respond(false, 'Tribute not found for: ' + author);
}

// ══════════════════════════════════════════════════════════════════════════════
// GET TRIBUTES (Admin)
// ══════════════════════════════════════════════════════════════════════════════

function getTributes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(TRIBUTE_SHEET);

  if (!sheet) return respond(true, 'No tributes yet', { tributes: [] });

  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];

  const tributes = rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = row[idx]; });
    return {
      author: obj['Author'] || '',
      message: obj['Message'] || '',
      approved: obj['Approved'] || 'Pending'
    };
  });

  return respond(true, 'All tributes retrieved', { tributes });
}

// ══════════════════════════════════════════════════════════════════════════════
// GET APPROVED TRIBUTES (Public)
// ══════════════════════════════════════════════════════════════════════════════

function getApprovedTributes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(TRIBUTE_SHEET);

  if (!sheet) return respond(true, 'No tributes yet', { tributes: [] });

  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];

  const tributes = rows.slice(1)
    .map(row => {
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = row[idx]; });
      return obj;
    })
    .filter(t => t['Approved'] === 'Approved')
    .map(t => ({
      author: t['Author'] || '',
      message: t['Message'] || ''
    }));

  return respond(true, 'Approved tributes retrieved', { tributes });
}

// ══════════════════════════════════════════════════════════════════════════════
// GET RSVPs
// ══════════════════════════════════════════════════════════════════════════════

function getRSVPs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(RSVP_SHEET);

  if (!sheet) return respond(true, 'No RSVPs yet', { rsvps: [] });

  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const rsvps = rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = row[idx]; });
    return obj;
  });

  return respond(true, 'RSVPs retrieved', { rsvps });
}

// ══════════════════════════════════════════════════════════════════════════════
// GET STATS
// ══════════════════════════════════════════════════════════════════════════════

function getStats() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rsvpSheet = ss.getSheetByName(RSVP_SHEET);
  const tributeSheet = ss.getSheetByName(TRIBUTE_SHEET);

  const stats = {
    totalRSVPs: 0,
    attending: 0,
    notAttending: 0,
    totalTributes: 0,
    approvedTributes: 0
  };

  if (rsvpSheet) {
    const rows = rsvpSheet.getDataRange().getValues();
    stats.totalRSVPs = rows.length - 1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][6] === 'yes') {
        stats.attending++;
      } else {
        stats.notAttending++;
      }
    }
  }

  if (tributeSheet) {
    const rows = tributeSheet.getDataRange().getValues();
    stats.totalTributes = rows.length - 1;
    stats.approvedTributes = rows.slice(1).filter(r => r[3] === 'Approved').length;
  }

  return respond(true, 'Stats retrieved', { stats });
}

// ══════════════════════════════════════════════════════════════════════════════
// SEND CONFIRMATION EMAIL
// ══════════════════════════════════════════════════════════════════════════════

function sendConfirmationEmail(data) {
  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { 
          font-family: Georgia, serif; 
          margin: 0; 
          padding: 0; 
          background-color: #faf8f3;
        }
        .container { 
          max-width: 600px; 
          margin: 0 auto; 
          background: white;
        }
        .header { 
          background: #2d519e; 
          color: white; 
          padding: 40px 20px; 
          text-align: center;
        }
        .header h1 { 
          margin: 0; 
          font-size: 28px;
          font-family: 'Playfair Display', Georgia, serif;
        }
        .header p { 
          color: #d4af6a; 
          margin: 8px 0 0 0;
          font-size: 16px;
        }
        .content { 
          padding: 40px 30px;
        }
        .greeting { 
          font-size: 18px; 
          margin-bottom: 20px;
          color: #1a1a2e;
        }
        .qr-section {
          background: #f5f3ed;
          border: 2px solid #b8943f;
          border-radius: 8px;
          padding: 30px;
          text-align: center;
          margin: 30px 0;
        }
        .qr-title {
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          color: #b8943f;
          margin-bottom: 20px;
          font-weight: 600;
        }
        .qr-code {
          background: white;
          padding: 20px;
          display: inline-block;
          border-radius: 8px;
          margin: 20px 0;
        }
        .event-code {
          font-size: 48px;
          font-weight: bold;
          color: #2d519e;
          margin: 20px 0;
          font-family: 'Courier New', monospace;
        }
        .instruction {
          font-size: 14px;
          color: #6b5e3e;
          margin-top: 15px;
        }
        .event-details {
          background: #f5f3ed;
          border-left: 4px solid #b8943f;
          padding: 20px;
          margin: 25px 0;
        }
        .event-details h3 {
          margin: 0 0 15px 0;
          color: #2d519e;
          font-size: 16px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }
        .detail-row {
          margin: 12px 0;
          font-size: 15px;
          color: #3a2e1e;
        }
        .detail-label {
          font-weight: 600;
          color: #2d519e;
          display: inline-block;
          width: 100px;
        }
        .footer {
          background: #1a1a2e;
          color: #888;
          padding: 20px;
          text-align: center;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>RSVP Confirmed</h1>
          <p>Professor's Colloquium</p>
        </div>
        
        <div class="content">
          <div class="greeting">
            Dear ${data.fullName},
          </div>
          
          <p style="font-size: 16px; line-height: 1.6; color: #3a2e1e;">
            Thank you for confirming your attendance at the colloquium in honour of 
            <strong>Professor B.B Fakae</strong>. We look forward to your presence at this special event.
          </p>
          
          <div class="qr-section">
            <div class="qr-title">Your Event Access Code</div>
            
            <div class="qr-code">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=33447" 
                   alt="QR Code" 
                   style="width: 200px; height: 200px; display: block;" />
            </div>
            
            <div class="event-code">${EVENT_CODE}</div>
            
            <div class="instruction">
              Please present this code at the event entrance
            </div>
          </div>
          
          <div class="event-details">
            <h3>Event Details</h3>
            <div class="detail-row">
              <span class="detail-label">Event:</span>
              Prof BB Colloquium
            </div>
            <div class="detail-row">
              <span class="detail-label">Date:</span>
              Friday, 27th March 2026
            </div>
            <div class="detail-row">
              <span class="detail-label">Time:</span>
              2:00 PM
            </div>
            <div class="detail-row">
              <span class="detail-label">Venue:</span>
              Dr. Nyesom Ezenwo Wike Senate Building
            </div>
            <div class="detail-row">
              <span class="detail-label">Address:</span>
              Rivers State University, Port Harcourt
            </div>
            <div class="detail-row">
              <span class="detail-label">Dress Code:</span>
              Business Formal
            </div>
          </div>
          
          <p style="font-size: 14px; color: #6b5e3e; margin-top: 30px;">
            We look forward to welcoming you to this memorable celebration.
          </p>
        </div>
        
        <div class="footer">
          © 2026 — Professor's Colloquium — All Rights Reserved
        </div>
      </div>
    </body>
    </html>
  `;

  // Send email
  // NOTE: To send from profbbfakae70@gmail.com, you need to:
  // 1. Add it as a "Send mail as" address in your Gmail settings
  // 2. Verify the address
  // 3. Then use the 'name' parameter below
  
  MailApp.sendEmail({
    to: data.email,
    subject: "RSVP Confirmed — Professor's Colloquium",
    htmlBody: htmlBody,
    name: "Professor's Colloquium" // This appears as the sender name
    // If you've set up profbbfakae70@gmail.com in Gmail settings, add:
    // from: "profbbfakae70@gmail.com"
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTION
// ══════════════════════════════════════════════════════════════════════════════

function respond(success, message, extra) {
  const payload = Object.assign({ success, message }, extra || {});
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
