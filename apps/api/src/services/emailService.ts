import nodemailer from 'nodemailer';
import logger from '../lib/logger';

// Create reusable transporter object using SMTP transport
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.TEST_EMAIL,
    pass: process.env.TEST_EMAIL_APP_PASSWORD,
  },
});

export interface InviteEmailOptions {
  to: string;
  candidateName: string;
  companyName: string;
  jobRoleTitle: string;
  loginId: string;
  passwordRaw: string;
  inviteUrl: string;
}

export async function sendCandidateInviteEmail(options: InviteEmailOptions) {
  const { to, candidateName, companyName, jobRoleTitle, loginId, passwordRaw, inviteUrl } = options;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #0f172a; padding: 20px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Proctara Assessment</h1>
      </div>
      <div style="padding: 30px; background-color: #ffffff;">
        <h2 style="color: #333333; margin-top: 0;">Hello ${candidateName || 'Candidate'},</h2>
        <p style="color: #555555; line-height: 1.6;">
          You have been invited by <strong>${companyName}</strong> to take an AI-proctored technical assessment for the <strong>${jobRoleTitle}</strong> position.
        </p>
        
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 20px; margin: 25px 0;">
          <h3 style="margin-top: 0; color: #0f172a; font-size: 16px;">Your Login Credentials</h3>
          <p style="margin: 5px 0; color: #475569;"><strong>Login ID:</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${loginId}</code></p>
          <p style="margin: 5px 0; color: #475569;"><strong>Password:</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${passwordRaw}</code></p>
        </div>

        <p style="color: #555555; line-height: 1.6;">
          Please log in to the candidate portal using the credentials above to begin your interview process. Ensure you are in a quiet environment and your camera and microphone are working.
        </p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${inviteUrl}" style="background-color: #3b82f6; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; display: inline-block;">
            Access Candidate Portal
          </a>
        </div>
        
        <p style="color: #777777; font-size: 13px; text-align: center; border-top: 1px solid #eeeeee; padding-top: 20px; margin-bottom: 0;">
          This is an automated message from Proctara on behalf of ${companyName}. Please do not reply to this email.
        </p>
      </div>
    </div>
  `;

  try {
    const webhookUrl = process.env.GAS_EMAIL_WEBHOOK_URL;
    if (!webhookUrl) {
      logger.warn('Email credentials missing, skipping sendCandidateInviteEmail');
      return { success: false, error: 'Email credentials missing' };
    }
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to,
        name: 'Proctara Assessments',
        subject: `Invitation: Technical Assessment for ${jobRoleTitle} at ${companyName}`,
        html: htmlContent
      })
    });
    
    const data = await res.json() as any;
    if (!data.success) throw new Error(data.error || 'Webhook failed');
    
    logger.info({ email: to }, 'Candidate invite email sent via Webhook');
    return { success: true, messageId: 'webhook-' + Date.now() };
  } catch (error) {
    logger.error({ err: error, email: to }, 'Failed to send candidate invite email');
    return { success: false, error };
  }
}

export async function sendEvaluationReportEmail(session: any, evaluation: any) {
  try {
    const webhookUrl = process.env.GAS_EMAIL_WEBHOOK_URL;
    const testEmail = process.env.TEST_EMAIL || 'test@example.com';
    if (!webhookUrl) return;

    const candidateName = session.candidate?.name || 'Candidate';
    const roleTitle = session.jobRole?.title || 'Position';
    const trustScore = Math.round((session.trustScore || 0) * 100);
    const aiScore = evaluation.overallScore;

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #0f172a; padding: 20px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Proctara Evaluation Complete</h1>
        </div>
        <div style="padding: 30px; background-color: #ffffff;">
          <p style="color: #555555; line-height: 1.6;">
            The technical assessment for <strong>${candidateName}</strong> applying for <strong>${roleTitle}</strong> has been successfully processed.
          </p>
          <table style="border-collapse: collapse; width: 100%; max-width: 600px; margin-top: 20px;">
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Overall AI Score:</strong></td>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>${aiScore}/100</strong></td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Proctoring/Trust Score:</strong></td>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>${trustScore}%</strong></td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Recommendation:</strong></td>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;">${(evaluation.recommendation || '').toUpperCase()}</td>
            </tr>
          </table>
          <h3 style="margin-top: 20px; color: #333;">Executive Summary</h3>
          <p style="color: #555555; line-height: 1.6; background-color: #f8fafc; padding: 15px; border-radius: 6px; border: 1px solid #e2e8f0;">
            ${evaluation.summary}
          </p>
          <p style="color: #555555; margin-top: 20px;">
            Please log in to your Proctara Employer Dashboard to view the full detailed transcript and analysis.
          </p>
        </div>
      </div>
    `;

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: process.env.TEST_EMAIL,
        name: 'Proctara Evaluation',
        subject: `[Proctara] Evaluation Ready: ${candidateName}`,
        html: emailHtml
      })
    });

    const data = await res.json() as any;
    if (!data.success) throw new Error(data.error || 'Webhook failed');

    logger.info({ email: testEmail, candidateName }, 'Evaluation report email sent via Webhook');
  } catch (error) {
    logger.error({ err: error }, 'Failed to send evaluation report email');
  }
}

export async function sendCompletionEmail(
  candidateEmail: string,
  candidateName: string,
  campaignName: string,
  companyName: string
) {
  try {
    const webhookUrl = process.env.GAS_EMAIL_WEBHOOK_URL;
    if (!webhookUrl) {
      logger.warn('Email credentials missing, skipping sendCompletionEmail');
      return { success: false, error: 'Email configuration missing' };
    }

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Assessment Submission Confirmation</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f6f8fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f6f8fa; padding: 40px 0;">
          <tr>
            <td align="center">
              <!-- Main Container -->
              <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
                
                <!-- Header -->
                <tr>
                  <td style="background-color: #000000; padding: 24px 32px; text-align: left;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; letter-spacing: -0.5px;">proctara</h1>
                  </td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="padding: 40px 32px;">
                    <p style="margin: 0 0 20px 0; font-size: 16px; color: #1f2937; line-height: 24px;">
                      Hi ${candidateName},
                    </p>
                    <p style="margin: 0 0 32px 0; font-size: 16px; color: #4b5563; line-height: 24px;">
                      Thanks for completing your assessment for <strong>${companyName}</strong>! We've securely recorded your submission and AI evaluation for the <strong>${campaignName}</strong>.
                    </p>
                    
                    <h2 style="margin: 0 0 16px 0; font-size: 18px; color: #111827; font-weight: 600;">
                      What happens next?
                    </h2>
                    
                    <p style="margin: 0 0 32px 0; font-size: 15px; color: #4b5563; line-height: 24px;">
                      If they decide to move forward with your application, the <strong>${companyName}</strong> recruiting team will contact you to discuss the next steps. Any updates to your application status will be communicated directly by them.
                    </p>
                    
                    <div style="background-color: #f9fafb; border-radius: 6px; padding: 20px; text-align: center; margin-bottom: 32px;">
                      <p style="margin: 0; font-size: 15px; color: #4b5563;">
                        Wish you all the best for your result! 🤞
                      </p>
                    </div>

                    <p style="margin: 0; font-size: 15px; color: #4b5563; line-height: 24px;">
                      Best regards,<br>
                      <strong>The Proctara Team</strong>
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f9fafb; padding: 24px 32px; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0; font-size: 13px; color: #6b7280; line-height: 20px; text-align: center;">
                      This is an automated message generated by the Proctara platform. Please <strong>do not</strong> reply to this email. You'll need to contact ${companyName} directly for any follow-up questions regarding your application status.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: candidateEmail,
        subject: `${campaignName} - Submission Confirmation`,
        html: emailHtml
      })
    });

    const data = await res.json() as any;
    if (!data.success) throw new Error(data.error || 'Webhook failed');

    logger.info({ email: candidateEmail, candidateName, campaignName }, 'Completion email sent via Webhook');
  } catch (error) {
    logger.error({ err: error }, 'Failed to send completion email');
  }
}
