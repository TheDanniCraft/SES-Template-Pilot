import { getSmtpTransport } from "@/lib/smtp-mail";

function trimOrNull(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function getMagicLinkFromEmail() {
  return trimOrNull(process.env.AUTH_MAGIC_LINK_FROM ?? process.env.SMTP_FROM_EMAIL);
}

export function resolveAppBaseUrl() {
  const explicit = trimOrNull(process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL);
  if (explicit) {
    return explicit.replace(/\/+$/, "");
  }

  const vercelUrl = trimOrNull(process.env.VERCEL_URL);
  if (vercelUrl) {
    return `https://${vercelUrl.replace(/\/+$/, "")}`;
  }

  return "http://localhost:3000";
}

type SendMagicLinkEmailInput = {
  email: string;
  magicLink: string;
};

export async function sendMagicLinkEmail(input: SendMagicLinkEmailInput) {
  const smtp = getSmtpTransport();
  const sourceEmail = getMagicLinkFromEmail();

  if (!smtp.success || !sourceEmail) {
    if (process.env.NODE_ENV !== "production") {
      return {
        success: true as const,
        delivered: false,
        previewUrl: input.magicLink
      };
    }

    return {
      success: false as const,
      delivered: false,
      error:
        "Magic link email is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and AUTH_MAGIC_LINK_FROM."
    };
  }

  try {
    await smtp.data.transporter.sendMail({
      from: sourceEmail,
      to: input.email,
      subject: "Your SES Template Pilot sign-in link",
      text: `Use this link to sign in:\n\n${input.magicLink}\n\nThis link expires in 15 minutes.`,
      html: `<p>Use this link to sign in:</p><p><a href="${input.magicLink}">${input.magicLink}</a></p><p>This link expires in 15 minutes.</p>`
    });

    return {
      success: true as const,
      delivered: true
    };
  } catch (error) {
    return {
      success: false as const,
      delivered: false,
      error: error instanceof Error ? error.message : "Failed to send magic link"
    };
  }
}
