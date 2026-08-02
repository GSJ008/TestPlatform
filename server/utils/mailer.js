// Sends transactional emails (currently just email verification) using
// Gmail SMTP through Nodemailer.
//
// SETUP REQUIRED (see SETUP.md for the full walkthrough):
//   1. Turn on 2-Step Verification on the Gmail account you want to send from.
//   2. Create an "App Password" for that account (Google Account -> Security
//      -> App passwords). Regular Gmail passwords will NOT work here and
//      Google will reject the login.
//   3. Put that address and app password in server/.env:
//        EMAIL_USER=youraddress@gmail.com
//        EMAIL_APP_PASSWORD=xxxxxxxxxxxxxxxx
//   4. Set CLIENT_URL in server/.env to wherever the React app is served
//      from (e.g. http://localhost:3000), so verification links point to
//      the right place.
const nodemailer = require("nodemailer");

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_APP_PASSWORD = process.env.EMAIL_APP_PASSWORD;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

let transporter = null;
if (EMAIL_USER && EMAIL_APP_PASSWORD) {
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_APP_PASSWORD
    }
  });
} else {
  console.warn(
    "⚠️  EMAIL_USER / EMAIL_APP_PASSWORD not set - verification emails will be logged to the console instead of sent. See server/utils/mailer.js for setup instructions."
  );
}

async function sendVerificationEmail(toEmail, name, token) {
  const verifyLink = `${CLIENT_URL}/verify-email?token=${token}`;

  if (!transporter) {
    // Dev fallback so registration still "works" end-to-end without mail
    // credentials configured yet - just prints the link you'd otherwise
    // have received by email.
    console.log(`\n[DEV] Verification link for ${toEmail}:\n${verifyLink}\n`);
    return;
  }

  await transporter.sendMail({
    from: `"AI Test Platform" <${EMAIL_USER}>`,
    to: toEmail,
    subject: "Verify your email - AI Test Platform",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color:#111;">Hi ${name || "there"},</h2>
        <p style="color:#333; line-height:1.6;">
          Thanks for signing up for AI Test Platform. Please confirm this is
          your email address by clicking the button below.
        </p>
        <p style="text-align:center; margin: 28px 0;">
          <a href="${verifyLink}"
             style="background:#4f46e5; color:#fff; padding:12px 28px;
                    border-radius:8px; text-decoration:none; font-weight:600;">
            Verify email
          </a>
        </p>
        <p style="color:#666; font-size:13px; line-height:1.6;">
          Or paste this link into your browser:<br/>
          <a href="${verifyLink}">${verifyLink}</a>
        </p>
        <p style="color:#999; font-size:12px;">
          This link expires in 24 hours. If you didn't create this account,
          you can ignore this email.
        </p>
      </div>
    `
  });
}

module.exports = { sendVerificationEmail };