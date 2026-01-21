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
    selectedModelId,
    player1Models,
    player2Models,
    BASE_SIZES,
    getBaseSize,
    isOvalBase,
    isRectangularBase
  } from '../stores/models.js';
  import { history } from '../stores/history.js';
  import { selectedDeployment, selectedLayoutName, selectedLayoutType, loadedTerrain } from '../stores/battlefieldSetup.js';
  import { pathToSvgD, OBJECTIVE_RADIUS, OBJECTIVE_CONTROL_RADIUS } from '../stores/deployment.js';
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
  let selectedModelIds = new Set();
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

    const hasSelection = $selectedModelId;

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
      if (selectedModelIds.size > 0) {
        // Delete all selected models
        selectedModelIds.forEach(id => {
          models.remove(id);
        });
        selectedModelIds.clear();
        selectedModelIds = selectedModelIds; // Trigger reactivity
      } else if ($selectedModelId) {
        // Delete single selected model
        models.remove($selectedModelId);
        selectedModelId.set(null);
      }
      return;
    }

    // Delete/Backspace - remove selected piece
    if ((event.key === 'Delete' || event.key === 'Backspace') && hasSelection) {
      event.preventDefault();
      handleRemoveSelected();
      return;
    }

    // Arrow keys - move selected piece
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

      if ($selectedModelId) {
        const model = $models.find(m => m.id === $selectedModelId);
        if (model) {
          // Arrow key moves should save to history (each keypress is one action)
          models.updateModel($selectedModelId, {
            x: model.x + dx,
            y: model.y + dy
          }, false);
        }
      }
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

    selectedModelId.set(null);
    selectedModelIds.clear();
    selectedModelIds = selectedModelIds; // Trigger reactivity
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
      // Just a click - deselect all (will be handled by click event)
      selectedModelIds.clear();
      selectedModelId.set(null);
    } else {
      // Actual marquee selection - select all models inside
      const newSelection = new Set();
      $models.forEach(model => {
        if (model.x >= minX && model.x <= maxX &&
            model.y >= minY && model.y <= maxY) {
          newSelection.add(model.id);
        }
      });
      selectedModelIds = newSelection;
      // Clear single selection if we have marquee selection
      if (selectedModelIds.size > 0) {
        selectedModelId.set(null);
      }
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
    selectedModelId.set(id);

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
    selectedModelId.set(id);
  }

  function handleSelectModel(id, event) {
    // Support Ctrl/Cmd/Shift for multi-select
    if (event && (event.ctrlKey || event.metaKey || event.shiftKey)) {
      if (selectedModelIds.has(id)) {
        selectedModelIds.delete(id);
      } else {
        selectedModelIds.add(id);
      }
      selectedModelIds = selectedModelIds; // Trigger reactivity
      selectedModelId.set(null); // Clear single selection
    } else if (selectedModelIds.has(id) && selectedModelIds.size > 1) {
      // Clicking on a model that's already in a multi-selection - keep the selection
      // This allows group dragging to work
      selectedModelId.set(null);
    } else {
      // Single selection
      selectedModelIds.clear();
      selectedModelIds.add(id);
      selectedModelIds = selectedModelIds;
      selectedModelId.set(null);
    }
  }

  function handleDragModel(id, x, y) {
    // Check if this is part of a multi-selection
    if (selectedModelIds.size > 1 && selectedModelIds.has(id)) {
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
    if (selectedModelIds.size > 1 && selectedModelIds.has(id)) {
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
    if (selectedModelIds.size > 0) {
      selectedModelIds.forEach(id => {
        models.remove(id);
      });
      selectedModelIds.clear();
      selectedModelIds = selectedModelIds; // Trigger reactivity
    } else if ($selectedModelId) {
      models.remove($selectedModelId);
      selectedModelId.set(null);
    }
  }

  function handleClearAll() {
    if (confirm('Clear all models?')) {
      models.clear();
      selectedModelId.set(null);
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
  $: selectedModel = $models.find(m => m.id === $selectedModelId);
  $: enemyModels = selectedModel
    ? $models.filter(m => m.playerId !== selectedModel.playerId)
    : [];
  $: allTerrainPolygons = $loadedTerrain.terrains.map(t => ({
    id: t.id,
    vertices: getRotatedRectVertices(t)
  }));
  $: allWallPolygons = $loadedTerrain.walls.map(wall =>
    transformWallVertices(getWallVertices(wall.shape), wall.x, wall.y, wall.rotation)
  );
  $: losResults = selectedModel && losVisualizationEnabled && enemyModels.length > 0
    ? enemyModels.map(enemy => {
        const result = checkLineOfSight(
          modelToLosFormat(selectedModel),
          modelToLosFormat(enemy),
          allTerrainPolygons,
          allWallPolygons
        );
        return {
          targetId: enemy.id,
          target: enemy,
          canSee: result.canSee,
          firstClearRay: result.firstClearRay,
          rays: result.rays
        };
      })
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
        {#if selectedModelIds.size > 1}
          <div class="edit-form">
            <div class="field">
              <span class="label-text">Selected</span>
              <span class="value">{selectedModelIds.size} models</span>
            </div>
            <button class="danger" on:click={handleRemoveSelected}>
              Remove All ({selectedModelIds.size})
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
          <button on:click={saveDeploymentState}>Save State</button>
          <button on:click={restoreDeploymentState}>Restore State</button>
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
        <div class="battlefield-container" on:click={handleDeselectAll} on:mousedown={handleBattlefieldMouseDown} role="presentation">
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
              selected={model.id === $selectedModelId || selectedModelIds.has(model.id)}
              marqueePreview={!selectedModelIds.has(model.id) && marqueePreviewIds.has(model.id)}
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
          {#if showDebugRays && losVisualizationEnabled && selectedModel && losResults.length > 0}
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
          {#if losVisualizationEnabled && selectedModel && losResults.length > 0}
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
                  x1={selectedModel.x}
                  y1={selectedModel.y}
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
