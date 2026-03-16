import type { NextConfig } from "next";
import path from "path";
import { nodeFileTrace } from "@vercel/nft";

function isValidBase64Aes256Key(value: string) {
	const normalized = value.trim();
	if (!/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
		return false;
	}

	try {
		const decoded = Buffer.from(normalized, "base64");
		return decoded.length === 32;
	} catch {
		return false;
	}
}

function validateStartupEnv() {
	const cookieSecret = process.env.COOKIE_SECRET?.trim() ?? "";
	const dbSecretKey = process.env.DB_SECRET_KEY?.trim() ?? "";

	if (dbSecretKey && !isValidBase64Aes256Key(dbSecretKey)) {
		throw new Error("Invalid DB_SECRET_KEY: must be base64 for exactly 32 bytes (AES-256 key).");
	}

	if (cookieSecret && (cookieSecret.length < 24 || cookieSecret === "change-me-to-a-long-random-value")) {
		throw new Error("Invalid COOKIE_SECRET: set a strong random secret (at least 24 chars, not the default placeholder).");
	}
}

validateStartupEnv();

const drizzleTrace = nodeFileTrace([
	require.resolve("drizzle-kit"),
	require.resolve("drizzle-orm"),
	path.resolve(path.dirname(require.resolve("drizzle-kit")), "bin.cjs"),
]).then((trace) => [
	...trace.fileList,
	"./node_modules/.bin/drizzle-kit",
	"./node_modules/drizzle-orm/**",
	"./node_modules/drizzle-kit/**",
]);

const nextConfigPromise = drizzleTrace.then(
	(drizzleFiles) =>
		({
			output: "standalone",
			outputFileTracingIncludes: {
				"**": drizzleFiles,
			},
			reactStrictMode: true,
			poweredByHeader: false,
		}) satisfies NextConfig,
);

export default nextConfigPromise;
