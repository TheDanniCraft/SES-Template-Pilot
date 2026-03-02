import { CloudWatchClient } from "@aws-sdk/client-cloudwatch";

const region = process.env.AWS_REGION ?? "us-east-1";

export const cloudWatchClient = new CloudWatchClient({
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
