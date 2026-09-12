/** Public booleans only. Mutation handlers independently enforce their own flags. */
export function releaseFeatures(env: Record<string, string | undefined>) {
  return {
    ai:
      env.LANE_ENV !== "production" &&
      env.AI_MOCK_DEVELOPMENT === "true" &&
      (env.AI_LISTING_ENABLED === "true" || env.AI_IMAGE_ENABLED === "true"),
    scheduler: env.SCHEDULER_ENABLED === "true",
    images: env.IMAGE_NORMALIZATION_ENABLED === "true",
  };
}
