const MAPBOX_ENV_KEY = "NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN" as const;

export type MapboxConfig = {
  accessToken: string;
};

/**
 * Returns a validated Mapbox configuration object that can be used by both
 * client and server modules. Throws early when the required environment value
 * is missing so misconfigurations are caught during development and testing.
 */
export function getMapboxConfig(): MapboxConfig {
  // Direct access required for Next.js 16 client-side env vars
  const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

  if (!accessToken) {
    throw new Error(
      `Missing NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN. Please set it in your environment (see .env.example).`
    );
  }

  return { accessToken };
}
