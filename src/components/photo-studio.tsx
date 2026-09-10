import { useEffect, useRef, useState } from "react";
import { Button, Field, NativeSelect } from "./ui";

export function PhotoStudio({ source, onSave, onClose }: { source: string; onSave: (url: string) => void; onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [rotation, setRotation] = useState(0);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [framing, setFraming] = useState("fit");
  const [background, setBackground] = useState("#ffffff");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    let cancelled = false; setReady(false); setError("");
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled || !canvas.current) return;
      const ctx = canvas.current.getContext("2d"); if (!ctx) return;
      const size = 1200;
      canvas.current.width = size; canvas.current.height = size;
      ctx.fillStyle = background; ctx.fillRect(0, 0, size, size);
      const sideways = rotation % 180 !== 0;
      const width = sideways ? img.height : img.width, height = sideways ? img.width : img.height;
      const scale = framing === "crop" ? Math.max(size / width, size / height) : Math.min(size * .90 / width, size * .90 / height);
      ctx.save(); ctx.translate(size / 2, size / 2); ctx.rotate(rotation * Math.PI / 180);
      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
      ctx.drawImage(img, -img.width * scale / 2, -img.height * scale / 2, img.width * scale, img.height * scale); ctx.restore();
      setReady(true);
    };
    img.onerror = () => { if (!cancelled) setError("This image host does not allow editing here. Upload the original photo from your device instead."); };
    img.src = source;
    return () => { cancelled = true; };
  }, [source, rotation, brightness, contrast, framing, background]);
  function save() {
    try { if (canvas.current && ready) onSave(canvas.current.toDataURL("image/jpeg", .9)); }
    catch { setError("This image cannot be exported by your browser. Use a local photo instead."); }
  }
  return <dialog ref={dialog} onCancel={onClose} className="photo-dialog w-[min(940px,95vw)] rounded-2xl border border-line bg-surface p-0 text-ink backdrop:bg-black/50">
    <div className="flex items-center justify-between border-b border-line p-5"><div><h2 className="text-xl font-semibold">Photo studio</h2><p className="mt-1 text-sm text-muted">A cleaner frame. The same item.</p></div><Button variant="ghost" onClick={onClose} aria-label="Close photo studio">Close</Button></div>
    <div className="grid gap-6 p-5 md:grid-cols-[1fr_240px]"><div className="min-w-0"><canvas ref={canvas} aria-label="Edited product photo preview" className="aspect-square w-full rounded-lg bg-raised"/>{error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}</div>
      <div className="space-y-5"><Field label="Frame"><NativeSelect value={framing} onChange={(e) => setFraming(e.target.value)}><option value="fit">Full item with breathing room</option><option value="crop">Square centre crop</option></NativeSelect></Field><Field label="Frame colour"><NativeSelect value={background} onChange={(e) => setBackground(e.target.value)}><option value="#ffffff">Clean white</option><option value="#f2eee5">Warm paper</option></NativeSelect></Field><Button variant="secondary" onClick={() => setRotation((r) => (r + 90) % 360)}>Rotate 90°</Button><Field label={`Lighting · ${brightness}%`}><input aria-label="Lighting" className="w-full accent-[var(--color-mark)]" type="range" min="80" max="120" value={brightness} onChange={(e) => setBrightness(Number(e.target.value))}/></Field><Field label={`Contrast · ${contrast}%`}><input aria-label="Contrast" className="w-full accent-[var(--color-mark)]" type="range" min="80" max="120" value={contrast} onChange={(e) => setContrast(Number(e.target.value))}/></Field><p className="text-xs leading-relaxed text-muted">Runs on your device. No AI credits. Keep colours and flaws accurate. This tool changes framing and lighting; it does not remove the original background.</p><Button onClick={save} disabled={!ready || Boolean(error)}>Add cleaned copy</Button><p className="text-xs text-muted">Your original stays in the listing. Export: 1200 × 1200 JPEG.</p></div>
    </div>
  </dialog>;
}
