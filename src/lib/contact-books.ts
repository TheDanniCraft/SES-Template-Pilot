export type RecipientVariablesMap = Record<string, Record<string, string>>;

export type ContactBook = {
  id: string;
  name: string;
  recipients: string[];
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidContactEmail(value: string) {
  return EMAIL_REGEX.test(value.trim().toLowerCase());
}

export function normalizeRecipients(input: string[]) {
  return input
    .map((value) => value.trim().toLowerCase())
    .filter((value) => isValidContactEmail(value))
    .filter((value, index, arr) => arr.indexOf(value) === index);
}

export function extractRecipientsFromUnknown(input: unknown) {
  if (Array.isArray(input)) {
    return normalizeRecipients(input.map((item) => String(item ?? "")));
  }

  if (typeof input === "object" && input !== null) {
    return normalizeRecipients(Object.keys(input as Record<string, unknown>));
  }

  return [] as string[];
}

export function parseRecipientVariablesMapJson(input: string) {
  try {
    const parsed = JSON.parse(input) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {
        map: {} as RecipientVariablesMap,
        error: "JSON must be an object map keyed by recipient email."
      };
    }

    const record = parsed as Record<string, unknown>;
    const next: RecipientVariablesMap = {};

    for (const [recipient, value] of Object.entries(record)) {
      if (!isValidContactEmail(recipient)) {
        return {
          map: {} as RecipientVariablesMap,
          error: `Key "${recipient}" must be a valid recipient email.`
        };
      }

      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return {
          map: {} as RecipientVariablesMap,
          error: `Value for "${recipient}" must be an object map, for example {"name":"Alex"}.`
        };
      }

      next[recipient.trim().toLowerCase()] = Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
          key,
          String(nestedValue ?? "")
        ])
      );
    }

    return {
      map: next,
      error: null as string | null
    };
  } catch {
    return {
      map: {} as RecipientVariablesMap,
      error: "JSON must be valid, for example {\"user@example.com\":{\"name\":\"Alex\"}}."
    };
  }
}
