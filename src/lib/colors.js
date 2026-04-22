/**
 * Centralized color constants for the application.
 * All UI colors should be imported from this file.
 */

export const COLORS = {
  // Player colors
  player1: {
    primary: '#3b82f6',
    fill: 'rgba(59, 130, 246, 0.5)',
    fillLight: 'rgba(59, 130, 246, 0.3)',
    fillLighter: 'rgba(59, 130, 246, 0.15)',
    zone: 'rgba(59, 130, 246, 0.1)',
  },
  player2: {
    primary: '#ef4444',
    fill: 'rgba(239, 68, 68, 0.5)',
    fillLight: 'rgba(239, 68, 68, 0.3)',
    fillLighter: 'rgba(239, 68, 68, 0.15)',
    zone: 'rgba(239, 68, 68, 0.1)',
  },

  // Battlefield
  battlefield: {
    background: 'rgb(76, 86, 76)',
    gridFine: '#2328235f',
    gridCoarse: '#5a6a5a',
    ruler: '#666',
    rulerText: '#888',
    rulerBackground: '#1a1a1a',
  },

  // Terrain
  terrain: {
    fill: 'rgba(139, 90, 43, 0.6)',
    fillSelected: 'rgba(59, 130, 246, 0.6)',
    fillStatic: 'rgba(139, 90, 43, 0.8)',
    fillReadonly: 'rgba(139, 90, 43, 0.2)', // subtle tint in read-only battle/deployment view
    stroke: '#8b5a2b',
  },

  // Walls
  wall: {
    fill: 'rgba(139, 69, 19, 0.8)',
    fillSelected: 'rgba(139, 69, 19, 0.6)',
    stroke: '#5c3317',
  },

  // Objectives
  objective: {
    primary: '#9ca3af',
    primaryControl: 'rgba(156, 163, 175, 0.15)',
    secondary: '#9ca3af',
    secondaryControl: 'rgba(156, 163, 175, 0.15)',
    center: '#000',
  },

  // LOS visualization
  los: {
    visible: '#22c55e',
    blocked: '#ef4444',
    rayVisible: '#00ff0033',
    rayBlocked: '#ff000033',
  },

  // Selection/interaction
  selection: {
    highlight: '#3b82f6',
    highlightDark: '#1d4ed8',
    handle: '#9333ea',
    handleDark: '#7e22ce',
    groupCenter: 'rgba(147, 51, 234, 0.5)', // semi-transparent pivot dot for group rotation
    dragRuler: '#fbbf24',
  },

  // Measurement tool lines
  measurement: {
    line: '#f59e0b',
    labelBg: 'rgba(0,0,0,0.75)',
  },

  // Engagement range indicator (shown while dragging models)
  engagement: {
    zoneFill: 'rgba(239, 68, 68, 0.2)',  // 1" zone ring around enemy models
    glowFill: 'rgba(239, 68, 68, 0.6)', // red glow on the engaged model itself
  },

  // Generic SVG literals
  ui: {
    white: 'white',
    black: '#000',
  },
};

// Helper to get player colors by ID
export function getPlayerColors(playerId) {
  return playerId === 1 ? COLORS.player1 : COLORS.player2;
}

// Helper for range/denial zone colors (fill = fillLighter, stroke = primary)
export function getPlayerZoneColors(playerId) {
  const p = getPlayerColors(playerId);
  return { fill: p.fillLighter, stroke: p.primary };
}
