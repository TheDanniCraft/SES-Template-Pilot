export function getAppPassword() {
  if (process.env.APP_PASSWORD) {
    return process.env.APP_PASSWORD;
  }

  if (process.env.NODE_ENV !== "production") {
    return "password";
  }

  return null;
}
