'use client';

import React, { useState } from 'react';
import { DraggableWaypoint } from '@/app/DraggableWayPoints';
import DraggableDocumentDock from '@/app/DraggableDocumentDock';

export default function Page() {
    // Which waypoint is active in the dock?
    const [active, setActive] = useState<{ id: string; label: string } | null>(null);

    return (
        <main className="w-screen h-screen relative overflow-hidden bg-[radial-gradient(80%_80%_at_50%_50%,#0ea5e946,transparent),url('https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=2400&auto=format&fit=crop')] bg-cover bg-center">
            {/* Vignette overlay */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_60%,#00000060_100%)]" />

            {/* Waypoints (dockMode enabled) */}
            <DraggableWaypoint
                id="wp-alpha"
                label="Alpha"
                initial={{ x: 120, y: 160 }}
                dockMode
                onOpen={(id, label) => setActive({ id, label: label ?? id })}
            />
            <DraggableWaypoint
                id="wp-bravo"
                label="Bravo"
                initial={{ x: 380, y: 260 }}
                dockMode
                onOpen={(id, label) => setActive({ id, label: label ?? id })}
            />

            {/* External dock tied to the active waypoint */}
            <DraggableDocumentDock
                activeId={active?.id ?? null}
                activeLabel={active?.label ?? ''}
                onClose={() => setActive(null)}
                // Optional: pin dock somewhere else
                // left={24}
                // top={24}
            />

            {/* Hint */}
            <div className="absolute left-4 bottom-4 text-white/90 text-sm max-w-lg">
                Tip: click a rhombus to open its documents. Use Edit → Add PDFs to attach files.
                Everything (position, lock state, docs) autosaves locally per waypoint.
            </div>
        </main>
    );
}
