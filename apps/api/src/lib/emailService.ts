// apps/api/src/lib/emailService.ts
//
// Minimal email service abstraction for notifications.
// For now, this is "console mail" in dev/staging and a TODO hook
// for real SMTP/SES/SendGrid integration in production.

export interface EmailPayload {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * sendEmail
 *
 * In development (and when no provider is configured), this will just log
 * the email payload to the server console so you can see what would be sent.
 *
 * For production, you should integrate a real provider (SES, SendGrid, etc.)
 * inside this function, using environment variables for credentials.
 */
export async function sendEmail(payload: EmailPayload): Promise<void> {
  const {
    EMAIL_FROM,
    EMAIL_PROVIDER,
    NODE_ENV,
  } = process.env;

  // DEV / default behavior: log to console
  if (!EMAIL_PROVIDER || NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.log("[DEV EMAIL OUTBOUND]", {
      from: EMAIL_FROM || "no-reply@elysium-crm.local",
      ...payload,
    });
    return;
  }

  // TODO: implement real provider wiring here.
  // Example shape:
  //
  // switch (EMAIL_PROVIDER) {
  //   case "SES":
  //     // use AWS SES SDK
  //     break;
  //   case "SENDGRID":
  //     // use SendGrid SDK
  //     break;
  //   default:
  //     console.warn("Unknown EMAIL_PROVIDER, falling back to console log");
  //     console.log("[EMAIL PAYLOAD]", payload);
  // }
  //
  // For now, just log that production email sending isn't wired:
  // eslint-disable-next-line no-console
  console.warn(
    "[EMAIL SERVICE] EMAIL_PROVIDER is set but real sending is not implemented yet. Payload:",
    payload
  );
}

