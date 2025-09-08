'use client';

import { useEffect, useState } from 'react';

export interface WaypointDoc {
  name: string;
  url: string;
  thumb?: string;
}

export interface WaypointData {
  id: string;
  x: number;
  y: number;
  locked: boolean;
  docs: WaypointDoc[];
}

const STORAGE_KEY = 'waypoints-data';

export function useWayPointsSaver() {
  const [waypoints, setWaypoints] = useState<WaypointData[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) as WaypointData[] : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(waypoints));
    } catch {}
  }, [waypoints]);

  return [waypoints, setWaypoints] as const;
}
