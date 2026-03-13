type LicenseServerSuccess<T> = {
  success: true;
  data: T;
};

type LicenseServerError = {
  success: false;
  error: string;
};

export function getLicenseServerUrl() {
  return process.env.LICENSE_SERVER_URL?.trim() ?? "";
}

function normalizeBaseUrl(input: string) {
  return input.replace(/\/+$/, "");
}

async function postLicenseServer<T>(
  path: string,
  payload: Record<string, string>
): Promise<LicenseServerSuccess<T> | LicenseServerError> {
  const base = getLicenseServerUrl();
  if (!base) {
    return {
      success: false,
      error: "Missing LICENSE_SERVER_URL."
    };
  }

  try {
    const response = await fetch(`${normalizeBaseUrl(base)}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload),
      cache: "no-store"
    });

    const text = await response.text();
    const parsed = text ? (JSON.parse(text) as { success?: boolean; error?: string; data?: T }) : {};
    if (!response.ok || !parsed.success) {
      return {
        success: false,
        error: parsed.error?.trim() || `License server request failed (${response.status})`
      };
    }

    return {
      success: true,
      data: parsed.data as T
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to reach license server"
    };
  }
}

export function activateLicenseOnServer(input: { key: string; label: string }) {
  return postLicenseServer<{
    id?: string;
    label?: string;
    licenseKey?: { id?: string };
  }>("/v1/licenses/activate", input);
}

export function validateLicenseOnServer(input: { key: string }) {
  return postLicenseServer<{
    id?: string;
    status?: string;
  }>("/v1/licenses/validate", input);
}

export function deactivateLicenseOnServer(input: {
  key: string;
  activationId: string;
}) {
  return postLicenseServer<{ id?: string }>("/v1/licenses/deactivate", input);
}
