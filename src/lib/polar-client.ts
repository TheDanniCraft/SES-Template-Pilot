import { Polar } from "@polar-sh/sdk";
import { getPolarServer } from "@/lib/polar-config";

export function createPolarClient() {
  const accessToken = process.env.POLAR_ACCESS_TOKEN?.trim();
  return new Polar({
    server: getPolarServer(),
    accessToken: accessToken && accessToken.length > 0 ? accessToken : undefined
  });
}

