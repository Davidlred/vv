# 📧 How to Send Emails from profbbfakae70@gmail.com

## Problem:
By default, Google Apps Script sends emails from the Gmail account that owns the script (e.g., davidprincewill@gmail.com). You want emails to come from **profbbfakae70@gmail.com** instead.

## Solution Options:

### ✅ **Option 1: Use Gmail "Send mail as" Feature (Recommended)**

This lets you send emails from a different address without moving the script.

#### Steps:

1. **Login to Gmail** (profbbfakae70@gmail.com or the account that owns the script)

2. **Go to Settings:**
   - Click the gear icon ⚙️ (top right)
   - Click "See all settings"

3. **Go to "Accounts" Tab:**
   - Find the section "Send mail as:"

4. **Add Email Address:**
   - Click "Add another email address"
   - Name: `Professor's Colloquium`
   - Email: `profbbfakae70@gmail.com`
   - Uncheck "Treat as an alias" (important!)
   - Click "Next Step"

5. **Verify the Address:**
   - Gmail will send a verification email to profbbfakae70@gmail.com
   - Check that inbox
   - Click the verification link or enter the code

6. **Update Apps Script:**
   - In line ~289 of the script, change:
   ```javascript
   MailApp.sendEmail({
     to: data.email,
     subject: "RSVP Confirmed — Professor's Colloquium",
     htmlBody: htmlBody,
     name: "Professor's Colloquium",
     from: "profbbfakae70@gmail.com" // Add this line!
   });
   ```

7. **Re-deploy:**
   - Save the script
   - Deploy → New Deployment
   - Copy the new URL
   - Update your HTML files

---

### ✅ **Option 2: Move Script to profbbfakae70@gmail.com Account**

If you want all management from profbbfakae70@gmail.com:

1. **Login to profbbfakae70@gmail.com**

2. **Open the Google Sheet** with that account

3. **Extensions → Apps Script**

4. **Paste the code** from `FINAL-apps-script-with-qr.js`

5. **Deploy** (Execute as: Me, Access: Anyone)

6. Emails will automatically come from profbbfakae70@gmail.com

---

### ✅ **Option 3: Custom Email Domain (Advanced)**

If you have a custom domain (e.g., @colloquium.edu):

1. Use Google Workspace
2. Set up email routing
3. Use Gmail API instead of MailApp

---

## 📋 What's in the Email Now:

✅ **From:** Professor's Colloquium (profbbfakae70@gmail.com)
✅ **QR Code:** Same for everyone (Code: 33447)
✅ **Event Details:**
   - Event Name: Prof BB Colloquium
   - Date: Friday, 27th March 2026
   - Time: 2:00 PM
   - Venue: Dr. Nyesom Ezenwo Wike Senate Building
   - Address: Rivers State University, Port Harcourt
   - Code: 33447

---

## 🧪 Test the Email:

1. Deploy the script
2. Submit a test RSVP
3. Check your email
4. Verify:
   - ✅ Shows QR code
   - ✅ Shows code "33447"
   - ✅ Shows event details
   - ✅ From address looks correct

---

## ⚠️ Important Notes:

1. **Verification Required:** Gmail must verify the profbbfakae70@gmail.com address before it can be used as a sender

2. **Same Code for Everyone:** All attendees get the same QR code (33447) - no unique codes per person

3. **No Individual Confirmation IDs:** Removed the unique confirmation ID system since everyone uses the same code

4. **Sender Name:** Even if the email address is different, the sender name "Professor's Colloquium" will show in inboxes

---

## 📱 What Recipients See:

**Email Header:**
```
From: Professor's Colloquium <profbbfakae70@gmail.com>
Subject: RSVP Confirmed — Professor's Colloquium
```

**Email Body:**
- Beautiful HTML design
- QR code image (scannable)
- Code number: 33447
- Full event details
- Professional branding

---

Follow Option 1 for the easiest setup! 🎉
