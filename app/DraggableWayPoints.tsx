'use client';

import React, { useState } from 'react';
import { motion, PanInfo } from 'framer-motion';
import { useWayPointsSaver, WaypointDoc } from './WayPointsSaver';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min?url';

GlobalWorkerOptions.workerSrc = pdfjsWorker;

async function pdfToThumb(file: File): Promise<string> {
  const data = await file.arrayBuffer();
  const pdf = await getDocument({ data }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 0.2 });
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL();
}

export default function DraggableWayPoints() {
  const [waypoints, setWaypoints] = useWayPointsSaver();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const addWaypoint = () => {
    const id = Date.now().toString();
    setWaypoints(w => [...w, { id, x: 120, y: 120, locked: false, docs: [] }]);
  };

  const handleDragEnd = (id: string, info: PanInfo) => {
    setWaypoints(wps =>
      wps.map(w =>
        w.id === id
          ? { ...w, x: w.x + info.offset.x, y: w.y + info.offset.y }
          : w
      )
    );
  };

  const toggleLock = (id: string) => {
    setWaypoints(wps => wps.map(w => (w.id === id ? { ...w, locked: !w.locked } : w)));
  };

  const removeDoc = (id: string, idx: number) => {
    setWaypoints(wps =>
      wps.map(w =>
        w.id === id ? { ...w, docs: w.docs.filter((_, i) => i !== idx) } : w
      )
    );
  };

  const addDocs = async (id: string, files: FileList | null) => {
    if (!files) return;
    const docs: WaypointDoc[] = [];
    for (const f of Array.from(files)) {
      const url = URL.createObjectURL(f);
      const thumb = await pdfToThumb(f);
      docs.push({ name: f.name, url, thumb });
    }
    setWaypoints(wps =>
      wps.map(w => (w.id === id ? { ...w, docs: [...w.docs, ...docs] } : w))
    );
  };

  return (
    <div
      className="w-screen h-screen overflow-hidden relative"
      style={{
        backgroundImage: 'url(/images/bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
      onClick={() => setActiveId(null)}
    >
      <button
        onClick={e => {
          e.stopPropagation();
          addWaypoint();
        }}
        className="absolute top-3 left-3 z-50 bg-white/80 px-3 py-1 rounded shadow"
      >
        Add Waypoint
      </button>

      {waypoints.map(w => (
        <motion.div
          key={w.id}
          drag={!w.locked}
          dragMomentum={false}
          style={{ x: w.x, y: w.y }}
          className="absolute z-40"
          onDragEnd={(e, info) => handleDragEnd(w.id, info)}
          onClick={e => {
            e.stopPropagation();
            setActiveId(activeId === w.id ? null : w.id);
          }}
        >
          <div className="w-8 h-8 bg-blue-500 rotate-45 shadow-lg cursor-pointer" />
          {activeId === w.id && (
            <div
              className="absolute left-10 top-0 z-50 bg-white/90 p-2 rounded shadow-md w-56"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => setEditingId(editingId === w.id ? null : w.id)}
                  className="px-2 py-1 bg-gray-200 rounded text-xs"
                >
                  {editingId === w.id ? 'Done' : 'Edit'}
                </button>
                <button
                  onClick={() => toggleLock(w.id)}
                  className="px-2 py-1 bg-gray-200 rounded text-xs"
                >
                  {w.locked ? 'Unlock' : 'Lock'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-auto">
                {w.docs.map((d, idx) => (
                  <div key={idx} className="relative">
                    <a href={d.url} target="_blank" rel="noopener noreferrer">
                      {d.thumb ? (
                        <img src={d.thumb} alt={d.name} className="w-full h-auto" />
                      ) : (
                        <div className="w-full h-16 bg-gray-300" />
                      )}
                    </a>
                    {editingId === w.id && (
                      <button
                        onClick={() => removeDoc(w.id, idx)}
                        className="absolute top-0 right-0 bg-red-500 text-white text-xs px-1"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                {editingId === w.id && (
                  <label className="flex items-center justify-center border-2 border-dashed h-16 text-gray-500 cursor-pointer" key="add">
                    +
                    <input
                      type="file"
                      accept="application/pdf"
                      multiple
                      className="hidden"
                      onChange={e => {
                        const input = e.target as HTMLInputElement;
                        addDocs(w.id, input.files);
                        input.value = '';
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}
