'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Unlock, Pencil, X, Plus, FileText } from 'lucide-react';

type WaypointDoc = {
    id: string;
    name: string;
    dataUrl: string;
    thumb?: string;
};

async function renderPdfFirstPageToDataUrl(fileDataUrl: string, width = 220): Promise<string | null> {
    try {
        const pdfjs: never = await import(/* webpackIgnore: true */ 'pdfjs-dist/build/pdf');
        try {
            pdfjs.GlobalWorkerOptions.workerSrc =
                'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        } catch {}
        const res = await fetch(fileDataUrl);
        const buf = await res.arrayBuffer();
        const loadingTask = pdfjs.getDocument({ data: buf });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);

        const viewport = page.getViewport({ scale: 1 });
        const scale = width / viewport.width;
        const scaled = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        canvas.width = Math.ceil(scaled.width);
        canvas.height = Math.ceil(scaled.height);
        await page.render({ canvasContext: ctx, viewport: scaled }).promise;
        return canvas.toDataURL('image/png', 0.9);
    } catch {
        return null;
    }
}

type DockProps = {
    activeId: string | null;
    activeLabel?: string;
    onClose?: () => void;
    left?: number;
    top?: number;
};

export default function DraggableDocumentDock({
                                                  activeId,
                                                  activeLabel = 'Documents',
                                                  onClose,
                                                  left,
                                                  top,
                                              }: DockProps) {
    const [docs, setDocs] = useState<WaypointDoc[]>([]);
    const [locked, setLocked] = useState<boolean>(false);
    const [editing, setEditing] = useState(false);

    // Load from the same keys DraggableWaypoint uses
    useEffect(() => {
        if (!activeId) return;
        try {
            setDocs(JSON.parse(localStorage.getItem(`${activeId}:docs`) || '[]'));
        } catch {
            setDocs([]);
        }
        setLocked(localStorage.getItem(`${activeId}:locked`) === '1');
    }, [activeId]);

    useEffect(() => {
        if (!activeId) return;
        localStorage.setItem(`${activeId}:docs`, JSON.stringify(docs));
    }, [docs, activeId]);

    useEffect(() => {
        if (!activeId) return;
        localStorage.setItem(`${activeId}:locked`, locked ? '1' : '0');
    }, [locked, activeId]);

    const inputRef = useRef<HTMLInputElement | null>(null);
    const onAddClick = () => inputRef.current?.click();

    const handleFiles = async (files: FileList | null) => {
        if (!files || !files.length) return;
        const additions: WaypointDoc[] = [];
        for (const file of Array.from(files)) {
            if (file.type !== 'application/pdf') continue;
            const dataUrl = await new Promise<string>((resolve, reject) => {
                const fr = new FileReader();
                fr.onload = () => resolve(fr.result as string);
                fr.onerror = reject;
                fr.readAsDataURL(file);
            });
            additions.push({
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                name: file.name,
                dataUrl,
            });
        }
        setDocs(prev => [...prev, ...additions]);
        // render thumbs
        for (const d of additions) {
            const thumb = await renderPdfFirstPageToDataUrl(d.dataUrl);
            setDocs(prev => prev.map(p => (p.id === d.id ? { ...p, thumb: thumb || p.thumb } : p)));
        }
    };

    const removeDoc = (docId: string) => setDocs(prev => prev.filter(d => d.id !== docId));

    const visible = !!activeId;

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                    style={{ position: 'absolute', left: left ?? 24, top: top ?? 24, maxWidth: 560 }}
                    className="z-20 bg-white/85 backdrop-blur border border-neutral-200 shadow-xl rounded-2xl p-3"
                >
                    <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-fuchsia-500" />
                            <h3 className="text-sm font-semibold">{activeLabel} – Documents</h3>
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
                                {locked ? <Unlock size={14} /> : <Lock size={14} />} {locked ? 'Unlock' : 'Lock'}
                            </button>
                            <button onClick={onClose} className="p-1 rounded-lg hover:bg-neutral-100">
                                <X size={16} />
                            </button>
                        </div>
                    </div>

                    <AnimatePresence initial={false}>
                        {editing && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
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

                    <div className="grid grid-cols-3 gap-3">
                        {docs.length === 0 && (
                            <div className="col-span-3 text-center text-sm text-neutral-500 p-6 border border-dashed rounded-xl">
                                No documents yet. {editing ? 'Click Add PDFs to attach some.' : 'Enter Edit to add PDFs.'}
                            </div>
                        )}

                        {docs.map(doc => (
                            <div key={doc.id} className="relative group rounded-xl border bg-white overflow-hidden">
                                <div className="aspect-[4/3] w-full bg-neutral-50 grid place-items-center overflow-hidden">
                                    {doc.thumb ? (
                                        <img src={doc.thumb} alt={`${doc.name} thumbnail`} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="flex flex-col items-center justify-center text-neutral-400">
                                            <FileText size={36} />
                                            <span className="text-xs mt-1">PDF</span>
                                        </div>
                                    )}
                                </div>
                                <div className="px-2 py-2">
                                    <p className="text-xs font-medium truncate" title={doc.name}>
                                        {doc.name}
                                    </p>
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

                                {!editing && (
                                    <a href={doc.dataUrl} target="_blank" rel="noreferrer" className="absolute inset-0" title="Open PDF" />
                                )}
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
