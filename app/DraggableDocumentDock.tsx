"use client";

import React, {useEffect, useMemo, useRef, useState} from "react";
import {motion} from "framer-motion";

/**
 * DraggableDocumentDock
 *
 * A draggable, transparent overlay that lists PDF files in a vertical column.
 * Stays above your background map (z-index), supports configurable initial position,
 * and opens PDFs in a new browser tab when clicked.
 *
 * Usage example (see Demo at bottom):
 * <DraggableDocumentDock
 *   title="Classified Documents"
 *   files={[
 *     { name: "doc1.pdf", url: "/pdfs/doc1.pdf" },
 *     { name: "doc2.pdf", url: "/pdfs/doc2.pdf" },
 *   ]}
 *   initial={{ x: 40, y: 60 }}
 *   width={320}
 *   height={380}
 *   rememberPosition
 * />
 *
 * Props:
 * - title?: string — panel title. Default: "Classified Documents"
 * - files: Array<{ name: string; url: string }>
 * - initial?: { x: number; y: number } — starting position in pixels
 * - width?: number — panel width (px). Default 300
 * - height?: number — panel height (px). Default 360
 * - rememberPosition?: boolean — persist last position in localStorage
 * - constrainToViewport?: boolean — keep the dock within window bounds on drag
 */
export function DraggableDocumentDock({
                                          title = "Classified Documents",
                                          files = [],
                                          initial = {x: 24, y: 24},
                                          width = 300,
                                          height = 360,
                                          rememberPosition = true,
                                          constrainToViewport = true,
                                      }: {
    title?: string;
    files: { name: string; url: string }[];
    initial?: { x: number; y: number };
    width?: number;
    height?: number;
    rememberPosition?: boolean;
    constrainToViewport?: boolean;
}) {
    const storageKey = `doc-dock-pos:${title}`;
    const [pos, setPos] = useState<{ x: number, y: number }>(() => {
        if (rememberPosition) {
            try {
                const raw = localStorage.getItem(storageKey);
                if (raw) return JSON.parse(raw);
            } catch {
            }
        }
        return initial;
    });

    useEffect(() => {
        if (!rememberPosition) return;
        try {
            localStorage.setItem(storageKey, JSON.stringify(pos));
        } catch {
        }
    }, [pos, rememberPosition, storageKey]);

    // Keep within viewport on mount/resize if desired
    useEffect(() => {
        if (!constrainToViewport) return;
        const clamp = () => {
            const maxX = Math.max(0, window.innerWidth - width);
            const maxY = Math.max(0, window.innerHeight - height);
            setPos(p => ({x: Math.min(Math.max(0, p.x), maxX), y: Math.min(Math.max(0, p.y), maxY)}));
        };
        clamp();
        window.addEventListener("resize", clamp);
        return () => window.removeEventListener("resize", clamp);
    }, [constrainToViewport, width, height]);

    // Drag constraints: optional containment in viewport using a virtual rect
    const constraintsRef = useRef<HTMLDivElement | null>(null);
    const constraintBox = useMemo(() => ({
        left: 0,
        top: 0,
        right: typeof window !== "undefined" ? window.innerWidth - width : 0,
        bottom: typeof window !== "undefined" ? window.innerHeight - height : 0,
    }), [width, height]);

    return (
        <>
            {/* Invisible container only for framer-motion constraints when desired */}
            {constrainToViewport && (
                <div ref={constraintsRef} className="fixed inset-0 pointer-events-none"/>
            )}

            <motion.div
                className="fixed z-[60] select-none"
                drag
                dragMomentum={false}
                dragElastic={0}
                dragConstraints={constrainToViewport ? constraintBox : undefined}
                onDragEnd={(_, info) => {
                    const {x, y} = info.point;
                    // info.point is absolute page coordinates; translate to top-left for our element
                    setPos({x, y});
                }}
                initial={{x: pos.x, y: pos.y, opacity: 0, scale: 0.98}}
                animate={{x: pos.x, y: pos.y, opacity: 1, scale: 1}}
                transition={{type: "spring", stiffness: 500, damping: 40, mass: 0.8}}
                style={{width, height}}
            >
                {/* Transparent layer; add ring to keep text readable on busy maps */}
                <div className="w-full h-full bg-transparent text-white/90">
                    <div className="flex items-center gap-2 px-3 py-2 cursor-grab active:cursor-grabbing">
                        <div className="h-2.5 w-2.5 rounded-full bg-white/70"/>
                        <h2 className="text-sm font-semibold tracking-wide uppercase drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]">
                            {title}
                        </h2>
                    </div>

                    <div className="px-2 pb-2">
                        <div
                            className="rounded-2xl ring-1 ring-white/25 backdrop-blur-sm bg-white/0 overflow-hidden"
                            style={{height: height - 54}}
                        >
                            <ul className="overflow-auto max-h-full divide-y divide-white/10">
                                {files.length === 0 && (
                                    <li className="p-3 text-xs text-white/70">No documents yet.</li>
                                )}
                                {files.map((f, idx) => (
                                    <li key={idx} className="group">
                                        <a
                                            href={f.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-3 px-3 py-2 hover:bg-white/5 active:bg-white/10 transition"
                                            title={f.name}
                                        >
                      <span className="flex items-center gap-2">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            className="w-4 h-4 opacity-80 drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]"
                            aria-hidden
                        >
                          <path
                              d="M17 8h-1V7a4 4 0 1 0-8 0h2a2 2 0 1 1 4 0v1H7a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2Zm0 11H7v-9h10v9Zm-5-3a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/>
                        </svg>
                        <span className="text-sm truncate drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]">{f.name}</span>
                      </span>
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </motion.div>
        </>
    );
}

/**
 * Optional helper to auto-load PDFs from a directory when using Vite/Next (client-safe).
 * Place PDFs in /public/pdfs and pass the result to DraggableDocumentDock.
 */
export function usePublicPdfList(publicDir = "/pdfs") {
    type FileItem = {
        name: string;
        url: string;
    };

    const [files, setFiles] = useState<FileItem[]>([]);

    useEffect(() => {
        // Without a server index, browsers can't list directories. If you can expose
        // an index.json in the folder, fetch it here. Otherwise, keep using props.
        // This is a placeholder demonstrating the expected shape.
        // setFiles([{ name: "doc1.pdf", url: `${publicDir}/doc1.pdf` }]);
    }, [publicDir]);
    return files;
}

interface DraggableDocumentDockProps {
    title?: string,
    files?: ({ name: string; url: string } | { name: string; url: string })[],
    initial?: { x: number; y: number },
    width?: number,
    height?: number,
    rememberPosition?: boolean,
    constrainToViewport?: boolean
}

/**
 * Demo page to preview in the Canvas. It shows a background map image and the dock over it.
 */
// components/DraggableDocumentDock.tsx
export default function DemoMapWithDock({
                                            title,
                                            files = [],               // <— accept files from parent
                                            initial,
                                            width,
                                            height,
                                            rememberPosition,
                                            constrainToViewport,
                                        }: DraggableDocumentDockProps) {
    return (
        <div className="w-screen h-screen overflow-hidden relative" style={{ /* bg styles... */ }}>
            <div className="absolute inset-0 bg-black/10" />
            <DraggableDocumentDock
                title={title ?? "Classified Documents"}
                files={files}         // <— use the prop
                initial={initial ?? { x: 40, y: 60 }}
                width={width ?? 320}
                height={height ?? 380}
                rememberPosition={rememberPosition ?? true}
                constrainToViewport={constrainToViewport ?? true}
            />
            <div className="absolute bottom-3 left-3 text-white/80 text-xs drop-shadow">
                Drag the header to move the panel. Click a file to open the PDF in a new tab.
            </div>
        </div>
    );
}
