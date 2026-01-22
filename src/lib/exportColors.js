/**
 * Color constants for PNG export.
 * Modify these values to customize the exported image colors.
 */

export const EXPORT_COLORS = {
  // Battlefield background
  battlefield: {
    fill: '#4a5a4a'  // Green-tinted gray (same as app)
  },

  // Terrain rectangles
  terrain: {
    fill: 'rgba(139, 90, 43, 0.6)',  // Tan/brown, slightly more opaque for export
    stroke: '#8b5a2b',               // Saddle brown
    strokeWidth: 0.15
  },

  // Wall pieces (L-shaped and C-shaped)
  wall: {
    fill: 'rgba(139, 69, 19, 0.9)',  // Dark brown, more opaque for export
    stroke: '#5c3317',               // Very dark brown
    strokeWidth: 0.15
  },

  // Model bases - Player 1
  player1: {
    fill: 'rgba(59, 130, 246, 0.6)',  // Blue with transparency
    stroke: '#3b82f6',                 // Bright blue
    strokeWidth: 0.12
  },

  // Model bases - Player 2
  player2: {
    fill: 'rgba(239, 68, 68, 0.6)',   // Red with transparency
    stroke: '#ef4444',                 // Bright red
    strokeWidth: 0.12
  },

  // Model name labels
  modelName: {
    fill: '#ffffff',        // White text
    stroke: '#000000',      // Black outline for readability
    strokeWidth: 0.05,      // Thicker outline for better readability
    fontWeight: 'bold'
  },

  // Deployment zones (uses zone's own borderColor, these are fallbacks/settings)
  deploymentZone: {
    fillOpacity: 0.1,       // Light fill for zone area
    strokeWidth: 0.2,       // Zone border thickness
    strokeDasharray: '0.5,0.25'  // Dashed border
  },

  // Objectives
  objective: {
    primary: {
      fill: '#fbbf24',      // Amber/gold for primary objective
      stroke: '#000000',
      strokeWidth: 0.08
    },
    secondary: {
      fill: '#9ca3af',      // Gray for secondary objectives
      stroke: '#000000',
      strokeWidth: 0.08
    },
    controlRadius: {
      fillOpacity: 0.15,
      strokeWidth: 0.06,
      strokeDasharray: '0.3,0.15'
    },
    centerDot: {
      fill: '#000000',
      radius: 0.15
    }
  }
};
