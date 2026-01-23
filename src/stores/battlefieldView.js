import { writable } from 'svelte/store';

/**
 * Shared battlefield view state (pan/zoom) that persists across route changes.
 */
export const battlefieldView = writable({
  zoom: 1,
  panX: 0,
  panY: 0
});

/**
 * Reset view to default (zoom 1, centered)
 */
export function resetView() {
  battlefieldView.set({
    zoom: 1,
    panX: 0,
    panY: 0
  });
}
