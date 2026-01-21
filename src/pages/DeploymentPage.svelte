<script>
  import { onMount, onDestroy } from 'svelte';
  import Battlefield from '../lib/Battlefield.svelte';
  import TerrainRect from '../lib/TerrainRect.svelte';
  import WallPiece from '../lib/WallPiece.svelte';
  import ModelBase from '../lib/ModelBase.svelte';
  import ModelPaletteItem from '../lib/ModelPaletteItem.svelte';
  import CollapsibleSection from '../lib/CollapsibleSection.svelte';
  import ArmyImportPanel from '../lib/ArmyImportPanel.svelte';
  import UnmatchedUnitsDialog from '../lib/UnmatchedUnitsDialog.svelte';
  import StagingArea from '../lib/StagingArea.svelte';
  import {
    getWallVertices,
    transformWallVertices
  } from '../stores/layout.js';
  import {
    models,
    player1Models,
    player2Models,
    BASE_SIZES,
    getBaseSize,
    isOvalBase,
    isRectangularBase
  } from '../stores/models.js';
  import { history } from '../stores/history.js';
  import { selectedDeployment, selectedLayoutName, selectedLayoutType, loadedTerrain } from '../stores/battlefieldSetup.js';
  import { pathToSvgD, OBJECTIVE_RADIUS, OBJECTIVE_CONTROL_RADIUS, DEPLOYMENT_PRESETS } from '../stores/deployment.js';
  import { TERRAIN_LAYOUT_PRESETS } from '../stores/layout.js';
  import { checkLineOfSight } from '../lib/visibility/lineOfSight.js';
  import { getRotatedRectVertices } from '../lib/visibility/geometry.js';
  import { armyImports } from '../stores/armyImports.js';
  import { stagingModels, addStagingModels, deployToMain } from '../stores/staging.js';
  import { parseArmyList } from '../lib/services/armyParser.js';
  import { mapParsedUnitsToModels, calculateStagingPositions } from '../lib/services/unitMapper.js';

  // Model palette state
  let currentPlayer = 1;
  let phantomModel = null;
  let isDraggingFromPalette = false;
  let dragStartPos = null;
  let screenToSvgRef = null;
  let losVisualizationEnabled = false;
  let showDebugRays = false;
  let showP1Denial = false;
  let showP2Denial = false;

  // Rectangle hull state
  let rectWidth = 5.5;  // Default width in inches
  let rectHeight = 3.0; // Default height in inches

  // Army import state
  let showUnmatchedDialog = false;
  let unmatchedUnits = [];
  let pendingMatched = [];
  let importPanelRef = null;

  // Marquee selection state
  let isMarqueeSelecting = false;
  let marqueeStart = null;
  let marqueeEnd = null;
  let selectedModelIds = []; // Array of selected model IDs
  let marqueePreviewIds = new Set(); // Models currently in marquee preview
  let justCompletedMarquee = false; // Flag to prevent click handler after marquee

  // Group drag/rotate state
  let isDraggingGroup = false;
  let groupDragStart = null;
  let isRotatingGroup = false;
  let groupRotationCenter = null;

  const DRAG_THRESHOLD = 5; // pixels - movement below this is considered a click
  const DEEP_STRIKE_DENIAL_RADIUS = 9; // 9" radius around each model

  const DEPLOYMENT_SAVE_KEY = 'warhammer-deployment-state';

  function saveDeploymentState() {
    const state = {
      deployment: $selectedDeployment?.name || null,
      layout: $selectedLayoutName || null,
      layoutType: $selectedLayoutType || null,
      models: $models
    };
    localStorage.setItem(DEPLOYMENT_SAVE_KEY, JSON.stringify(state));
  }

  function restoreDeploymentState() {
    const saved = localStorage.getItem(DEPLOYMENT_SAVE_KEY);
    if (saved) {
      try {
        const state = JSON.parse(saved);
        if (state.models && Array.isArray(state.models)) {
          models.set(state.models);
          history.clear(); // Clear history when restoring saved state
        }
      } catch (err) {
        console.error('Failed to restore deployment state:', err);
      }
    }
  }

  function clearDeploymentState() {
    localStorage.removeItem(DEPLOYMENT_SAVE_KEY);
    models.clear();
  }

  // Export state to JSON file
  function exportState() {
    const state = {
      version: 1,
      exportedAt: new Date().toISOString(),
      deployment: $selectedDeployment ? {
        name: $selectedDeployment.name,
        // Include full data in case recipient doesn't have this preset
        zones: $selectedDeployment.zones,
        objectives: $selectedDeployment.objectives
      } : null,
      terrain: {
        layoutName: $selectedLayoutName,
        layoutType: $selectedLayoutType,
        // Include full terrain data so it works even without the preset
        terrains: $loadedTerrain.terrains,
        walls: $loadedTerrain.walls
      },
      models: $models
    };

    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `deployment-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Import state from JSON file
  let fileInputRef = null;

  function triggerImport() {
    fileInputRef?.click();
  }

  function handleFileImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const state = JSON.parse(e.target.result);
        importState(state);
      } catch (err) {
        console.error('Failed to parse import file:', err);
        alert('Failed to import: Invalid JSON file');
      }
    };
    reader.readAsText(file);

    // Reset file input so the same file can be imported again
    event.target.value = '';
  }

  function importState(state) {
    // Validate version
    if (!state.version) {
      alert('Invalid import file: missing version');
      return;
    }

    // Import deployment
    if (state.deployment) {
      // Try to find matching preset first
      const preset = DEPLOYMENT_PRESETS.find(p => p.name === state.deployment.name);
      if (preset) {
        selectedDeployment.set(preset);
      } else if (state.deployment.zones && state.deployment.objectives) {
        // Use the embedded deployment data
        selectedDeployment.set({
          name: state.deployment.name || 'Imported',
          zones: state.deployment.zones,
          objectives: state.deployment.objectives
        });
      }
    } else {
      selectedDeployment.set(null);
    }

    // Import terrain
    if (state.terrain) {
      const { layoutName, layoutType, terrains, walls } = state.terrain;

      // Try to find matching preset first
      if (layoutType === 'preset' && layoutName) {
        const preset = TERRAIN_LAYOUT_PRESETS.find(p => p.name === layoutName);
        if (preset) {
          selectedLayoutName.set(layoutName);
          selectedLayoutType.set('preset');
        } else if (terrains || walls) {
          // Preset not found, use embedded terrain data
          // Store as a temporary custom layout
          const customName = `imported-${Date.now()}`;
          const saved = localStorage.getItem('warhammer-deployment-layouts');
          const layouts = saved ? JSON.parse(saved) : {};
          layouts[customName] = { terrains: terrains || [], walls: walls || [] };
          localStorage.setItem('warhammer-deployment-layouts', JSON.stringify(layouts));
          selectedLayoutName.set(customName);
          selectedLayoutType.set('saved');
        }
      } else if (layoutType === 'saved' && layoutName) {
        // Check if saved layout exists locally
        const saved = localStorage.getItem('warhammer-deployment-layouts');
        const layouts = saved ? JSON.parse(saved) : {};
        if (layouts[layoutName]) {
          selectedLayoutName.set(layoutName);
          selectedLayoutType.set('saved');
        } else if (terrains || walls) {
          // Saved layout not found, import the embedded data
          layouts[layoutName] = { terrains: terrains || [], walls: walls || [] };
          localStorage.setItem('warhammer-deployment-layouts', JSON.stringify(layouts));
          selectedLayoutName.set(layoutName);
          selectedLayoutType.set('saved');
        }
      } else if (terrains || walls) {
        // No layout name, create a new saved layout
        const customName = `imported-${Date.now()}`;
        const saved = localStorage.getItem('warhammer-deployment-layouts');
        const layouts = saved ? JSON.parse(saved) : {};
        layouts[customName] = { terrains: terrains || [], walls: walls || [] };
        localStorage.setItem('warhammer-deployment-layouts', JSON.stringify(layouts));
        selectedLayoutName.set(customName);
        selectedLayoutType.set('saved');
      }
    }

    // Import models
    if (state.models && Array.isArray(state.models)) {
      models.set(state.models);
      history.clear();
    }

    // Clear selection
    selectedModelIds = [];
  }

  // Army import handlers
  async function handleArmyListParse(event) {
    const { text, playerId } = event.detail;

    try {
      if (importPanelRef) {
        importPanelRef.setLoading(true);
      }

      // Parse army list
      const { format, data } = await parseArmyList(text);

      // Map to models
      const { matched, unmatched } = mapParsedUnitsToModels(data, playerId);

      // Save import metadata
      const importName = data.LIST_TITLE || `${data.FACTION_KEYWORD} Army`;
      armyImports.addImport(importName, text, data, playerId);

      // Handle unmatched units
      if (unmatched.length > 0) {
        unmatchedUnits = unmatched;
        pendingMatched = matched;
        showUnmatchedDialog = true;

        if (importPanelRef) {
          importPanelRef.setLoading(false);
        }
      } else {
        // Add all matched models to staging
        addStagingModels(matched, data.FACTION_KEYWORD);

        if (importPanelRef) {
          importPanelRef.setSuccess(
            `Imported ${matched.length} models from ${data.FACTION_KEYWORD} (${format})`
          );
          importPanelRef.clearText();
        }
      }
    } catch (err) {
      console.error('Failed to parse army list:', err);
      if (importPanelRef) {
        importPanelRef.setError(err.message || 'Failed to parse army list');
      }
    }
  }

  function handleUnmatchedImport(event) {
    const { selected } = event.detail;

    // Create models for selected units with user-specified base sizes
    const additionalModels = [];

    for (const selection of selected) {
      const quantity = typeof selection.quantity === 'string'
        ? parseInt(selection.quantity.replace(/x/i, ''), 10) || 1
        : selection.quantity || 1;

      const unitId = 'unit-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

      for (let i = 0; i < quantity; i++) {
        additionalModels.push({
          id: 'model-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
          baseType: selection.baseType,
          playerId: currentPlayer,
          x: 0,
          y: 0,
          rotation: 0,
          unitId,
          unitName: selection.unitName,
          imported: true,
          inStaging: true
        });
      }
    }

    // Combine with pending matched models
    const allModels = [...pendingMatched, ...additionalModels];

    // Recalculate positions
    const modelsWithPositions = calculateStagingPositions(allModels);
    addStagingModels(modelsWithPositions, 'imported');

    if (importPanelRef) {
      importPanelRef.setSuccess(`Imported ${allModels.length} models to staging area`);
      importPanelRef.clearText();
    }

    // Reset state
    unmatchedUnits = [];
    pendingMatched = [];
  }

  function handleDeployFromStaging(event) {
    const { modelIds } = event.detail;
    deployToMain(modelIds, 30, 22);
  }

  function handleClearStaging() {
    // Handled by the StagingArea component
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeyDown);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeyDown);
  });

  function handleKeyDown(event) {
    if (event.target.tagName === 'INPUT') return;

    const hasSelection = selectedModelIds.length > 0;

    // Undo (Ctrl+Z)
    if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
      event.preventDefault();
      models.undo();
      return;
    }

    // Redo (Ctrl+Y or Ctrl+Shift+Z)
    if ((event.ctrlKey || event.metaKey) && (event.key === 'y' || (event.shiftKey && event.key === 'z'))) {
      event.preventDefault();
      models.redo();
      return;
    }

    // Player switch keys (1, 2)
    if (event.key === '1') {
      event.preventDefault();
      currentPlayer = 1;
      return;
    }
    if (event.key === '2') {
      event.preventDefault();
      currentPlayer = 2;
      return;
    }

    // Toggle LoS visualization (L key)
    if (event.key === 'l' || event.key === 'L') {
      event.preventDefault();
      losVisualizationEnabled = !losVisualizationEnabled;
      return;
    }

    // Delete selected models (Delete or Backspace)
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      if (selectedModelIds.length > 0) {
        selectedModelIds.forEach(id => {
          models.remove(id);
        });
        selectedModelIds = [];
      }
      return;
    }

    // Arrow keys - move selected models
    if (hasSelection && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
      const step = event.shiftKey ? 0.1 : 1;
      let dx = 0, dy = 0;

      switch (event.key) {
        case 'ArrowUp': dy = -step; break;
        case 'ArrowDown': dy = step; break;
        case 'ArrowLeft': dx = -step; break;
        case 'ArrowRight': dx = step; break;
      }

      selectedModelIds.forEach(id => {
        const model = $models.find(m => m.id === id);
        if (model) {
          models.updateModel(id, {
            x: model.x + dx,
            y: model.y + dy
          }, false);
        }
      });
      return;
    }

    // Escape - deselect
    if (event.key === 'Escape') {
      handleDeselectAll();
      return;
    }
  }

  function handleDeselectAll(event) {
    // Don't deselect if we just completed a marquee selection
    if (justCompletedMarquee) {
      justCompletedMarquee = false;
      return;
    }

    // Don't deselect if click originated from a model
    if (event?.target?.closest('.model-base')) {
      return;
    }
    
    selectedModelIds = [];
  }

  // Marquee selection handlers
  function handleBattlefieldMouseDown(event) {
    // Only start marquee if clicking on battlefield (not on a model)
    // Check if click is inside a model-base group
    const target = event.target;
    const isModelClick = target.closest('.model-base');

    if (isModelClick) return;
    if (!screenToSvgRef) return;

    // Prevent text selection during drag
    event.preventDefault();

    const svgCoords = screenToSvgRef(event.clientX, event.clientY);
    marqueeStart = { x: svgCoords.x, y: svgCoords.y };
    marqueeEnd = { x: svgCoords.x, y: svgCoords.y };
    isMarqueeSelecting = true;

    window.addEventListener('mousemove', handleMarqueeMove);
    window.addEventListener('mouseup', handleMarqueeEnd);
  }

  function handleMarqueeMove(event) {
    if (!isMarqueeSelecting || !screenToSvgRef) return;
    const svgCoords = screenToSvgRef(event.clientX, event.clientY);
    marqueeEnd = { x: svgCoords.x, y: svgCoords.y };

    // Update preview of models that will be selected
    const minX = Math.min(marqueeStart.x, marqueeEnd.x);
    const maxX = Math.max(marqueeStart.x, marqueeEnd.x);
    const minY = Math.min(marqueeStart.y, marqueeEnd.y);
    const maxY = Math.max(marqueeStart.y, marqueeEnd.y);

    const preview = new Set();
    $models.forEach(model => {
      if (model.x >= minX && model.x <= maxX &&
          model.y >= minY && model.y <= maxY) {
        preview.add(model.id);
      }
    });
    marqueePreviewIds = preview;
  }

  function handleMarqueeEnd(event) {
    if (!isMarqueeSelecting) return;

    // Calculate marquee bounds
    const minX = Math.min(marqueeStart.x, marqueeEnd.x);
    const maxX = Math.max(marqueeStart.x, marqueeEnd.x);
    const minY = Math.min(marqueeStart.y, marqueeEnd.y);
    const maxY = Math.max(marqueeStart.y, marqueeEnd.y);

    // Check if this was just a click (no significant drag)
    const width = maxX - minX;
    const height = maxY - minY;
    if (width < 0.5 && height < 0.5) {
      // Just a click - deselect all
      selectedModelIds = [];
    } else {
      // Actual marquee selection - select all models inside
      const newSelection = [];
      $models.forEach(model => {
        if (model.x >= minX && model.x <= maxX &&
            model.y >= minY && model.y <= maxY) {
          newSelection.push(model.id);
        }
      });
      selectedModelIds = newSelection;
      // Mark that we just completed a marquee to prevent click handler
      justCompletedMarquee = true;
    }

    isMarqueeSelecting = false;
    marqueeStart = null;
    marqueeEnd = null;
    marqueePreviewIds.clear();
    marqueePreviewIds = marqueePreviewIds; // Trigger reactivity
    window.removeEventListener('mousemove', handleMarqueeMove);
    window.removeEventListener('mouseup', handleMarqueeEnd);
  }

  // Model handlers
  function handlePaletteDragStart(baseSize, event) {
    if (!screenToSvgRef) return;

    isDraggingFromPalette = true;
    dragStartPos = { x: event.clientX, y: event.clientY };

    const svgCoords = screenToSvgRef(event.clientX, event.clientY);
    phantomModel = {
      baseType: baseSize.type,
      x: svgCoords.x,
      y: svgCoords.y
    };

    window.addEventListener('mousemove', handlePaletteDragMove);
    window.addEventListener('mouseup', handlePaletteDrop);
  }

  function handlePaletteDragMove(event) {
    if (!isDraggingFromPalette || !phantomModel || !screenToSvgRef) return;
    const svgCoords = screenToSvgRef(event.clientX, event.clientY);
    phantomModel = {
      ...phantomModel,
      x: svgCoords.x,
      y: svgCoords.y
    };
  }

  function handlePaletteDrop(event) {
    if (!isDraggingFromPalette || !phantomModel) {
      isDraggingFromPalette = false;
      phantomModel = null;
      dragStartPos = null;
      window.removeEventListener('mousemove', handlePaletteDragMove);
      window.removeEventListener('mouseup', handlePaletteDrop);
      return;
    }

    // Check if this was a click (no significant movement) or a drag
    const dx = event.clientX - dragStartPos.x;
    const dy = event.clientY - dragStartPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    let x, y;
    if (distance < DRAG_THRESHOLD) {
      // Just a click - place at default position (battlefield center)
      x = 30;
      y = 22;
    } else {
      // Actual drag - use phantom model position
      x = phantomModel.x;
      y = phantomModel.y;
    }

    // Add custom size for rectangles
    const customSize = phantomModel.customWidth && phantomModel.customHeight
      ? { width: phantomModel.customWidth, height: phantomModel.customHeight }
      : null;

    const id = models.add(phantomModel.baseType, currentPlayer, x, y, customSize);
    selectedModelIds = [id];

    phantomModel = null;
    isDraggingFromPalette = false;
    dragStartPos = null;
    window.removeEventListener('mousemove', handlePaletteDragMove);
    window.removeEventListener('mouseup', handlePaletteDrop);
  }

  // Add rectangular hull
  function handleAddRectHull() {
    const x = 30;
    const y = 22;
    const customSize = { width: rectWidth, height: rectHeight };
    const id = models.add('rect-custom', currentPlayer, x, y, customSize);
    selectedModelIds = [id];
  }

  function handleSelectModel(id, event) {
    // Support Ctrl/Cmd/Shift for multi-select
    if (event && (event.ctrlKey || event.metaKey || event.shiftKey)) {
      if (selectedModelIds.includes(id)) {
        selectedModelIds = selectedModelIds.filter(x => x !== id);
      } else {
        selectedModelIds = [...selectedModelIds, id];
      }
    } else if (selectedModelIds.includes(id) && selectedModelIds.length > 1) {
      // Clicking on a model that's already in a multi-selection - keep the selection
      // This allows group dragging to work
    } else {
      // Single selection
      selectedModelIds = [id];
    }
  }

  function handleDragModel(id, x, y) {
    // Check if this is part of a multi-selection
    if (selectedModelIds.length > 1 && selectedModelIds.includes(id)) {
      // Group drag - move all selected models together
      if (!isDraggingGroup) {
        // First drag event - record starting positions
        isDraggingGroup = true;
        groupDragStart = {};
        selectedModelIds.forEach(modelId => {
          const model = $models.find(m => m.id === modelId);
          if (model) {
            groupDragStart[modelId] = { x: model.x, y: model.y };
          }
        });
      }

      // Calculate offset from original position
      const originalPos = groupDragStart[id];
      if (originalPos) {
        const dx = x - originalPos.x;
        const dy = y - originalPos.y;

        // Apply offset to all selected models
        selectedModelIds.forEach(modelId => {
          const startPos = groupDragStart[modelId];
          if (startPos) {
            models.updateModel(modelId, {
              x: startPos.x + dx,
              y: startPos.y + dy
            }, true);
          }
        });
      }
    } else {
      // Single model drag
      models.updateModel(id, { x, y }, true);
    }
  }

  function handleDragModelEnd(id, startX, startY, endX, endY) {
    if (isDraggingGroup) {
      // Save group move to history
      selectedModelIds.forEach(modelId => {
        const startPos = groupDragStart[modelId];
        const model = $models.find(m => m.id === modelId);
        if (startPos && model) {
          history.push({
            type: 'move',
            modelId: modelId,
            before: { x: startPos.x, y: startPos.y },
            after: { x: model.x, y: model.y }
          });
        }
      });
      isDraggingGroup = false;
      groupDragStart = null;
    } else {
      // Save single move to history
      history.push({
        type: 'move',
        modelId: id,
        before: { x: startX, y: startY },
        after: { x: endX, y: endY }
      });
    }
  }

  function handleRotateModel(id, rotation) {
    // Check if this is part of a multi-selection
    if (selectedModelIds.length > 1 && selectedModelIds.includes(id)) {
      // Group rotation - rotate all selected models around their center
      if (!isRotatingGroup) {
        // First rotation event - calculate center and record starting states
        isRotatingGroup = true;

        // Calculate center of all selected models
        let sumX = 0, sumY = 0, count = 0;
        const startStates = {};
        selectedModelIds.forEach(modelId => {
          const model = $models.find(m => m.id === modelId);
          if (model) {
            sumX += model.x;
            sumY += model.y;
            count++;
            startStates[modelId] = {
              x: model.x,
              y: model.y,
              rotation: model.rotation || 0
            };
          }
        });

        groupRotationCenter = { x: sumX / count, y: sumY / count };
        groupDragStart = startStates; // Reuse for rotation tracking
      }

      // Calculate rotation delta from the rotating model
      const rotatingModel = $models.find(m => m.id === id);
      const startState = groupDragStart[id];
      if (!rotatingModel || !startState) return;

      const rotationDelta = rotation - startState.rotation;

      // Apply rotation to all selected models around the center
      selectedModelIds.forEach(modelId => {
        const startPos = groupDragStart[modelId];
        if (startPos) {
          // Rotate position around center
          const relX = startPos.x - groupRotationCenter.x;
          const relY = startPos.y - groupRotationCenter.y;
          const angleRad = (rotationDelta * Math.PI) / 180;
          const cosAngle = Math.cos(angleRad);
          const sinAngle = Math.sin(angleRad);
          const newRelX = relX * cosAngle - relY * sinAngle;
          const newRelY = relX * sinAngle + relY * cosAngle;

          models.updateModel(modelId, {
            x: groupRotationCenter.x + newRelX,
            y: groupRotationCenter.y + newRelY,
            rotation: startPos.rotation + rotationDelta
          }, true);
        }
      });
    } else {
      // Single model rotation
      models.updateModel(id, { rotation }, true);
    }
  }

  function handleRotateModelEnd(id, startRotation, endRotation) {
    if (isRotatingGroup) {
      // Save group rotation to history
      selectedModelIds.forEach(modelId => {
        const startState = groupDragStart[modelId];
        const model = $models.find(m => m.id === modelId);
        if (startState && model) {
          history.push({
            type: 'rotate',
            modelId: modelId,
            before: {
              x: startState.x,
              y: startState.y,
              rotation: startState.rotation
            },
            after: {
              x: model.x,
              y: model.y,
              rotation: model.rotation || 0
            }
          });
        }
      });
      isRotatingGroup = false;
      groupRotationCenter = null;
      groupDragStart = null;
    } else {
      // Save single rotation to history
      history.push({
        type: 'rotate',
        modelId: id,
        before: { rotation: startRotation },
        after: { rotation: endRotation }
      });
    }
  }

  function handleRenameModel(id, newName) {
    models.updateModel(id, { name: newName });
  }

  function handleRemoveSelected() {
    if (selectedModelIds.length > 0) {
      selectedModelIds.forEach(id => {
        models.remove(id);
      });
      selectedModelIds = [];
    }
  }

  function handleClearAll() {
    if (confirm('Clear all models?')) {
      models.clear();
      selectedModelIds = [];
    }
  }

  // Convert model to LoS format
  function modelToLosFormat(model) {
    if (isRectangularBase(model.baseType)) {
      // For rectangles, return as a rotated rectangle
      return {
        x: model.x,
        y: model.y,
        width: model.customWidth,
        height: model.customHeight,
        rotation: model.rotation || 0,
        isRectangle: true
      };
    }

    const baseSize = getBaseSize(model.baseType, model);
    if (isOvalBase(model.baseType)) {
      return {
        x: model.x,
        y: model.y,
        rx: baseSize.width / 2,
        ry: baseSize.height / 2,
        rotation: model.rotation || 0
      };
    } else {
      return {
        x: model.x,
        y: model.y,
        radius: baseSize.radius
      };
    }
  }

  // Reactive calculations for LoS
  // selectedModels is the array of all selected model objects
  $: selectedModels = selectedModelIds
    .map(id => $models.find(m => m.id === id))
    .filter(Boolean);
  // selectedModel is only set for single selection (for info panel)
  $: selectedModel = selectedModels.length === 1 ? selectedModels[0] : null;
  // Get enemy models based on selected models' player IDs
  $: selectedPlayerIds = [...new Set(selectedModels.map(m => m.playerId))];
  $: enemyModels = selectedModels.length > 0
    ? $models.filter(m => !selectedPlayerIds.includes(m.playerId))
    : [];
  $: allTerrainPolygons = $loadedTerrain.terrains.map(t => ({
    id: t.id,
    vertices: getRotatedRectVertices(t)
  }));
  $: allWallPolygons = $loadedTerrain.walls.map(wall =>
    transformWallVertices(getWallVertices(wall.shape), wall.x, wall.y, wall.rotation)
  );
  // Calculate LOS from each selected model to each enemy
  $: losResults = selectedModels.length > 0 && losVisualizationEnabled && enemyModels.length > 0
    ? selectedModels.flatMap(source =>
        enemyModels.map(enemy => {
          const result = checkLineOfSight(
            modelToLosFormat(source),
            modelToLosFormat(enemy),
            allTerrainPolygons,
            allWallPolygons
          );
          return {
            sourceId: source.id,
            source: source,
            targetId: enemy.id,
            target: enemy,
            canSee: result.canSee,
            firstClearRay: result.firstClearRay,
            rays: result.rays
          };
        })
      )
    : [];
</script>

<main>
  <div class="header">
    <h1>Deployment Practice</h1>
    <nav class="nav-links">
      <a href="#/setup">Battlefield Setup</a>
      <a href="#/deployment" class="active">Deployment</a>
      <a href="#/">Layout Builder</a>
      <a href="#/debug">Debug Mode</a>
    </nav>
  </div>

  <div class="layout">
    <div class="sidebar">
      <!-- Selected Model Section -->
      <CollapsibleSection title="Selected Model">
        {#if selectedModelIds.length > 1}
          <div class="edit-form">
            <div class="field">
              <span class="label-text">Selected</span>
              <span class="value">{selectedModelIds.length} models</span>
            </div>
            <div class="field">
              <label class="checkbox-label">
                <input type="checkbox" bind:checked={losVisualizationEnabled} />
                Show Line of Sight
              </label>
            </div>
            {#if losVisualizationEnabled}
              <div class="field">
                <label class="checkbox-label">
                  <input type="checkbox" bind:checked={showDebugRays} />
                  Show Debug Rays
                </label>
              </div>
              {#if losResults.length > 0}
                <div class="field">
                  <span class="label-text">LoS Status</span>
                  <span class="value">{losResults.filter(r => r.canSee).length}/{losResults.length} rays visible</span>
                </div>
              {/if}
            {/if}
            <button class="danger" on:click={handleRemoveSelected}>
              Remove All ({selectedModelIds.length})
            </button>
          </div>
        {:else if selectedModel}
          <div class="edit-form">
            <div class="field">
              <label for="model-name">Name</label>
              <input
                id="model-name"
                type="text"
                value={selectedModel.name || ''}
                on:change={(e) => handleRenameModel(selectedModel.id, e.target.value)}
              />
            </div>
            <div class="field">
              <span class="label-text">Base Type</span>
              <span class="value">{getBaseSize(selectedModel.baseType, selectedModel)?.label || 'Unknown'}</span>
            </div>
            <div class="field">
              <span class="label-text">Player</span>
              <span class="value">Player {selectedModel.playerId}</span>
            </div>
            <div class="field">
              <span class="label-text">Position</span>
              <span class="value">{selectedModel.x.toFixed(1)}", {selectedModel.y.toFixed(1)}"</span>
            </div>
            {#if isOvalBase(selectedModel.baseType)}
              <div class="field">
                <span class="label-text">Rotation</span>
                <span class="value">{Math.round(selectedModel.rotation || 0)}°</span>
              </div>
            {/if}
            <div class="field">
              <label class="checkbox-label">
                <input type="checkbox" bind:checked={losVisualizationEnabled} />
                Show Line of Sight
              </label>
            </div>
            {#if losVisualizationEnabled}
              <div class="field">
                <label class="checkbox-label">
                  <input type="checkbox" bind:checked={showDebugRays} />
                  Show Debug Rays
                </label>
              </div>
            {/if}
            {#if losVisualizationEnabled && losResults.length > 0}
              <div class="field">
                <span class="label-text">LoS Status</span>
                <span class="value">{losResults.filter(r => r.canSee).length}/{losResults.length} visible</span>
              </div>
            {/if}
            <button class="danger" on:click={handleRemoveSelected}>
              Remove
            </button>
          </div>
        {:else}
          <p class="hint">Click a model to select it</p>
        {/if}
      </CollapsibleSection>

            <!-- Army Import -->
      <CollapsibleSection title="Import Army List" startOpen={false}>
        <ArmyImportPanel
          bind:this={importPanelRef}
          {currentPlayer}
          on:parse={handleArmyListParse}
        />
      </CollapsibleSection>

      <!-- Actions -->
      <CollapsibleSection title="Actions">
        <div class="button-group vertical">
          <div class="button-row">
            <button
              on:click={() => models.undo()}
              disabled={!$history.past.length}
              title="Undo (Ctrl+Z)"
            >
              Undo
            </button>
            <button
              on:click={() => models.redo()}
              disabled={!$history.future.length}
              title="Redo (Ctrl+Y)"
            >
              Redo
            </button>
          </div>
          <div class="button-row">
            <button on:click={exportState} title="Export deployment to share with others">
              Export
            </button>
            <button on:click={triggerImport} title="Import deployment from JSON file">
              Import
            </button>
          </div>
          <input
            type="file"
            accept=".json"
            bind:this={fileInputRef}
            on:change={handleFileImport}
            style="display: none;"
          />
          <button on:click={saveDeploymentState}>Save to Browser</button>
          <button on:click={restoreDeploymentState}>Restore from Browser</button>
          <button class="secondary" on:click={handleClearAll}>Clear All Models</button>
          <button class="secondary" on:click={clearDeploymentState}>Clear Saved State</button>
        </div>
      </CollapsibleSection>

      <!-- Add Models Section -->
      <CollapsibleSection title="Add Models">
        <div class="player-toggle">
          <button
            class="toggle-btn"
            class:active={currentPlayer === 1}
            on:click={() => currentPlayer = 1}
          >
            Player 1
          </button>
          <button
            class="toggle-btn"
            class:active={currentPlayer === 2}
            on:click={() => currentPlayer = 2}
          >
            Player 2
          </button>
        </div>
        <div class="base-palette">
          <div class="palette-section">
            <h4>Circles</h4>
            <div class="palette-grid">
              {#each BASE_SIZES.circles as base}
                <ModelPaletteItem
                  baseSize={base}
                  playerId={currentPlayer}
                  onDragStart={handlePaletteDragStart}
                />
              {/each}
            </div>
          </div>
          <div class="palette-section">
            <h4>Ovals</h4>
            <div class="palette-grid">
              {#each BASE_SIZES.ovals as base}
                <ModelPaletteItem
                  baseSize={base}
                  playerId={currentPlayer}
                  onDragStart={handlePaletteDragStart}
                />
              {/each}
            </div>
          </div>
        </div>
      </CollapsibleSection>

      <!-- Add Rectangular Hull Section -->
      <CollapsibleSection title="Add Hull (Vehicle)">
        <div class="rect-hull-form">
          <div class="field">
            <label for="rect-width">Width (inches)</label>
            <input
              id="rect-width"
              type="number"
              bind:value={rectWidth}
              min="1"
              max="20"
              step="0.5"
            />
          </div>
          <div class="field">
            <label for="rect-height">Height (inches)</label>
            <input
              id="rect-height"
              type="number"
              bind:value={rectHeight}
              min="1"
              max="20"
              step="0.5"
            />
          </div>
          <button on:click={handleAddRectHull}>
            Add {rectWidth}" × {rectHeight}" Hull
          </button>
        </div>
      </CollapsibleSection>

      <!-- Visualization Options
      <CollapsibleSection title="Visualization">
        <div class="visualization-options">
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={showP1Denial} />
            P1 Denial Zones (9")
          </label>
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={showP2Denial} />
            P2 Denial Zones (9")
          </label>
        </div>
      </CollapsibleSection> -->


    </div>

    <div class="main-content">
      <div class="battlefield-area">
        <div class="battlefield-container" on:mousedown={handleBattlefieldMouseDown} role="presentation">
        <Battlefield let:screenToSvg>
          {#if screenToSvg && !screenToSvgRef}
            {screenToSvgRef = screenToSvg, ''}
          {/if}

          <!-- Deployment zones -->
          {#if $selectedDeployment}
            {#each $selectedDeployment.zones as zone}
              <path
                d={pathToSvgD(zone.path)}
                fill={zone.color}
                stroke={zone.borderColor}
                stroke-width="0.10"
                stroke-dasharray="0.5,0.25"
                pointer-events="none"
              />
            {/each}

            <!-- Objectives -->
            {#each $selectedDeployment.objectives as obj}
              {@const markerColor = obj.isPrimary ? '#fbbf24' : '#9ca3af'}
              {@const controlColor = obj.isPrimary ? 'rgba(251, 191, 36, 0.15)' : 'rgba(156, 163, 175, 0.15)'}
              <circle
                cx={obj.x}
                cy={obj.y}
                r={OBJECTIVE_CONTROL_RADIUS}
                fill={controlColor}
                stroke={markerColor}
                stroke-width="0.05"
                stroke-dasharray="0.3,0.15"
                pointer-events="none"
              />
              <circle
                cx={obj.x}
                cy={obj.y}
                r={OBJECTIVE_RADIUS}
                fill={markerColor}
                stroke="#000"
                stroke-width="0.06"
                pointer-events="none"
              />
              <circle
                cx={obj.x}
                cy={obj.y}
                r="0.15"
                fill="#000"
                pointer-events="none"
              />
            {/each}
          {/if}

          <!-- Deep Strike Denial Zones -->
          {#if showP1Denial}
            {#each $player1Models as model (model.id)}
              {@const baseSize = getBaseSize(model.baseType, model)}
              {@const isOval = isOvalBase(model.baseType)}
              {@const isRect = isRectangularBase(model.baseType)}
              {#if isRect}
                <g transform="rotate({model.rotation || 0}, {model.x}, {model.y})">
                  <rect
                    x={model.x - (model.customWidth / 2 + DEEP_STRIKE_DENIAL_RADIUS)}
                    y={model.y - (model.customHeight / 2 + DEEP_STRIKE_DENIAL_RADIUS)}
                    width={model.customWidth + 2 * DEEP_STRIKE_DENIAL_RADIUS}
                    height={model.customHeight + 2 * DEEP_STRIKE_DENIAL_RADIUS}
                    fill="rgba(59, 130, 246, 0.1)"
                    stroke="rgba(59, 130, 246, 0.3)"
                    stroke-width="0.1"
                    stroke-dasharray="0.5,0.3"
                    pointer-events="none"
                  />
                </g>
              {:else if isOval}
                <g transform="rotate({model.rotation || 0}, {model.x}, {model.y})">
                  <ellipse
                    cx={model.x}
                    cy={model.y}
                    rx={baseSize.width / 2 + DEEP_STRIKE_DENIAL_RADIUS}
                    ry={baseSize.height / 2 + DEEP_STRIKE_DENIAL_RADIUS}
                    fill="rgba(59, 130, 246, 0.1)"
                    stroke="rgba(59, 130, 246, 0.3)"
                    stroke-width="0.1"
                    stroke-dasharray="0.5,0.3"
                    pointer-events="none"
                  />
                </g>
              {:else}
                <circle
                  cx={model.x}
                  cy={model.y}
                  r={baseSize.radius + DEEP_STRIKE_DENIAL_RADIUS}
                  fill="rgba(59, 130, 246, 0.1)"
                  stroke="rgba(59, 130, 246, 0.3)"
                  stroke-width="0.1"
                  stroke-dasharray="0.5,0.3"
                  pointer-events="none"
                />
              {/if}
            {/each}
          {/if}
          {#if showP2Denial}
            {#each $player2Models as model (model.id)}
              {@const baseSize = getBaseSize(model.baseType, model)}
              {@const isOval = isOvalBase(model.baseType)}
              {@const isRect = isRectangularBase(model.baseType)}
              {#if isRect}
                <g transform="rotate({model.rotation || 0}, {model.x}, {model.y})">
                  <rect
                    x={model.x - (model.customWidth / 2 + DEEP_STRIKE_DENIAL_RADIUS)}
                    y={model.y - (model.customHeight / 2 + DEEP_STRIKE_DENIAL_RADIUS)}
                    width={model.customWidth + 2 * DEEP_STRIKE_DENIAL_RADIUS}
                    height={model.customHeight + 2 * DEEP_STRIKE_DENIAL_RADIUS}
                    fill="rgba(239, 68, 68, 0.1)"
                    stroke="rgba(239, 68, 68, 0.3)"
                    stroke-width="0.1"
                    stroke-dasharray="0.5,0.3"
                    pointer-events="none"
                  />
                </g>
              {:else if isOval}
                <g transform="rotate({model.rotation || 0}, {model.x}, {model.y})">
                  <ellipse
                    cx={model.x}
                    cy={model.y}
                    rx={baseSize.width / 2 + DEEP_STRIKE_DENIAL_RADIUS}
                    ry={baseSize.height / 2 + DEEP_STRIKE_DENIAL_RADIUS}
                    fill="rgba(239, 68, 68, 0.1)"
                    stroke="rgba(239, 68, 68, 0.3)"
                    stroke-width="0.1"
                    stroke-dasharray="0.5,0.3"
                    pointer-events="none"
                  />
                </g>
              {:else}
                <circle
                  cx={model.x}
                  cy={model.y}
                  r={baseSize.radius + DEEP_STRIKE_DENIAL_RADIUS}
                  fill="rgba(239, 68, 68, 0.1)"
                  stroke="rgba(239, 68, 68, 0.3)"
                  stroke-width="0.1"
                  stroke-dasharray="0.5,0.3"
                  pointer-events="none"
                />
              {/if}
            {/each}
          {/if}

          <!-- Render terrain (read-only) -->
          {#each $loadedTerrain.terrains as terrain, idx (idx)}
            <g transform="rotate({terrain.rotation}, {terrain.x + terrain.width/2}, {terrain.y + terrain.height/2})">
              <rect
                x={terrain.x}
                y={terrain.y}
                width={terrain.width}
                height={terrain.height}
                fill="rgba(139, 90, 43, 0.2)"
                stroke="#8b5a2b"
                stroke-width="0.1"
                pointer-events="none"
              />
            </g>
          {/each}

          <!-- Render walls (read-only) -->
          {#each $loadedTerrain.walls as wall, idx (idx)}
            <g opacity="0.5" pointer-events="none">
              <WallPiece
                id={wall.id}
                x={wall.x}
                y={wall.y}
                shape={wall.shape}
                rotation={wall.rotation}
                selected={false}
                {screenToSvg}
                onSelect={() => {}}
                onDrag={() => {}}
                onRotate={() => {}}
              />
            </g>
          {/each}

          <!-- Render models -->
          {#each $models as model (model.id)}
            <ModelBase
              id={model.id}
              x={model.x}
              y={model.y}
              baseType={model.baseType}
              playerId={model.playerId}
              rotation={model.rotation}
              name={model.name || ''}
              customWidth={model.customWidth}
              customHeight={model.customHeight}
              selected={selectedModelIds.includes(model.id)}
              marqueePreview={!selectedModelIds.includes(model.id) && marqueePreviewIds.has(model.id)}
              {screenToSvg}
              onSelect={handleSelectModel}
              onDrag={handleDragModel}
              onDragEnd={handleDragModelEnd}
              onRotate={handleRotateModel}
              onRotateEnd={handleRotateModelEnd}
              onRename={handleRenameModel}
            />
          {/each}

          <!-- Phantom model during drag -->
          {#if phantomModel}
            <ModelBase
              id="phantom"
              x={phantomModel.x}
              y={phantomModel.y}
              baseType={phantomModel.baseType}
              playerId={currentPlayer}
              rotation={0}
              customWidth={phantomModel.customWidth}
              customHeight={phantomModel.customHeight}
              selected={false}
              {screenToSvg}
              onSelect={() => {}}
              onDrag={() => {}}
              onRotate={() => {}}
            />
          {/if}

          <!-- Debug rays (render behind LoS lines) -->
          {#if showDebugRays && losVisualizationEnabled && selectedModels.length > 0 && losResults.length > 0}
            {#each losResults as result}
              {#each result.rays as ray}
                <line
                  x1={ray.from.x}
                  y1={ray.from.y}
                  x2={ray.to.x}
                  y2={ray.to.y}
                  stroke={ray.blocked ? '#ff000033' : '#00ff0033'}
                  stroke-width="0.05"
                  pointer-events="none"
                />
              {/each}
            {/each}
          {/if}

          <!-- LoS Visualization -->
          {#if losVisualizationEnabled && selectedModels.length > 0 && losResults.length > 0}
            {#each losResults as result}
              {#if result.firstClearRay}
                <!-- Show the actual clear ray of sight -->
                <line
                  x1={result.firstClearRay.from.x}
                  y1={result.firstClearRay.from.y}
                  x2={result.firstClearRay.to.x}
                  y2={result.firstClearRay.to.y}
                  stroke="#22c55e"
                  stroke-width="0.15"
                  opacity="0.7"
                  pointer-events="none"
                />
              {:else}
                <!-- Show blocked line from center to center -->
                <line
                  x1={result.source.x}
                  y1={result.source.y}
                  x2={result.target.x}
                  y2={result.target.y}
                  stroke="#ef4444"
                  stroke-width="0.1"
                  stroke-dasharray="0.5 0.25"
                  opacity="0.7"
                  pointer-events="none"
                />
              {/if}
            {/each}
          {/if}

          <!-- Marquee selection rectangle -->
          {#if isMarqueeSelecting && marqueeStart && marqueeEnd}
            {@const minX = Math.min(marqueeStart.x, marqueeEnd.x)}
            {@const minY = Math.min(marqueeStart.y, marqueeEnd.y)}
            {@const width = Math.abs(marqueeEnd.x - marqueeStart.x)}
            {@const height = Math.abs(marqueeEnd.y - marqueeStart.y)}
            <rect
              x={minX}
              y={minY}
              width={width}
              height={height}
              fill="rgba(59, 130, 246, 0.1)"
              stroke="#3b82f6"
              stroke-width="0.1"
              stroke-dasharray="0.3 0.2"
              pointer-events="none"
            />
          {/if}
        </Battlefield>
      </div>
        <div class="info">
          <p>Battlefield: 60" x 44" | {$player1Models.length} P1 models | {$player2Models.length} P2 models</p>
          <p class="hint">Drag to select multiple | Ctrl+Click for multi-select | Delete to remove | 1/2 to switch player | L for LoS</p>
        </div>
      </div>

      <!-- Staging Area -->
      {#if $stagingModels.length > 0}
        <div class="staging-wrapper">
          <StagingArea
            on:deploy={handleDeployFromStaging}
            on:clear={handleClearStaging}
          />
        </div>
      {/if}
    </div>
  </div>
</main>

<!-- Unmatched Units Dialog -->
<UnmatchedUnitsDialog
  bind:show={showUnmatchedDialog}
  {unmatchedUnits}
  on:import={handleUnmatchedImport}
  on:close={() => { showUnmatchedDialog = false; }}
/>

<style>
  main {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    padding: 1rem;
    box-sizing: border-box;
  }

  .header {
    display: flex;
    align-items: center;
    gap: 2rem;
    margin-bottom: 1rem;
  }

  h1 {
    margin: 0;
    font-size: 1.5rem;
    color: #e0e0e0;
  }

  .nav-links {
    display: flex;
    gap: 1.5rem;
  }

  .nav-links a {
    color: #888;
    text-decoration: none;
    font-size: 0.875rem;
  }

  .nav-links a:hover {
    color: #aaa;
    text-decoration: underline;
  }

  .nav-links a.active {
    color: #3b82f6;
    font-weight: 600;
  }

  .layout {
    display: flex;
    gap: 1.5rem;
    flex: 1;
  }

  .sidebar {
    width: 200px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }


  .button-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .button-group.vertical {
    flex-direction: column;
  }

  .button-row {
    display: flex;
    gap: 0.5rem;
  }

  .button-row button {
    flex: 1;
  }

  button {
    padding: 0.5rem 0.75rem;
    border: 1px solid #444;
    border-radius: 4px;
    background: #333;
    color: #fff;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.15s;
  }

  button:hover:not(:disabled) {
    background: #444;
    border-color: #555;
  }

  button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  button.danger {
    background: #7f1d1d;
    border-color: #991b1b;
  }

  button.danger:hover {
    background: #991b1b;
  }

  button.secondary {
    background: transparent;
    border-color: #555;
    color: #888;
  }

  button.secondary:hover:not(:disabled) {
    color: #fff;
    border-color: #666;
  }

  .edit-form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .field .label-text {
    font-size: 0.75rem;
    color: #888;
  }

  .field .value {
    color: #ccc;
    font-size: 0.875rem;
  }

  .hint {
    color: #666;
    font-size: 0.8rem;
    font-style: italic;
    margin: 0;
  }

  .main-content {
    flex: 1;
    display: flex;
    gap: 1rem;
    min-width: 0;
  }

  .battlefield-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .staging-wrapper {
    width: 350px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
  }

  .battlefield-container {
    flex: 1;
    border: 2px solid #444;
    border-radius: 4px;
    overflow: hidden;
    aspect-ratio: 64 / 48;
    max-height: calc(100vh - 160px);
  }

  .info {
    margin-top: 0.75rem;
    color: #888;
    font-size: 0.875rem;
    text-align: center;
  }

  .info p {
    margin: 0;
  }

  .info .hint {
    margin-top: 0.25rem;
    font-size: 0.75rem;
    color: #666;
    font-style: italic;
  }

  /* Models section styles */
  .player-toggle {
    display: flex;
    gap: 0.25rem;
    margin-bottom: 0.75rem;
    background: #1a1a1a;
    border-radius: 4px;
    padding: 0.25rem;
  }

  .toggle-btn {
    flex: 1;
    padding: 0.375rem;
    font-size: 0.75rem;
    background: transparent;
    border: none;
    color: #888;
    transition: all 0.15s;
  }

  .toggle-btn.active {
    background: #3b82f6;
    color: #fff;
  }

  .toggle-btn.active:nth-child(2) {
    background: #ef4444;
  }

  .base-palette {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .palette-section h4 {
    margin: 0 0 0.5rem 0;
    font-size: 0.75rem;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .palette-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #ccc;
    font-size: 0.875rem;
    cursor: pointer;
  }

  .checkbox-label input[type="checkbox"] {
    cursor: pointer;
  }

  .visualization-options {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .rect-hull-form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .rect-hull-form input[type="number"] {
    width: 100%;
    padding: 0.375rem;
    background: #1a1a1a;
    border: 1px solid #444;
    border-radius: 4px;
    color: #fff;
    font-size: 0.875rem;
  }

  .rect-hull-form input[type="number"]:focus {
    outline: none;
    border-color: #3b82f6;
  }

  .rect-hull-form label {
    font-size: 0.75rem;
    color: #888;
  }
</style>
