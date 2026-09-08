export const CARRIERS = [
  { id: "royal_mail", label: "Royal Mail" },
  { id: "evri", label: "Evri" },
  { id: "inpost", label: "InPost" },
  { id: "yodel", label: "Yodel" },
  { id: "vinted_shipping", label: "Vinted shipping" },
  { id: "ebay_click_drop", label: "eBay Click & Drop" },
] as const;

export type PostagePreset = {
  id: string;
  name: string;
  carrier: (typeof CARRIERS)[number]["id"];
  service: string;
  packageType: string;
  buyerPays: boolean;
  priceGbp: number;
  collection: boolean;
  marketplace: "ebay_uk" | "vinted_uk" | null;
};

export const POSTAGE_PRESETS: PostagePreset[] = [
  {
    id: "rm_2nd_large_letter",
    name: "Royal Mail 2nd Large Letter",
    carrier: "royal_mail",
    service: "2nd Class Large Letter",
    packageType: "large_letter",
    buyerPays: true,
    priceGbp: 1.55,
    collection: false,
    marketplace: "ebay_uk",
  },
  {
    id: "rm_2nd_small_parcel_2kg",
    name: "Royal Mail 2nd Small Parcel 2kg",
    carrier: "royal_mail",
    service: "2nd Class Small Parcel",
    packageType: "small_parcel_2kg",
    buyerPays: true,
    priceGbp: 3.69,
    collection: false,
    marketplace: "ebay_uk",
  },
  {
    id: "rm_2nd_medium_parcel_2kg",
    name: "Royal Mail 2nd Medium Parcel 2kg",
    carrier: "royal_mail",
    service: "2nd Class Medium Parcel",
    packageType: "medium_parcel_2kg",
    buyerPays: true,
    priceGbp: 5.89,
    collection: false,
    marketplace: "ebay_uk",
  },
  {
    id: "evri_parcelshop",
    name: "Evri ParcelShop 2kg",
    carrier: "evri",
    service: "ParcelShop 2kg",
    packageType: "parcel_2kg",
    buyerPays: true,
    priceGbp: 2.99,
    collection: true,
    marketplace: "ebay_uk",
  },
  {
    id: "inpost_locker",
    name: "InPost locker S",
    carrier: "inpost",
    service: "Locker S",
    packageType: "locker_s",
    buyerPays: true,
    priceGbp: 2.49,
    collection: true,
    marketplace: "ebay_uk",
  },
  {
    id: "vinted_small",
    name: "Vinted shipping — small",
    carrier: "vinted_shipping",
    service: "Home or locker · small",
    packageType: "small",
    buyerPays: true,
    priceGbp: 1.99,
    collection: false,
    marketplace: "vinted_uk",
  },
  {
    id: "vinted_medium",
    name: "Vinted shipping — medium",
    carrier: "vinted_shipping",
    service: "Home or locker · medium",
    packageType: "medium",
    buyerPays: true,
    priceGbp: 2.79,
    collection: false,
    marketplace: "vinted_uk",
  },
  {
    id: "vinted_large",
    name: "Vinted shipping — large",
    carrier: "vinted_shipping",
    service: "Home or locker · large",
    packageType: "large",
    buyerPays: true,
    priceGbp: 3.49,
    collection: false,
    marketplace: "vinted_uk",
  },
];
