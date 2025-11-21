import nodemailer from "nodemailer";
import { getDatabase } from "../db/mongodb";

let cachedTransporter: nodemailer.Transporter | null = null;
let cachedConfigHash = "";

async function loadEmailConfig() {
  try {
    const db = getDatabase();
    const settings = await db.collection("admin_settings").findOne({});
    const cfg = settings?.email || {};
    const host = cfg.smtpHost || process.env.SMTP_HOST || "smtp.gmail.com";
    const port = Number(cfg.smtpPort || process.env.SMTP_PORT || 587);
    const user =
      cfg.smtpUsername ||
      process.env.SMTP_USERNAME ||
      process.env.SMTP_USER ||
      "";
    const pass =
      cfg.smtpPassword ||
      process.env.SMTP_PASSWORD ||
      process.env.SMTP_PASS ||
      "";
    const from =
      cfg.fromEmail || process.env.SMTP_FROM || user || "no-reply@localhost";
    return { host, port, user, pass, from };
  } catch {
    const host = process.env.SMTP_HOST || "smtp.gmail.com";
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USERNAME || process.env.SMTP_USER || "";
    const pass = process.env.SMTP_PASSWORD || process.env.SMTP_PASS || "";
    const from = process.env.SMTP_FROM || user || "no-reply@localhost";
    return { host, port, user, pass, from };
  }
}

function configHash(c: {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}) {
  return `${c.host}:${c.port}:${c.user}:${c.from}:${passMask(c.pass)}`;
}
function passMask(p: string) {
  return p ? String(p).slice(0, 2) + "***" : "";
}

export async function getTransporter() {
  const cfg = await loadEmailConfig();
  const isDev = process.env.NODE_ENV !== "production";
  const hasAuth = Boolean(cfg.user) && Boolean(cfg.pass);

  const hash =
    configHash(cfg) +
    `:${isDev ? "dev" : "prod"}:${hasAuth ? "auth" : "noauth"}`;
  if (cachedTransporter && cachedConfigHash === hash)
    return { transporter: cachedTransporter, from: cfg.from };

  cachedConfigHash = hash;

  // If we are in dev or logging mode and no SMTP credentials are configured,
  // use a JSON transport that does not send real email but succeeds.
  const useJsonTransport =
    isDev &&
    (!hasAuth || String(process.env.EMAIL_MODE || "").toLowerCase() === "log");

  if (useJsonTransport) {
    cachedTransporter = nodemailer.createTransport({ jsonTransport: true });
    return { transporter: cachedTransporter, from: cfg.from };
  }

  cachedTransporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: hasAuth ? { user: cfg.user, pass: cfg.pass } : undefined,
  });
  return { transporter: cachedTransporter, from: cfg.from };
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text?: string,
) {
  const { transporter, from } = await getTransporter();
  try {
    const info = await transporter.sendMail({ from, to, subject, html, text });
    return info;
  } catch (err) {
    // In development, do not fail hard if email cannot be sent
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn("[DEV] Email send failed, logging instead:", {
        to,
        subject,
      });
      // Simulate nodemailer info object
      return { messageId: "dev-log", accepted: [], rejected: [to] } as any;
    }
    throw err;
  }
}

// ==================== Email Templates ====================

export async function sendWelcomeEmail(
  email: string,
  name: string,
  userType: string,
) {
  const userTypeDisplay = userType.charAt(0).toUpperCase() + userType.slice(1);

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; }
          .header { background-color: #C70000; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: white; padding: 30px; border-radius: 0 0 5px 5px; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; text-align: center; }
          .button { display: inline-block; margin: 20px 0; padding: 12px 30px; background-color: #C70000; color: white; text-decoration: none; border-radius: 5px; }
          h1 { color: #C70000; margin-bottom: 10px; }
          .highlight { background-color: #fff3cd; padding: 15px; border-left: 4px solid #C70000; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to Ashish Properties!</h1>
          </div>
          <div class="content">
            <p>Hello <strong>${name}</strong>,</p>

            <p>Welcome aboard! Your account has been successfully created as a <strong>${userTypeDisplay}</strong>.</p>

            <div class="highlight">
              <p><strong>Get Started:</strong></p>
              <p>Your account is now active and ready to use. Log in to access all features and start exploring the platform.</p>
            </div>

            ${
              userType === "seller"
                ? `
              <p><strong>As a Seller:</strong></p>
              <ul>
                <li>📋 Post your properties with detailed information and images</li>
                <li>💰 Reach thousands of interested buyers</li>
                <li>📊 Track property views and inquiries in real-time</li>
                <li>🎯 Manage your listings and respond to buyer inquiries</li>
                <li>⭐ Build your reputation with customer reviews</li>
              </ul>
              `
                : userType === "agent"
                  ? `
              <p><strong>As an Agent:</strong></p>
              <ul>
                <li>🏢 List multiple properties and manage your portfolio</li>
                <li>👥 Connect with buyers and sellers</li>
                <li>📈 Track your sales performance and commission</li>
                <li>💼 Build your professional profile and reputation</li>
                <li>🌟 Stand out with premium listings</li>
              </ul>
              `
                  : `
              <p><strong>As a Buyer:</strong></p>
              <ul>
                <li>🔍 Search and filter properties by your preferences</li>
                <li>❤️ Save your favorite properties</li>
                <li>💬 Direct communication with sellers</li>
                <li>📱 Get notifications for new matching properties</li>
                <li>🛡️ Safe and secure transactions</li>
              </ul>
              `
            }

            <p>If you have any questions or need assistance, our support team is here to help!</p>

            <p>Best regards,<br><strong>Ashish Properties Team</strong></p>
          </div>
          <div class="footer">
            <p>&copy; 2024 Ashish Properties. All rights reserved.</p>
            <p>This is an automated email. Please do not reply directly.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return await sendEmail(
    email,
    "Welcome to Ashish Properties!",
    html,
    `Welcome to Ashish Properties, ${name}!`,
  );
}

export async function sendPropertyConfirmationEmail(
  email: string,
  name: string,
  propertyTitle: string,
  propertyId: string,
) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; }
          .header { background-color: #C70000; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: white; padding: 30px; border-radius: 0 0 5px 5px; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; text-align: center; }
          .property-info { background-color: #f0f0f0; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .status-badge { display: inline-block; background-color: #ffc107; color: #000; padding: 5px 10px; border-radius: 3px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📝 Property Posted Successfully!</h1>
          </div>
          <div class="content">
            <p>Hello <strong>${name}</strong>,</p>

            <p>Great news! Your property has been successfully posted on Ashish Properties.</p>

            <div class="property-info">
              <h3>${propertyTitle}</h3>
              <p><strong>Property ID:</strong> ${propertyId}</p>
              <p><strong>Status:</strong> <span class="status-badge">Under Review</span></p>
            </div>

            <p><strong>What happens next?</strong></p>
            <ul>
              <li>✅ Our team will review your property details and images</li>
              <li>⏱️ Approval typically takes 24-48 hours</li>
              <li>📧 You'll receive an email notification once approved</li>
              <li>🌐 After approval, your property will be visible to buyers</li>
            </ul>

            <p><strong>Tips for faster approval:</strong></p>
            <ul>
              <li>Ensure all details are accurate and complete</li>
              <li>Upload clear, high-quality property images</li>
              <li>Include comprehensive property description</li>
              <li>Verify your contact information</li>
            </ul>

            <p>If you have any questions, feel free to contact our support team.</p>

            <p>Best regards,<br><strong>Ashish Properties Team</strong></p>
          </div>
          <div class="footer">
            <p>&copy; 2024 Ashish Properties. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return await sendEmail(
    email,
    `Property Posted: ${propertyTitle}`,
    html,
    `Your property "${propertyTitle}" has been posted successfully and is under review.`,
  );
}

export async function sendPropertyApprovalEmail(
  email: string,
  name: string,
  propertyTitle: string,
  propertyId: string,
  isApproved: boolean,
  rejectionReason?: string,
) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; }
          .header { background-color: ${isApproved ? "#28a745" : "#dc3545"}; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: white; padding: 30px; border-radius: 0 0 5px 5px; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; text-align: center; }
          .property-info { background-color: #f0f0f0; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .success { color: #28a745; font-weight: bold; }
          .error { color: #dc3545; font-weight: bold; }
          .highlight { background-color: ${isApproved ? "#d4edda" : "#f8d7da"}; padding: 15px; border-left: 4px solid ${isApproved ? "#28a745" : "#dc3545"}; margin: 15px 0; }
          .button { display: inline-block; margin: 20px 0; padding: 12px 30px; background-color: #C70000; color: white; text-decoration: none; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${isApproved ? "✅ Property Approved!" : "❌ Property Review Update"}</h1>
          </div>
          <div class="content">
            <p>Hello <strong>${name}</strong>,</p>

            ${
              isApproved
                ? `
              <p>Excellent! Your property has been <span class="success">approved</span> and is now live on Ashish Properties.</p>

              <div class="highlight">
                <p><strong>🎉 Your property is now visible to buyers!</strong></p>
              </div>

              <div class="property-info">
                <h3>${propertyTitle}</h3>
                <p><strong>Property ID:</strong> ${propertyId}</p>
                <p><strong>Status:</strong> <span class="success">✓ APPROVED & LIVE</span></p>
              </div>

              <p><strong>What's next?</strong></p>
              <ul>
                <li>📊 Monitor inquiries and messages from interested buyers</li>
                <li>💬 Respond promptly to buyer inquiries</li>
                <li>📸 You can edit property details anytime from your dashboard</li>
                <li>⭐ Encourage buyers to leave reviews after interaction</li>
                <li>🎯 Consider premium options to increase visibility</li>
              </ul>
              `
                : `
              <p>Thank you for posting your property on Ashish Properties. After our review, we have some feedback:</p>

              <div class="highlight">
                <p><strong>Status:</strong> <span class="error">Needs Review</span></p>
                ${rejectionReason ? `<p><strong>Reason:</strong> ${rejectionReason}</p>` : ""}
              </div>

              <div class="property-info">
                <h3>${propertyTitle}</h3>
                <p><strong>Property ID:</strong> ${propertyId}</p>
              </div>

              <p><strong>What you can do:</strong></p>
              <ul>
                <li>📝 Review and update your property details</li>
                <li>📸 Add or replace property images</li>
                <li>✏️ Improve the property description</li>
                <li>🔍 Check all information is accurate and complete</li>
                <li>🔄 Resubmit for approval once corrections are made</li>
              </ul>
              `
            }

            <p>If you have questions or need assistance, our support team is ready to help!</p>

            <p>Best regards,<br><strong>Ashish Properties Team</strong></p>
          </div>
          <div class="footer">
            <p>&copy; 2024 Ashish Properties. All rights reserved.</p>
            <p>This is an automated email. Please do not reply directly.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return await sendEmail(
    email,
    isApproved
      ? `Property Approved: ${propertyTitle}`
      : `Property Review: ${propertyTitle}`,
    html,
    isApproved
      ? `Your property "${propertyTitle}" has been approved and is now live!`
      : `Your property "${propertyTitle}" needs some attention.`,
  );
}
