import { SESClient } from "@aws-sdk/client-ses";

const region = process.env.AWS_REGION ?? "us-east-1";

export const sesClient = new SESClient({
  region,
  credentials:
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          sessionToken: process.env.AWS_SESSION_TOKEN
        }
      : undefined
});
