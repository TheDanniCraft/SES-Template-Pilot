const AWS_REGION_TABLE_URL = "https://api.regional-table.region-services.aws.a2z.com/index.json";
const AWS_SES_SERVICE_NAME = "Amazon Simple Email Service (SES)";

export async function getAwsSesRegions() {
  try {
    const response = await fetch(AWS_REGION_TABLE_URL, {
      next: { revalidate: 60 * 60 * 24 }
    });
    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as {
      prices?: Record<string, { attributes?: Record<string, string> }>;
    };
    const entries = Object.values(payload.prices ?? {});
    const regions = new Set<string>();

    for (const entry of entries) {
      const attributes = entry?.attributes ?? {};
      if (attributes["aws:serviceName"] !== AWS_SES_SERVICE_NAME) {
        continue;
      }
      const region = attributes["aws:region"]?.trim();
      if (region) {
        regions.add(region);
      }
    }

    const list = Array.from(regions).sort((a, b) => a.localeCompare(b));
    return list;
  } catch {
    return [];
  }
}
