import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Unlock, Pencil, X, Plus, FileText, GripHorizontal } from "lucide-react";

/**
 * DraggableWaypoint.tsx
 *
 * A single-file, drop‑in React component that renders a stylish, draggable
 * rhombus “waypoint” on top of any background. Click the waypoint to open a
 * document grid with thumbnails of the first page of attached PDFs.
 *
 * Features
 * - Rhombus diamond design with glow + hover effects
 * - Drag & drop with pointer events (no external drag lib)
 * - Lock / unlock to prevent moving
 * - Edit mode to add/remove PDFs
 * - Auto‑save position & contents (localStorage) per‑waypoint ID
 * - PDF first‑page thumbnail rendering (pdfjs) with graceful fallback
 *
 * Usage
 *   export default function Demo() {
 *     return (
 *       <div className="w-full h-[80vh] bg-[url('https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=2400&auto=format&fit=crop')] bg-cover bg-center relative overflow-hidden">
 *         <DraggableWaypoint id="wp-rome" initial={{ x: 120, y: 140 }} label="Rome" />
 *         <DraggableWaypoint id="wp-paris" initial={{ x: 380, y: 260 }} label="Paris" />
 *       </div>
 *     );
 *   }
 */

// ---- Types ----

type WaypointDoc = {
    id: string;
    name: string;
    dataUrl: string; // base64 data URL of the PDF for persistence
    thumb?: string; // base64 of rendered first page (created lazily)
};

type DraggableWaypointProps = {
    id: string; // unique stable ID for autosave
    label?: string;
    initial?: { x: number; y: number };
    // Dock integration
    dockMode?: boolean; // if true, clicking triggers external dock instead of internal panel
    onOpen?: (id: string, label?: string) => void; // called when user clicks the waypoint (dockMode only)
};

// Small helper to throttle frequent saves
function throttle<T extends (...args: never[]) => void>(fn: T, wait = 250) {
    let last = 0;
    let timer: number = null;
    return (...args: Parameters<T>) => {
        const now = Date.now();
        if (now - last >= wait) {
            last = now;
            fn(...args);
        } else {
            clearTimeout(timer);
            timer = setTimeout(() => {
                last = Date.now();
                fn(...args);
            }, wait - (now - last));
        }
    };
}

// Lazy pdf.js loader to avoid bundler worker issues. If it fails, we fallback.
async function renderPdfFirstPageToDataUrl(fileDataUrl: string, width = 220): Promise<string | null> {
    try {
        const pdfjs = await import(/* webpackIgnore: true */ "pdfjs-dist/build/pdf");
        // Some environments need a worker; try to set it to a CDN. If not allowed, pdfjs can still run in main thread.
        try {
            const workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
            pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
        } catch {}

        // Fetch the data as an ArrayBuffer from the data URL
        const res = await fetch(fileDataUrl);
        const buf = await res.arrayBuffer();

        const loadingTask = pdfjs.getDocument({ data: buf });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);

        const viewport = page.getViewport({ scale: 1 });
        const scale = width / viewport.width;
        const scaled = page.getViewport({ scale });

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;
        canvas.width = Math.ceil(scaled.width);
        canvas.height = Math.ceil(scaled.height);

        await page.render({ canvasContext: ctx, viewport: scaled }).promise;
        const url = canvas.toDataURL("image/png", 0.9);
        return url;
    } catch (e) {
        console.warn("pdf thumbnail render failed:", e);
        return null;
    }
}

// ---- Component ----

export function DraggableWaypoint({ id, label = "Waypoint", initial = { x: 80, y: 80 }, dockMode = false, onOpen }: DraggableWaypointProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const dragRef = useRef<HTMLDivElement | null>(null);
    const [pos, setPos] = useState<{ x: number; y: number }>(() => {
        const saved = localStorage.getItem(`${id}:pos`);
        return saved ? JSON.parse(saved) : initial;
    });
    const [locked, setLocked] = useState<boolean>(() => localStorage.getItem(`${id}:locked`) === "1");
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(false);
    const [docs, setDocs] = useState<WaypointDoc[]>(() => {
        try {
            const raw = localStorage.getItem(`${id}:docs`);
            return raw ? (JSON.parse(raw) as WaypointDoc[]) : [];
        } catch {
            return [];
        }
    });

    // Autosave (throttled for pos)
    const savePos = useMemo(
        () =>
            throttle((p: { x: number; y: number }) => {
                localStorage.setItem(`${id}:pos`, JSON.stringify(p));
            }, 200),
        [id]
    );

    useEffect(() => savePos(pos), [pos, savePos]);
    useEffect(() => localStorage.setItem(`${id}:locked`, locked ? "1" : "0"), [id, locked]);
    useEffect(() => localStorage.setItem(`${id}:docs`, JSON.stringify(docs)), [id, docs]);

    // Pointer drag logic
    const dragging = useRef(false);
    const start = useRef<{ x: number; y: number; pointerX: number; pointerY: number } | null>(null);

    const onPointerDown = (e: React.PointerEvent) => {
        if (locked) return;
        dragging.current = true;
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        start.current = { x: pos.x, y: pos.y, pointerX: e.clientX, pointerY: e.clientY };
    };

    const onPointerMove = (e: React.PointerEvent) => {
        if (!dragging.current || !start.current) return;
        const dx = e.clientX - start.current.pointerX;
        const dy = e.clientY - start.current.pointerY;
        // Constrain to container
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const size = 64; // rhombus bounding box ~ square size
        let nx = start.current.x + dx;
        let ny = start.current.y + dy;
        nx = Math.max(0, Math.min(nx, rect.width - size));
        ny = Math.max(0, Math.min(ny, rect.height - size));
        setPos({ x: nx, y: ny });
    };

    const onPointerUp = (e: React.PointerEvent) => {
        dragging.current = false;
        start.current = null;
        (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    };

    // Add PDFs
    const inputRef = useRef<HTMLInputElement | null>(null);
    const onAddClick = () => inputRef.current?.click();

    const handleFiles = async (files: FileList | null) => {
        if (!files || !files.length) return;
        const additions: WaypointDoc[] = [];
        for (const file of Array.from(files)) {
            if (file.type !== "application/pdf") continue;
            const dataUrl = await new Promise<string>((resolve, reject) => {
                const fr = new FileReader();
                fr.onload = () => resolve(fr.result as string);
                fr.onerror = reject;
                fr.readAsDataURL(file);
            });
            const idv = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            additions.push({ id: idv, name: file.name, dataUrl });
        }

        // Optimistically add docs, then render thumbs lazily
        setDocs(prev => [...prev, ...additions]);

        // Render thumbnails sequentially to avoid heavy CPU spikes
        for (const d of additions) {
            const thumb = await renderPdfFirstPageToDataUrl(d.dataUrl);
            setDocs(prev => prev.map(p => (p.id === d.id ? { ...p, thumb: thumb || p.thumb } : p)));
        }
    };

    const removeDoc = useCallback((docId: string) => setDocs(prev => prev.filter(d => d.id !== docId)), []);

    // Outside click to close panel
    useEffect(() => {
        function onDocClick(e: MouseEvent) {
            const dlg = document.getElementById(`${id}-panel`);
            const node = dragRef.current;
            if (!dlg || !node) return;
            if (dlg.contains(e.target as Node) || node.contains(e.target as Node)) return;
            setOpen(false);
            setEditing(false);
        }
        if (open) document.addEventListener("mousedown", onDocClick);
        return () => document.removeEventListener("mousedown", onDocClick);
    }, [open, id]);

    return (
        <div ref={containerRef} className="absolute inset-0">
            {/* Waypoint (rhombus) */}
            <div
                ref={dragRef}
                style={{ left: pos.x, top: pos.y }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                className="absolute select-none group"
            >
                <motion.button
                    onClick={() => (dockMode ? onOpen?.(id, label) : setOpen(v => !v))}
                    whileHover={{ scale: locked ? 1 : 1.05 }}
                    whileTap={{ scale: locked ? 1 : 0.98 }}
                    aria-label={`Open ${label}`}
                    className="relative w-16 h-16 origin-center"
                >
                    {/* Glow */}
                    <div className="absolute inset-0 -z-10 blur-xl opacity-60 group-hover:opacity-90 transition-opacity" style={{
                        background: "conic-gradient(from 180deg at 50% 50%, #22d3ee, #a78bfa, #22d3ee)",
                        transform: "rotate(45deg)",
                        borderRadius: 16,
                        filter: locked ? "grayscale(1) opacity(0.5)" : undefined,
                    }} />
                    {/* Diamond */}
                    <div
                        className={`w-16 h-16 rotate-45 grid place-items-center shadow-2xl transition-all rounded-2xl ${
                            locked ? "bg-neutral-700/80 border border-neutral-600" : "bg-gradient-to-br from-cyan-400 to-fuchsia-500"
                        }`}
                        style={{ boxShadow: locked ? "0 6px 18px rgba(0,0,0,0.35)" : "0 10px 25px rgba(91,33,182,0.45)" }}
                    >
                        {/* Inner content unrotated */}
                        <div className="-rotate-45 text-white flex items-center gap-1">
                            {locked ? <Lock size={16} /> : <GripHorizontal size={16} />}
                            <span className="text-sm font-semibold drop-shadow">{label}</span>
                        </div>
                    </div>
                </motion.button>
            </div>

            {/* Panel */}
            <AnimatePresence>
                {!dockMode && open && (
                    <motion.div
                        id={`${id}-panel`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        transition={{ type: "spring", stiffness: 380, damping: 28 }}
                        style={{ left: pos.x + 84, top: pos.y - 12, maxWidth: 520 }}
                        className="absolute z-20 bg-white/85 backdrop-blur border border-neutral-200 shadow-xl rounded-2xl p-3"
                    >
                        <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-fuchsia-500" />
                                <h3 className="text-sm font-semibold">{label} – Documents</h3>
                                <span className="text-xs text-neutral-500">{docs.length}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setEditing(e => !e)}
                                    className="px-2 py-1 text-xs rounded-lg bg-neutral-900 text-white hover:opacity-90 inline-flex items-center gap-1"
                                >
                                    <Pencil size={14} /> Edit
                                </button>
                                <button
                                    onClick={() => setLocked(l => !l)}
                                    className="px-2 py-1 text-xs rounded-lg bg-neutral-200 hover:bg-neutral-300 inline-flex items-center gap-1"
                                >
                                    {locked ? <Unlock size={14} /> : <Lock size={14} />} {locked ? "Unlock" : "Lock"}
                                </button>
                                <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-neutral-100">
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Edit toolbar */}
                        <AnimatePresence initial={false}>
                            {editing && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="mb-2"
                                >
                                    <div className="flex items-center gap-2">
                                        <input
                                            ref={inputRef}
                                            type="file"
                                            accept="application/pdf"
                                            multiple
                                            className="hidden"
                                            onChange={e => handleFiles(e.target.files)}
                                        />
                                        <button
                                            onClick={onAddClick}
                                            className="px-2 py-1 text-xs rounded-lg bg-cyan-600 text-white hover:opacity-90 inline-flex items-center gap-1"
                                        >
                                            <Plus size={14} /> Add PDFs
                                        </button>
                                        <span className="text-xs text-neutral-500">(first page becomes the icon)</span>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Grid */}
                        <div className="grid grid-cols-3 gap-3">
                            {docs.length === 0 && (
                                <div className="col-span-3 text-center text-sm text-neutral-500 p-6 border border-dashed rounded-xl">
                                    No documents yet. {editing ? "Click Add PDFs to attach some." : "Enter Edit to add PDFs."}
                                </div>
                            )}

                            {docs.map(doc => (
                                <div key={doc.id} className="relative group rounded-xl border bg-white overflow-hidden">
                                    <div className="aspect-[4/3] w-full bg-neutral-50 grid place-items-center overflow-hidden">
                                        {doc.thumb ? (
                                            // Thumbnail image
                                            <img src={doc.thumb} alt={`${doc.name} thumbnail`} className="w-full h-full object-cover" />
                                        ) : (
                                            // Fallback while/if pdf thumb can't render
                                            <div className="flex flex-col items-center justify-center text-neutral-400">
                                                <FileText size={36} />
                                                <span className="text-xs mt-1">PDF</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="px-2 py-2">
                                        <p className="text-xs font-medium truncate" title={doc.name}>{doc.name}</p>
                                    </div>

                                    {editing && (
                                        <button
                                            onClick={() => removeDoc(doc.id)}
                                            className="absolute top-1 right-1 bg-white/90 hover:bg-white text-neutral-800 rounded-full p-1 shadow"
                                            title="Remove"
                                        >
                                            <X size={14} />
                                        </button>
                                    )}

                                    {/* Open the PDF in a new tab */}
                                    {!editing && (
                                        <a
                                            href={doc.dataUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="absolute inset-0"
                                            title="Open PDF"
                                        />
                                    )}
                                </div>) )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// --- Lightweight demo harness so you can test in ChatGPT immediately ---
export default function DemoCanvas() {
    return (
        <div className="w-full h-[80vh] relative overflow-hidden bg-[radial-gradient(80%_80%_at_50%_50%,#0ea5e946,transparent),url('https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=2400&auto=format&fit=crop')] bg-cover bg-center">
            {/* Soft vignette */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_60%,#00000060_100%)]" />
            <DraggableWaypoint id="wp-a" label="Alpha" initial={{ x: 100, y: 150 }} />
            <DraggableWaypoint id="wp-b" label="Bravo" initial={{ x: 360, y: 260 }} />
            <div className="absolute left-4 bottom-4 text-white/90 text-sm max-w-lg">
                Tip: click a rhombus to open its documents. Use Edit → Add PDFs to attach files.
                Everything (position, lock state, docs) is autosaved locally.
            </div>
        </div>
    );
}
