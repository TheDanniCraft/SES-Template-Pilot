import { z } from "zod";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email")
});

export const templateDraftSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2, "Template name is required"),
  sesTemplateName: z.string().min(2, "SES template name is required"),
  subject: z.string().min(2, "Subject is required"),
  htmlContent: z.string().min(2, "HTML is required"),
  textContent: z.string().min(2, "Plain text is required"),
  brandKitId: z.string().optional(),
  designJson: z.record(z.string(), z.unknown()).optional(),
  previewVariables: z.record(z.string(), z.string()).optional()
});

export const syncTemplateSchema = z.object({
  sesTemplateName: z.string().min(2, "SES template name is required"),
  subject: z.string().min(2, "Subject is required"),
  htmlContent: z.string().min(2, "HTML is required"),
  textContent: z.string().min(2, "Plain text is required")
});

export const campaignSchema = z.object({
  recipients: z
    .array(
      z
        .string()
        .trim()
        .toLowerCase()
        .refine((value) => emailRegex.test(value), "Invalid recipient email")
    )
    .min(1, "Add at least one recipient"),
  templateName: z.string().min(2, "Template name is required"),
  templateData: z
    .string()
    .min(2, "Template JSON is required")
    .refine((value) => {
      try {
        const parsed = JSON.parse(value);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
          return false;
        }

        return Object.entries(parsed as Record<string, unknown>).every(
          ([recipient, recipientValue]) =>
            emailRegex.test(recipient) &&
            typeof recipientValue === "object" &&
            recipientValue !== null &&
            !Array.isArray(recipientValue)
        );
      } catch {
        return false;
      }
    }, "Template Variables JSON must be per-recipient, for example {\"user@example.com\":{\"name\":\"Alex\"}}")
});

export type LoginInput = z.infer<typeof loginSchema>;
export type TemplateDraftInput = z.infer<typeof templateDraftSchema>;
export type SyncTemplateInput = z.infer<typeof syncTemplateSchema>;
export type CampaignInput = z.infer<typeof campaignSchema>;
