import nodemailer from 'nodemailer';
import logger from './logger';

export const sendAssessmentEmail = async (
  candidateEmail: string,
  candidateName: string,
  jobTitle: string,
  testLink: string,
  expiryDate: string,
  duration: number,
  loginId: string,
  passwordRaw: string
) => {
  try {
    const webhookUrl = process.env.GAS_EMAIL_WEBHOOK_URL;
    if (!webhookUrl) {
      logger.warn('GAS_EMAIL_WEBHOOK_URL missing, skipping sendAssessmentEmail');
      return;
    }

    // 1. Insert variables into the premium HTML layout template we designed
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <body style="background-color: #000000; font-family: -apple-system, sans-serif; margin: 0; padding: 40px 20px; color: #ffffff;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; background-color: #0a0a0a; border: 1px solid #1c1c1e; border-radius: 12px; padding: 40px;">
          <tr>
            <td style="padding-bottom: 32px; border-bottom: 1px solid #1c1c1e;">
              <span style="font-size: 20px; font-weight: 700; color: #ffffff;">Proctara<span style="color: #FFB800;">.</span></span>
            </td>
          </tr>
          <tr>
            <td style="padding-top: 32px; padding-bottom: 20px;">
              <h1 style="font-size: 24px; font-weight: 600; margin: 0;">${jobTitle} Assessment</h1>
              <p style="font-size: 14px; color: #636366; margin: 4px 0 0 0;">Powered by Proctara AI</p>
            </td>
          </tr>
          <tr>
            <td style="font-size: 15px; line-height: 24px; color: #e5e5ea; padding-bottom: 16px;">
              Hi ${candidateName},
            </td>
          </tr>
          <tr>
            <td style="font-size: 15px; line-height: 24px; color: #a2a2a8; padding-bottom: 24px;">
              Thank you for your interest! You are invited to the next step in our process: an adaptive, conversational AI video interview.
            </td>
          </tr>
          <tr>
            <td style="padding-bottom: 28px;">
              <table width="100%" style="background-color: #1c1c1e; border-radius: 8px; padding: 20px;">
                <tr>
                  <td style="font-size: 14px; line-height: 22px; color: #e5e5ea;">
                    <strong>What you need to know:</strong>
                    <ul style="margin: 8px 0 0 0; padding-left: 20px; color: #a2a2a8;">
                      <li style="margin-bottom: 6px;"><strong>Timeline:</strong> Complete before the link expires on ${expiryDate}.</li>
                      <li style="margin-bottom: 6px;"><strong>Duration:</strong> The interview session will take ${duration} minutes.</li>
                      <li><strong>Contextual Questions:</strong> The AI structures technical assessment questions directly from your resume background.</li>
                    </ul>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom: 28px;">
              <table width="100%" style="background-color: #1c1c1e; border-radius: 8px; padding: 20px; border-left: 4px solid #FFB800;">
                <tr>
                  <td style="font-size: 14px; line-height: 22px; color: #e5e5ea;">
                    <strong>Your Candidate Portal Credentials:</strong><br/>
                    <span style="color: #a2a2a8;">Login ID:</span> <code style="background-color: #2c2c2e; padding: 2px 6px; border-radius: 4px; color: #ffffff;">${loginId}</code><br/>
                    <span style="color: #a2a2a8;">Password:</span> <code style="background-color: #2c2c2e; padding: 2px 6px; border-radius: 4px; color: #ffffff;">${passwordRaw}</code>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom: 32px; border-bottom: 1px solid #1c1c1e;">
              <a href="${testLink}" target="_blank" style="display: inline-block; font-size: 14px; font-weight: 600; color: #000000; background-color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 6px;">
                Access Candidate Portal
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding-top: 24px; font-size: 12px; line-height: 18px; color: #636366; text-align: center;">
              This secure link is uniquely generated for your application email (${candidateEmail}) and can only be accessed once.
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    // 2. Send via Google Apps Script Webhook
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: candidateEmail,
        name: 'Proctara Hiring Team',
        subject: \`Interview Invitation: \${jobTitle} Assessment\`,
        html: htmlContent
      })
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Webhook failed');

    logger.info({ candidateEmail, jobTitle }, 'GAS assessment email sent successfully');
    return data;
  } catch (err) {
    logger.error({ err, candidateEmail, jobTitle }, 'Error sending GAS assessment email');
    throw err;
  }
};
