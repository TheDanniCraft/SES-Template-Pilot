export function getPolarOrganizationId() {
  return process.env.POLAR_ORGANIZATION_ID?.trim() ?? "";
}

export function getPolarServer() {
  const env = (process.env.POLAR_ENV ?? "production").trim().toLowerCase();
  return env === "sandbox" ? "sandbox" : "production";
}
