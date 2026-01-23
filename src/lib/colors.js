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
    background: '#738973ff',
    gridFine: '#3a4a3a8c',
    gridCoarse: '#5a6a5a',
    ruler: '#666',
    rulerText: '#888',
    rulerBackground: '#1a1a1a',
  },

  // Terrain
  terrain: {
    fill: 'rgba(139, 90, 43, 0.3)',
    fillSelected: 'rgba(59, 130, 246, 0.3)',
    fillStatic: 'rgba(139, 90, 43, 0.6)',
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
    primary: '#fbbf24',
    primaryControl: 'rgba(251, 191, 36, 0.15)',
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
    dragRuler: '#fbbf24',
  },
};

// Helper to get player colors by ID
export function getPlayerColors(playerId) {
  return playerId === 1 ? COLORS.player1 : COLORS.player2;
}
