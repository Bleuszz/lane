import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** Local QR so the connect secret never hits a third-party image CDN. */
export function QrImage({ value, size = 180, alt = "QR code" }: { value: string; size?: number; alt?: string }) {
  const [src, setSrc] = useState<string>("");
  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#111111", light: "#ffffff" },
    }).then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [value, size]);
  if (!src) {
    return <div className="h-44 w-44 animate-pulse rounded-[var(--radius-sm)] border border-line bg-raised" aria-hidden />;
  }
  return (
    <img alt={alt} src={src} width={size} height={size} className="h-44 w-44 rounded-[var(--radius-sm)] border border-line bg-raised p-2" />
  );
}
