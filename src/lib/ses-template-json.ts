export type SesTemplateParts = {
  sesTemplateName: string;
  subject: string;
  htmlContent: string;
  textContent: string;
};

const PREVIEW_VARIABLES_KEY = "examples";
const LEGACY_PREVIEW_VARIABLES_KEY = "__previewVariables";
const BRAND_KIT_KEY = "brandKitId";

export function buildSesTemplateJson(parts: SesTemplateParts) {
  return {
    TemplateName: parts.sesTemplateName,
    TemplateContent: {
      Subject: parts.subject,
      Text: parts.textContent,
      Html: parts.htmlContent
    }
  };
}

export function normalizeDesignJson(
  _designJson: Record<string, unknown> | undefined,
  parts: SesTemplateParts
) {
  return buildSesTemplateJson(parts);
}

export function sanitizePreviewVariables(
  input: Record<string, unknown> | undefined
) {
  if (!input) {
    return undefined;
  }

  const normalized = Object.fromEntries(
    Object.entries(input)
      .map(([key, value]) => [key.trim(), String(value ?? "")])
      .filter(([key]) => key.length > 0)
  );

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function extractPreviewVariables(
  designJson: Record<string, unknown> | undefined | null
) {
  if (!designJson || typeof designJson !== "object") {
    return undefined;
  }

  const candidate =
    designJson[PREVIEW_VARIABLES_KEY] ?? designJson[LEGACY_PREVIEW_VARIABLES_KEY];
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return undefined;
  }

  return sanitizePreviewVariables(candidate as Record<string, unknown>);
}

export function attachPreviewVariables(
  designJson: Record<string, unknown>,
  previewVariables: Record<string, unknown> | undefined
) {
  const sanitized = sanitizePreviewVariables(previewVariables);
  if (!sanitized) {
    return designJson;
  }

  return {
    ...designJson,
    [PREVIEW_VARIABLES_KEY]: sanitized
  };
}

export function extractBrandKitId(
  designJson: Record<string, unknown> | undefined | null
) {
  if (!designJson || typeof designJson !== "object") {
    return undefined;
  }
  const value = designJson[BRAND_KIT_KEY];
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function attachBrandKitId(
  designJson: Record<string, unknown>,
  brandKitId: string | undefined
) {
  const { [BRAND_KIT_KEY]: _ignored, ...withoutBrandKit } = designJson;

  if (!brandKitId?.trim()) {
    return withoutBrandKit;
  }

  return {
    ...withoutBrandKit,
    [BRAND_KIT_KEY]: brandKitId.trim()
  };
}
