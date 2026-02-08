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
  const accessToken = process.env[MAPBOX_ENV_KEY];

  if (!accessToken) {
    throw new Error(
      `Missing ${MAPBOX_ENV_KEY}. Please set it in your environment (see .env.example).`
    );
  }

  return { accessToken };
}
