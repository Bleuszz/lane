// Provisional product configuration. No provider prices or secrets belong here.
export const AI_ALLOWANCES = { trial: 0, starter: 0, seller: 500, pro: 1500 } as const;
export const AI_OPERATIONS = {
  listing_complete: {
    label: "Complete missing details",
    family: "listing",
    credits: 1,
    risky: false,
  },
  listing_improve: { label: "Improve listing copy", family: "listing", credits: 1, risky: false },
  background_remove: { label: "Remove background", family: "image", credits: 2, risky: false },
  white_background: { label: "White background", family: "image", credits: 2, risky: false },
  studio_background: { label: "Studio background", family: "image", credits: 10, risky: false },
  custom_background: { label: "Custom background", family: "image", credits: 10, risky: false },
  flat_lay: { label: "Flat lay", family: "image", credits: 10, risky: true },
  relight: { label: "Relight / cleanup", family: "image", credits: 8, risky: false },
  ghost_mannequin: { label: "Ghost mannequin", family: "image", credits: 20, risky: true },
  virtual_model: { label: "Virtual model", family: "image", credits: 25, risky: true },
  image_enhance: { label: "Image enhancement", family: "image", credits: 8, risky: false },
  crop: { label: "Crop / marketplace format", family: "image", credits: 2, risky: false },
} as const;
export type AiOperation = keyof typeof AI_OPERATIONS;
export const AI_FIELDS = [
  "title",
  "description",
  "brand",
  "colour",
  "material",
  "category",
  "garment_type",
  "pattern",
  "fit",
  "style",
  "size",
  "condition",
] as const;
export type AiField = (typeof AI_FIELDS)[number];
export const MOCK_MODES = [
  "SUCCESS",
  "TIMEOUT",
  "RATE_LIMIT",
  "PROVIDER_ERROR",
  "INVALID_OUTPUT",
] as const;
export type MockMode = (typeof MOCK_MODES)[number];
export const FIDELITY_RULE =
  "Preserve logos, text, colour, fabric, pattern, stitching, buttons, zips, graphics, proportions, damage and all identifying item details. Never hide defects or invent composition. Seller review is required.";
