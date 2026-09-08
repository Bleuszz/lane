export type SizeKind = "clothing" | "footwear" | "kids";

export type SizeRow = {
  uk: string;
  eu: string;
  us: string;
};

export const CLOTHING_SIZES: SizeRow[] = [
  { uk: "6", eu: "34", us: "2" },
  { uk: "8", eu: "36", us: "4" },
  { uk: "10", eu: "38", us: "6" },
  { uk: "12", eu: "40", us: "8" },
  { uk: "14", eu: "42", us: "10" },
  { uk: "16", eu: "44", us: "12" },
  { uk: "18", eu: "46", us: "14" },
  { uk: "XS", eu: "XS", us: "XS" },
  { uk: "S", eu: "S", us: "S" },
  { uk: "M", eu: "M", us: "M" },
  { uk: "L", eu: "L", us: "L" },
  { uk: "XL", eu: "XL", us: "XL" },
  { uk: "XXL", eu: "XXL", us: "XXL" },
];

export const FOOTWEAR_SIZES: SizeRow[] = [
  { uk: "3", eu: "35.5", us: "4" },
  { uk: "4", eu: "37", us: "5" },
  { uk: "5", eu: "38", us: "6" },
  { uk: "6", eu: "39", us: "7" },
  { uk: "6.5", eu: "40", us: "7.5" },
  { uk: "7", eu: "40.5", us: "8" },
  { uk: "7.5", eu: "41", us: "8.5" },
  { uk: "8", eu: "42", us: "9" },
  { uk: "8.5", eu: "42.5", us: "9.5" },
  { uk: "9", eu: "43", us: "10" },
  { uk: "9.5", eu: "44", us: "10.5" },
  { uk: "10", eu: "44.5", us: "11" },
  { uk: "11", eu: "46", us: "12" },
  { uk: "12", eu: "47", us: "13" },
];

export function convertSize(
  value: string,
  from: "uk" | "eu" | "us",
  kind: SizeKind,
): SizeRow | null {
  const table = kind === "footwear" ? FOOTWEAR_SIZES : CLOTHING_SIZES;
  const needle = value.trim().toUpperCase();
  return (
    table.find((row) => row[from].toUpperCase() === needle) ??
    table.find((row) => row.uk.toUpperCase() === needle) ??
    null
  );
}

export function sizeKindForCategory(canonical: string | null | undefined): SizeKind {
  if (canonical?.includes("footwear")) return "footwear";
  if (canonical?.startsWith("kids")) return "kids";
  return "clothing";
}
