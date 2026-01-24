<script>
  import { onMount, onDestroy } from 'svelte';
  import Battlefield from '../components/Battlefield.svelte';
  import WallPiece from '../components/WallPiece.svelte';
  import ModelBase from '../components/ModelBase.svelte';
  import CollapsibleSection from '../components/CollapsibleSection.svelte';
  import {
    getWallVertices,
    transformWallVertices
  } from '../stores/layout.js';
  import {
    models,
    player1Models,
    player2Models,
    getBaseSize,
    isOvalBase,
    isRectangularBase
  } from '../stores/models.js';
  import { history } from '../stores/history.js';
  import { selectedDeployment, selectedLayoutName, selectedLayoutType, loadedTerrain } from '../stores/battlefieldSetup.js';
  import { pathToSvgD, OBJECTIVE_RADIUS, OBJECTIVE_CONTROL_RADIUS } from '../stores/deployment.js';
  import { checkLineOfSight, checkUnitToUnitLineOfSight } from '../lib/visibility/lineOfSight.js';
  import { getRotatedRectVertices } from '../lib/visibility/geometry.js';
  import { exportBattlefieldPng } from '../lib/exportPng.js';

  // State
  let screenToSvgRef = null;
  let losVisualizationEnabled = false;
  let showDebugRays = false;

  // Marquee selection state
  let isMarqueeSelecting = false;
  let marqueeStart = null;
  let marqueeEnd = null;
  let selectedModelIds = [];
  let marqueePreviewIds = new Set();
  let justCompletedMarquee = false;

  // Group drag/rotate state
  let isDraggingGroup = false;
  let groupDragStart = null;
  let isRotatingGroup = false;
  let groupRotationCenter = null;
  let groupRotationStartAngle = 0;
  let groupStartStates = null;

  // Line tool state
  let measurementLines = [];
  let selectedLineId = null;
  let isDrawingLine = false;
  let lineDrawStart = null;
  let lineDrawEnd = null;
  let lineToolActive = false;

  // Zone visualization state
  let show6InchZone = false;
  let show9InchZone = false;
  let show12InchZone = false;

  onMount(() => {
    window.addEventListener('keydown', handleKeyDown);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeyDown);
  });

  // Export to PNG
  async function handleExportPng() {
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `battle-${timestamp}`;
    try {
      await exportBattlefieldPng(
        $loadedTerrain.terrains,
        $loadedTerrain.walls,
        $models,
        filename,
        $selectedDeployment  // Include deployment zones and objectives
      );
    } catch (err) {
      alert('Failed to export PNG');
      console.error('Export error:', err);
    }
  }

  // State save/restore
  const BATTLE_SAVE_KEY = 'warhammer-battle-state';
  let fileInputRef;

  function saveBattleState() {
    const state = {
      deployment: $selectedDeployment?.name || null,
      layout: $selectedLayoutName || null,
      layoutType: $selectedLayoutType || null,
      models: $models
    };
    localStorage.setItem(BATTLE_SAVE_KEY, JSON.stringify(state));
  }

  function restoreBattleState() {
    const saved = localStorage.getItem(BATTLE_SAVE_KEY);
    if (saved) {
      try {
        const state = JSON.parse(saved);
        if (state.models && Array.isArray(state.models)) {
          models.set(state.models);
          history.clear();
        }
      } catch (err) {
        console.error('Failed to restore battle state:', err);
      }
    }
  }

  function exportState() {
    const state = {
      version: 1,
      exportedAt: new Date().toISOString(),
      deployment: $selectedDeployment ? {
        name: $selectedDeployment.name,
        zones: $selectedDeployment.zones,
        objectives: $selectedDeployment.objectives
      } : null,
      terrain: {
        layoutName: $selectedLayoutName,
        layoutType: $selectedLayoutType,
        terrains: $loadedTerrain.terrains,
        walls: $loadedTerrain.walls
      },
      models: $models.map(m => ({
        id: m.id,
        baseType: m.baseType,
        playerId: m.playerId,
        x: m.x,
        y: m.y,
        rotation: m.rotation || 0,
        name: m.name || '',
        customWidth: m.customWidth,
        customHeight: m.customHeight
      }))
    };

    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const timestamp = new Date().toISOString().slice(0, 10);
    a.download = `battle-${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

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
        if (state.models && Array.isArray(state.models)) {
          models.set(state.models);
          history.clear();
        }
      } catch (err) {
        console.error('Failed to parse import file:', err);
        alert('Failed to import: Invalid JSON file');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  function handleClearAll() {
    if (confirm('Clear all models?')) {
      models.clear();
      selectedModelIds = [];
    }
  }

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

    // Group (Ctrl+G)
    if ((event.ctrlKey || event.metaKey) && event.key === 'g' && !event.shiftKey) {
      event.preventDefault();
      handleGroupSelected();
      return;
    }

    // Ungroup (Ctrl+Shift+G)
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'G') {
      event.preventDefault();
      handleUngroupSelected();
      return;
    }

    // Toggle LoS visualization (L key)
    if (event.key === 'l' || event.key === 'L') {
      event.preventDefault();
      losVisualizationEnabled = !losVisualizationEnabled;
      return;
    }

    // Toggle line tool (M key for measure)
    if (event.key === 'm' || event.key === 'M') {
      event.preventDefault();
      lineToolActive = !lineToolActive;
      if (!lineToolActive) {
        isDrawingLine = false;
        lineDrawStart = null;
        lineDrawEnd = null;
      }
      return;
    }

    // Delete selected models or lines (Delete or Backspace)
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      if (selectedLineId) {
        measurementLines = measurementLines.filter(l => l.id !== selectedLineId);
        selectedLineId = null;
        return;
      }
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
    if (justCompletedMarquee) {
      justCompletedMarquee = false;
      return;
    }

    if (event?.target?.closest('.model-base') || event?.target?.closest('.measurement-line')) {
      return;
    }

    selectedModelIds = [];
    selectedLineId = null;
  }

  // Line tool functions
  function generateLineId() {
    return 'line-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  }

  function calculateLineLength(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  }

  function handleLineMouseDown(event) {
    if (!screenToSvgRef) return;
    event.preventDefault();

    const svgCoords = screenToSvgRef(event.clientX, event.clientY);
    isDrawingLine = true;
    lineDrawStart = { x: svgCoords.x, y: svgCoords.y };
    lineDrawEnd = { x: svgCoords.x, y: svgCoords.y };

    window.addEventListener('mousemove', handleLineMouseMove);
    window.addEventListener('mouseup', handleLineMouseUp);
  }

  function handleLineMouseMove(event) {
    if (!isDrawingLine || !screenToSvgRef) return;
    const svgCoords = screenToSvgRef(event.clientX, event.clientY);
    lineDrawEnd = { x: svgCoords.x, y: svgCoords.y };
  }

  function handleLineMouseUp(event) {
    if (!isDrawingLine) return;

    const length = calculateLineLength(lineDrawStart.x, lineDrawStart.y, lineDrawEnd.x, lineDrawEnd.y);
    if (length > 0.5) {
      const newLine = {
        id: generateLineId(),
        x1: lineDrawStart.x,
        y1: lineDrawStart.y,
        x2: lineDrawEnd.x,
        y2: lineDrawEnd.y
      };
      measurementLines = [...measurementLines, newLine];
      selectedLineId = newLine.id;
      selectedModelIds = [];
    }

    isDrawingLine = false;
    lineDrawStart = null;
    lineDrawEnd = null;
    window.removeEventListener('mousemove', handleLineMouseMove);
    window.removeEventListener('mouseup', handleLineMouseUp);
  }

  function handleSelectLine(lineId, event) {
    event?.stopPropagation();
    selectedLineId = lineId;
    selectedModelIds = [];
  }

  // Line dragging state
  let isDraggingLine = false;
  let lineDragOffset = { x: 0, y: 0 };
  let draggingLineId = null;
  let draggingEndpoint = null;

  function handleLineDragStart(lineId, event) {
    if (!lineToolActive || !screenToSvgRef) return;
    event.stopPropagation();
    event.preventDefault();

    const line = measurementLines.find(l => l.id === lineId);
    if (!line) return;

    isDraggingLine = true;
    draggingLineId = lineId;
    draggingEndpoint = null;
    selectedLineId = lineId;
    selectedModelIds = [];

    const svgCoords = screenToSvgRef(event.clientX, event.clientY);
    const midX = (line.x1 + line.x2) / 2;
    const midY = (line.y1 + line.y2) / 2;
    lineDragOffset = { x: svgCoords.x - midX, y: svgCoords.y - midY };

    window.addEventListener('mousemove', handleLineDragMove);
    window.addEventListener('mouseup', handleLineDragEnd);
  }

  function handleEndpointDragStart(lineId, endpoint, event) {
    if (!lineToolActive || !screenToSvgRef) return;
    event.stopPropagation();
    event.preventDefault();

    isDraggingLine = true;
    draggingLineId = lineId;
    draggingEndpoint = endpoint;
    selectedLineId = lineId;
    selectedModelIds = [];

    window.addEventListener('mousemove', handleLineDragMove);
    window.addEventListener('mouseup', handleLineDragEnd);
  }

  function handleLineDragMove(event) {
    if (!isDraggingLine || !screenToSvgRef || !draggingLineId) return;

    const svgCoords = screenToSvgRef(event.clientX, event.clientY);

    measurementLines = measurementLines.map(line => {
      if (line.id !== draggingLineId) return line;

      if (draggingEndpoint === 1) {
        return { ...line, x1: svgCoords.x, y1: svgCoords.y };
      } else if (draggingEndpoint === 2) {
        return { ...line, x2: svgCoords.x, y2: svgCoords.y };
      } else {
        const newMidX = svgCoords.x - lineDragOffset.x;
        const newMidY = svgCoords.y - lineDragOffset.y;
        const oldMidX = (line.x1 + line.x2) / 2;
        const oldMidY = (line.y1 + line.y2) / 2;
        const dx = newMidX - oldMidX;
        const dy = newMidY - oldMidY;

        return {
          ...line,
          x1: line.x1 + dx,
          y1: line.y1 + dy,
          x2: line.x2 + dx,
          y2: line.y2 + dy
        };
      }
    });
  }

  function handleLineDragEnd() {
    isDraggingLine = false;
    draggingLineId = null;
    draggingEndpoint = null;
    window.removeEventListener('mousemove', handleLineDragMove);
    window.removeEventListener('mouseup', handleLineDragEnd);
  }

  function handleClearAllLines() {
    measurementLines = [];
    selectedLineId = null;
  }

  // Marquee selection handlers
  function handleBattlefieldMouseDown(event) {
    const target = event.target;
    const isModelClick = target.closest('.model-base');
    const isLineClick = target.closest('.measurement-line');

    if (isModelClick || isLineClick) return;
    if (!screenToSvgRef) return;

    event.preventDefault();

    if (lineToolActive) {
      handleLineMouseDown(event);
      return;
    }

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

    const minX = Math.min(marqueeStart.x, marqueeEnd.x);
    const maxX = Math.max(marqueeStart.x, marqueeEnd.x);
    const minY = Math.min(marqueeStart.y, marqueeEnd.y);
    const maxY = Math.max(marqueeStart.y, marqueeEnd.y);

    const width = maxX - minX;
    const height = maxY - minY;
    if (width < 0.5 && height < 0.5) {
      selectedModelIds = [];
    } else {
      const newSelection = [];
      $models.forEach(model => {
        if (model.x >= minX && model.x <= maxX &&
            model.y >= minY && model.y <= maxY) {
          newSelection.push(model.id);
        }
      });
      selectedModelIds = newSelection;
      justCompletedMarquee = true;
    }

    isMarqueeSelecting = false;
    marqueeStart = null;
    marqueeEnd = null;
    marqueePreviewIds.clear();
    marqueePreviewIds = marqueePreviewIds;
    window.removeEventListener('mousemove', handleMarqueeMove);
    window.removeEventListener('mouseup', handleMarqueeEnd);
  }

  // Model handlers
  function handleSelectModel(id, event) {
    // Support Ctrl/Cmd/Shift for multi-select (toggle individual)
    if (event && (event.ctrlKey || event.metaKey || event.shiftKey)) {
      if (selectedModelIds.includes(id)) {
        selectedModelIds = selectedModelIds.filter(x => x !== id);
      } else {
        selectedModelIds = [...selectedModelIds, id];
      }
    } else if (selectedModelIds.includes(id)) {
      // If already selected, keep current selection (allows individual control)
      return;
    } else {
      // Check if this model belongs to a unit
      const model = $models.find(m => m.id === id);
      if (model && model.unitId) {
        // Select all models with the same unitId
        const unitMembers = $models.filter(m => m.unitId === model.unitId).map(m => m.id);
        selectedModelIds = unitMembers;
      } else {
        // Single selection
        selectedModelIds = [id];
      }
    }
  }

  function handleDragModel(id, x, y) {
    if (selectedModelIds.length > 1 && selectedModelIds.includes(id)) {
      if (!isDraggingGroup) {
        isDraggingGroup = true;
        groupDragStart = {};
        selectedModelIds.forEach(modelId => {
          const model = $models.find(m => m.id === modelId);
          if (model) {
            groupDragStart[modelId] = { x: model.x, y: model.y };
          }
        });
      }

      const originalPos = groupDragStart[id];
      if (originalPos) {
        const dx = x - originalPos.x;
        const dy = y - originalPos.y;

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
      models.updateModel(id, { x, y }, true);
    }
  }

  function handleDragModelEnd(id, startX, startY, endX, endY) {
    if (isDraggingGroup) {
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
      history.push({
        type: 'move',
        modelId: id,
        before: { x: startX, y: startY },
        after: { x: endX, y: endY }
      });
    }
  }

  function handleRotateModel(id, rotation) {
    if (selectedModelIds.length > 1 && selectedModelIds.includes(id)) {
      if (!isRotatingGroup) {
        isRotatingGroup = true;

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
        groupDragStart = startStates;
      }

      const rotatingModel = $models.find(m => m.id === id);
      const startState = groupDragStart[id];
      if (!rotatingModel || !startState) return;

      const rotationDelta = rotation - startState.rotation;

      selectedModelIds.forEach(modelId => {
        const startPos = groupDragStart[modelId];
        if (startPos) {
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
      models.updateModel(id, { rotation }, true);
    }
  }

  function handleRotateModelEnd(id, startRotation, endRotation) {
    if (isRotatingGroup) {
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

  // Group selected models
  function handleGroupSelected() {
    if (selectedModelIds.length < 2) return;

    // Verify all models belong to same player
    const selectedModelsData = selectedModelIds.map(id => $models.find(m => m.id === id)).filter(Boolean);
    const playerIds = [...new Set(selectedModelsData.map(m => m.playerId))];
    if (playerIds.length > 1) {
      alert('Cannot group models from different players');
      return;
    }

    models.groupModels(selectedModelIds);
  }

  // Ungroup selected models
  function handleUngroupSelected() {
    if (selectedModelIds.length === 0) return;

    // Filter to only models that have a unitId
    const modelsWithUnits = selectedModelIds.filter(id => {
      const model = $models.find(m => m.id === id);
      return model && model.unitId;
    });

    if (modelsWithUnits.length > 0) {
      models.ungroupModels(modelsWithUnits);
    }
  }

  // Group rotation handle functions
  function handleGroupRotateMouseDown(event) {
    if (!screenToSvgRef || selectedModels.length < 2) return;
    event.preventDefault();
    event.stopPropagation();

    isRotatingGroup = true;

    groupStartStates = {};
    selectedModels.forEach(model => {
      groupStartStates[model.id] = {
        x: model.x,
        y: model.y,
        rotation: model.rotation || 0
      };
    });

    const svgCoords = screenToSvgRef(event.clientX, event.clientY);
    groupRotationStartAngle = Math.atan2(svgCoords.y - groupCenter.y, svgCoords.x - groupCenter.x) * 180 / Math.PI;

    window.addEventListener('mousemove', handleGroupRotateMouseMove);
    window.addEventListener('mouseup', handleGroupRotateMouseUp);
  }

  function handleGroupRotateMouseMove(event) {
    if (!isRotatingGroup || !screenToSvgRef || !groupCenter) return;

    const svgCoords = screenToSvgRef(event.clientX, event.clientY);
    let currentAngle = Math.atan2(svgCoords.y - groupCenter.y, svgCoords.x - groupCenter.x) * 180 / Math.PI;

    let rotationDelta = currentAngle - groupRotationStartAngle;
    if (!event.shiftKey) {
      rotationDelta = Math.round(rotationDelta / 15) * 15;
    }

    groupHandleAngle = -45 + rotationDelta;

    const angleRad = (rotationDelta * Math.PI) / 180;
    const cosAngle = Math.cos(angleRad);
    const sinAngle = Math.sin(angleRad);

    selectedModels.forEach(model => {
      const startState = groupStartStates[model.id];
      if (startState) {
        const relX = startState.x - groupCenter.x;
        const relY = startState.y - groupCenter.y;
        const newRelX = relX * cosAngle - relY * sinAngle;
        const newRelY = relX * sinAngle + relY * cosAngle;

        models.updateModel(model.id, {
          x: groupCenter.x + newRelX,
          y: groupCenter.y + newRelY,
          rotation: startState.rotation + rotationDelta
        }, true);
      }
    });
  }

  function handleGroupRotateMouseUp() {
    if (isRotatingGroup && groupStartStates) {
      selectedModels.forEach(model => {
        const startState = groupStartStates[model.id];
        if (startState) {
          history.push({
            type: 'rotate',
            modelId: model.id,
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
    }

    isRotatingGroup = false;
    groupStartStates = null;
    groupHandleAngle = -45;

    window.removeEventListener('mousemove', handleGroupRotateMouseMove);
    window.removeEventListener('mouseup', handleGroupRotateMouseUp);
  }

  function handleRemoveSelected() {
    if (selectedModelIds.length > 0) {
      selectedModelIds.forEach(id => {
        models.remove(id);
      });
      selectedModelIds = [];
    }
  }

  // Convert model to LoS format
  function modelToLosFormat(model) {
    if (isRectangularBase(model.baseType)) {
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

  // Reactive calculations
  $: selectedModels = selectedModelIds
    .map(id => $models.find(m => m.id === id))
    .filter(Boolean);
  $: selectedModel = selectedModels.length === 1 ? selectedModels[0] : null;

  // Check if selected models can be grouped
  $: canGroupSelected = (() => {
    if (selectedModels.length < 2) return false;
    const playerIds = [...new Set(selectedModels.map(m => m.playerId))];
    return playerIds.length === 1; // All must be from same player
  })();

  // Check if any selected models can be ungrouped
  $: canUngroupSelected = selectedModels.some(m => m.unitId);

  // Unit color palette (20 distinct hues)
  const UNIT_COLORS = [
    '#f97316', '#f59e0b', '#eab308', '#84cc16',
    '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
    '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
    '#ec4899', '#f43f5e', '#fb7185', '#fdba74', '#fcd34d'
  ];

  // Hash unitId to a color index
  function getUnitColor(unitId) {
    if (!unitId) return null;
    let hash = 0;
    for (let i = 0; i < unitId.length; i++) {
      hash = ((hash << 5) - hash) + unitId.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }
    const index = Math.abs(hash) % UNIT_COLORS.length;
    return UNIT_COLORS[index];
  }

  $: groupCenter = selectedModels.length > 1 ? (() => {
    let sumX = 0, sumY = 0;
    selectedModels.forEach(m => { sumX += m.x; sumY += m.y; });
    return { x: sumX / selectedModels.length, y: sumY / selectedModels.length };
  })() : null;

  $: groupHandleDistance = selectedModels.length > 1 ? (() => {
    let maxDist = 0;
    selectedModels.forEach(m => {
      const dist = Math.sqrt(Math.pow(m.x - groupCenter.x, 2) + Math.pow(m.y - groupCenter.y, 2));
      const baseSize = getBaseSize(m.baseType, m);
      const modelRadius = isRectangularBase(m.baseType)
        ? Math.max(m.customWidth, m.customHeight) / 2
        : (isOvalBase(m.baseType) ? Math.max(baseSize.width, baseSize.height) / 2 : baseSize.radius);
      maxDist = Math.max(maxDist, dist + modelRadius);
    });
    return maxDist + 2;
  })() : 0;

  let groupHandleAngle = -45;

  $: groupHandleX = groupCenter ? groupCenter.x + groupHandleDistance * Math.cos(groupHandleAngle * Math.PI / 180) : 0;
  $: groupHandleY = groupCenter ? groupCenter.y + groupHandleDistance * Math.sin(groupHandleAngle * Math.PI / 180) : 0;
  $: selectedLine = selectedLineId ? measurementLines.find(l => l.id === selectedLineId) : null;
  $: selectedPlayerIds = [...new Set(selectedModels.map(m => m.playerId))];
  $: enemyModels = selectedModels.length > 0
    ? $models.filter(m => !selectedPlayerIds.includes(m.playerId))
    : [];
  $: allTerrainPolygons = $loadedTerrain.terrains.map(t => ({
    id: t.id,
    vertices: getRotatedRectVertices(t)
  }));
  $: allWallPolygons = $loadedTerrain.walls.map(wall =>
    transformWallVertices(getWallVertices(wall.shape, wall.segments), wall.x, wall.y, wall.rotation)
  );
  // Calculate LOS using unit-based logic
  // Group selected models and enemy models into units
  $: losResults = selectedModels.length > 0 && losVisualizationEnabled && enemyModels.length > 0
    ? (() => {
        // Group selected models by unitId (ungrouped = own unit)
        const selectedUnits = new Map();
        selectedModels.forEach(model => {
          const key = model.unitId || `single-${model.id}`;
          if (!selectedUnits.has(key)) {
            selectedUnits.set(key, []);
          }
          selectedUnits.get(key).push(model);
        });

        // Group enemy models by unitId (ungrouped = own unit)
        const enemyUnits = new Map();
        enemyModels.forEach(model => {
          const key = model.unitId || `single-${model.id}`;
          if (!enemyUnits.has(key)) {
            enemyUnits.set(key, []);
          }
          enemyUnits.get(key).push(model);
        });

        // Check each selected unit against each enemy unit
        const results = [];
        for (const selectedUnit of selectedUnits.values()) {
          for (const enemyUnit of enemyUnits.values()) {
            // Convert to LOS format
            const enemyModelsLos = enemyUnit.map(m => modelToLosFormat(m));
            const selectedModelsLos = selectedUnit.map(m => modelToLosFormat(m));

            // Check if any enemy in unit can see any selected in unit
            const unitResult = checkUnitToUnitLineOfSight(
              enemyModelsLos,
              selectedModelsLos,
              allTerrainPolygons,
              allWallPolygons
            );

            // If ANY model in enemy unit can see ANY model in selected unit,
            // mark ALL models in enemy unit as visible
            if (unitResult.canSee) {
              enemyUnit.forEach(enemyModel => {
                selectedUnit.forEach(selectedModel => {
                  results.push({
                    sourceId: enemyModel.id,
                    source: enemyModel,
                    targetId: selectedModel.id,
                    target: selectedModel,
                    canSee: true,
                    firstClearRay: unitResult.firstClearResult?.firstClearRay,
                    rays: unitResult.firstClearResult?.rays || []
                  });
                });
              });
            } else {
              // No LOS - add blocked results
              enemyUnit.forEach(enemyModel => {
                selectedUnit.forEach(selectedModel => {
                  results.push({
                    sourceId: enemyModel.id,
                    source: enemyModel,
                    targetId: selectedModel.id,
                    target: selectedModel,
                    canSee: false,
                    firstClearRay: null,
                    rays: []
                  });
                });
              });
            }
          }
        }
        return results;
      })()
    : [];
</script>

<main>
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
                  <span class="value">{losResults.filter(r => r.canSee).length}/{losResults.length} visible</span>
                </div>
              {/if}
            {/if}
            {#if canGroupSelected}
              <button on:click={handleGroupSelected}>
                Group (Ctrl+G)
              </button>
            {/if}
            {#if canUngroupSelected}
              <button on:click={handleUngroupSelected}>
                Ungroup (Ctrl+Shift+G)
              </button>
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

      <!-- Measure Tool Section -->
      <CollapsibleSection title="Measure Tool">
        <div class="edit-form">
          <div class="field">
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={lineToolActive} />
              Line Tool Active (M)
            </label>
          </div>
          {#if lineToolActive}
            <p class="hint">Click and drag on battlefield to draw a measurement line</p>
          {/if}
          {#if selectedLine}
            <div class="field">
              <span class="label-text">Length</span>
              <span class="value">{calculateLineLength(selectedLine.x1, selectedLine.y1, selectedLine.x2, selectedLine.y2).toFixed(2)}"</span>
            </div>
            <button class="danger" on:click={() => { measurementLines = measurementLines.filter(l => l.id !== selectedLineId); selectedLineId = null; }}>
              Remove Line
            </button>
          {/if}
          {#if measurementLines.length > 0}
            <div class="field">
              <span class="label-text">Lines</span>
              <span class="value">{measurementLines.length} line{measurementLines.length !== 1 ? 's' : ''}</span>
            </div>
            <button class="secondary" on:click={handleClearAllLines}>
              Clear All Lines
            </button>
          {/if}
          <div class="field" style="margin-top: 0.5rem; border-top: 1px solid #333; padding-top: 0.5rem;">
            <span class="label-text">Range Zones</span>
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={show6InchZone} />
              Show 6" zones
            </label>
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={show9InchZone} />
              Show 9" zones
            </label>
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={show12InchZone} />
              Show 12" zones
            </label>
          </div>
        </div>
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
            <button on:click={exportState} title="Export battle state to share">
              Export
            </button>
            <button on:click={triggerImport} title="Import battle state from JSON">
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
          <button on:click={handleExportPng} title="Export battlefield as PNG image">Export PNG</button>
          <button on:click={saveBattleState}>Save to Browser</button>
          <button on:click={restoreBattleState}>Restore from Browser</button>
          <button class="secondary" on:click={handleClearAll}>Clear All Models</button>
        </div>
      </CollapsibleSection>
    </div>

    <div class="main-content">
      <div class="battlefield-area">
        <div class="battlefield-container" on:mousedown={handleBattlefieldMouseDown} role="presentation">
        <Battlefield let:screenToSvg>
          {#if screenToSvg && !screenToSvgRef}
            {screenToSvgRef = screenToSvg, ''}
          {/if}

          <!-- Deployment zones (stroke only, no fill) -->
          {#if $selectedDeployment}
            {#each $selectedDeployment.zones as zone}
              <path
                d={pathToSvgD(zone.path)}
                fill="none"
                stroke={zone.borderColor}
                stroke-width="0.15"
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
                segments={wall.segments}
                rotation={wall.rotation}
                selected={false}
                {screenToSvg}
                onSelect={() => {}}
                onDrag={() => {}}
                onRotate={() => {}}
              />
            </g>
          {/each}

          <!-- Range zone visualization (6", 9", and 12" zones) -->
          {#if show6InchZone || show9InchZone || show12InchZone}
            {#each $models as model (model.id)}
              {@const baseSize = getBaseSize(model.baseType, model)}
              {@const isOval = isOvalBase(model.baseType)}
              {@const isRect = isRectangularBase(model.baseType)}
              {@const playerColor = model.playerId === 1 ? 'rgba(59, 130, 246, 0.15)' : 'rgba(239, 68, 68, 0.15)'}
              {@const playerStroke = model.playerId === 1 ? '#3b82f6' : '#ef4444'}
              {#if show12InchZone}
                {#if isRect}
                  <g transform="rotate({model.rotation || 0}, {model.x}, {model.y})">
                    <rect
                      x={model.x - model.customWidth / 2 - 12}
                      y={model.y - model.customHeight / 2 - 12}
                      width={model.customWidth + 24}
                      height={model.customHeight + 24}
                      rx="12"
                      ry="12"
                      fill={playerColor}
                      stroke={playerStroke}
                      stroke-width="0.05"
                      stroke-dasharray="0.5,0.25"
                      pointer-events="none"
                      opacity="0.4"
                    />
                  </g>
                {:else if isOval}
                  <g transform="rotate({model.rotation || 0}, {model.x}, {model.y})">
                    <ellipse
                      cx={model.x}
                      cy={model.y}
                      rx={baseSize.width / 2 + 12}
                      ry={baseSize.height / 2 + 12}
                      fill={playerColor}
                      stroke={playerStroke}
                      stroke-width="0.05"
                      stroke-dasharray="0.5,0.25"
                      pointer-events="none"
                      opacity="0.4"
                    />
                  </g>
                {:else}
                  <circle
                    cx={model.x}
                    cy={model.y}
                    r={baseSize.radius + 12}
                    fill={playerColor}
                    stroke={playerStroke}
                    stroke-width="0.05"
                    stroke-dasharray="0.5,0.25"
                    pointer-events="none"
                    opacity="0.4"
                  />
                {/if}
              {/if}
              {#if show9InchZone}
                {#if isRect}
                  <g transform="rotate({model.rotation || 0}, {model.x}, {model.y})">
                    <rect
                      x={model.x - model.customWidth / 2 - 9}
                      y={model.y - model.customHeight / 2 - 9}
                      width={model.customWidth + 18}
                      height={model.customHeight + 18}
                      rx="9"
                      ry="9"
                      fill={playerColor}
                      stroke={playerStroke}
                      stroke-width="0.05"
                      stroke-dasharray="0.5,0.25"
                      pointer-events="none"
                      opacity="0.5"
                    />
                  </g>
                {:else if isOval}
                  <g transform="rotate({model.rotation || 0}, {model.x}, {model.y})">
                    <ellipse
                      cx={model.x}
                      cy={model.y}
                      rx={baseSize.width / 2 + 9}
                      ry={baseSize.height / 2 + 9}
                      fill={playerColor}
                      stroke={playerStroke}
                      stroke-width="0.05"
                      stroke-dasharray="0.5,0.25"
                      pointer-events="none"
                      opacity="0.5"
                    />
                  </g>
                {:else}
                  <circle
                    cx={model.x}
                    cy={model.y}
                    r={baseSize.radius + 9}
                    fill={playerColor}
                    stroke={playerStroke}
                    stroke-width="0.05"
                    stroke-dasharray="0.5,0.25"
                    pointer-events="none"
                    opacity="0.5"
                  />
                {/if}
              {/if}
              {#if show6InchZone}
                {#if isRect}
                  <g transform="rotate({model.rotation || 0}, {model.x}, {model.y})">
                    <rect
                      x={model.x - model.customWidth / 2 - 6}
                      y={model.y - model.customHeight / 2 - 6}
                      width={model.customWidth + 12}
                      height={model.customHeight + 12}
                      rx="6"
                      ry="6"
                      fill="none"
                      stroke={playerStroke}
                      stroke-width="0.08"
                      stroke-dasharray="0.3,0.15"
                      pointer-events="none"
                      opacity="0.7"
                    />
                  </g>
                {:else if isOval}
                  <g transform="rotate({model.rotation || 0}, {model.x}, {model.y})">
                    <ellipse
                      cx={model.x}
                      cy={model.y}
                      rx={baseSize.width / 2 + 6}
                      ry={baseSize.height / 2 + 6}
                      fill="none"
                      stroke={playerStroke}
                      stroke-width="0.08"
                      stroke-dasharray="0.3,0.15"
                      pointer-events="none"
                      opacity="0.7"
                    />
                  </g>
                {:else}
                  <circle
                    cx={model.x}
                    cy={model.y}
                    r={baseSize.radius + 6}
                    fill="none"
                    stroke={playerStroke}
                    stroke-width="0.08"
                    stroke-dasharray="0.3,0.15"
                    pointer-events="none"
                    opacity="0.7"
                  />
                {/if}
              {/if}
            {/each}
          {/if}

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
              unitStrokeColor={getUnitColor(model.unitId)}
              selected={selectedModelIds.includes(model.id)}
              inGroupSelection={selectedModelIds.length > 1 && selectedModelIds.includes(model.id)}
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

          <!-- Group rotation handle (when multiple models selected) -->
          {#if groupCenter && selectedModels.length > 1}
            <circle
              cx={groupCenter.x}
              cy={groupCenter.y}
              r="0.4"
              fill="rgba(147, 51, 234, 0.5)"
              stroke="#9333ea"
              stroke-width="0.1"
              pointer-events="none"
            />
            <line
              x1={groupCenter.x}
              y1={groupCenter.y}
              x2={groupHandleX}
              y2={groupHandleY}
              stroke="#9333ea"
              stroke-width="0.1"
              stroke-dasharray="0.3,0.15"
              pointer-events="none"
            />
            <circle
              cx={groupHandleX}
              cy={groupHandleY}
              r="0.8"
              fill="#9333ea"
              stroke="#7e22ce"
              stroke-width="0.1"
              on:mousedown={handleGroupRotateMouseDown}
              role="button"
              tabindex="0"
              class="group-rotate-handle"
            />
            <g transform="translate({groupHandleX}, {groupHandleY})" pointer-events="none">
              <path
                d="M -0.3 0 A 0.3 0.3 0 1 1 0.3 0"
                fill="none"
                stroke="white"
                stroke-width="0.08"
              />
              <path
                d="M 0.22 -0.15 L 0.3 0 L 0.15 0.08"
                fill="none"
                stroke="white"
                stroke-width="0.08"
              />
            </g>
          {/if}

          <!-- Measurement lines -->
          {#each measurementLines as line (line.id)}
            {@const length = calculateLineLength(line.x1, line.y1, line.x2, line.y2)}
            {@const midX = (line.x1 + line.x2) / 2}
            {@const midY = (line.y1 + line.y2) / 2}
            {@const isSelected = line.id === selectedLineId}
            <g class="measurement-line" class:selected={isSelected} class:tool-active={lineToolActive}>
              <line
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke={isSelected && lineToolActive ? '#3b82f6' : '#f59e0b'}
                stroke-width={isSelected && lineToolActive ? 0.2 : 0.15}
                stroke-linecap="round"
                on:click={(e) => lineToolActive && handleSelectLine(line.id, e)}
                on:mousedown={(e) => lineToolActive ? handleLineDragStart(line.id, e) : e.stopPropagation()}
                role={lineToolActive ? "button" : "presentation"}
                tabindex={lineToolActive ? 0 : -1}
              />
              {#if lineToolActive}
                <circle
                  cx={line.x1}
                  cy={line.y1}
                  r="0.4"
                  fill={isSelected ? '#3b82f6' : '#f59e0b'}
                  stroke="#000"
                  stroke-width="0.05"
                  class="endpoint"
                  on:mousedown={(e) => handleEndpointDragStart(line.id, 1, e)}
                  role="button"
                  tabindex="0"
                />
                <circle
                  cx={line.x2}
                  cy={line.y2}
                  r="0.4"
                  fill={isSelected ? '#3b82f6' : '#f59e0b'}
                  stroke="#000"
                  stroke-width="0.05"
                  class="endpoint"
                  on:mousedown={(e) => handleEndpointDragStart(line.id, 2, e)}
                  role="button"
                  tabindex="0"
                />
              {/if}
              <g transform="translate({midX}, {midY})">
                <rect
                  x="-2"
                  y="-0.6"
                  width="4"
                  height="1.2"
                  fill="rgba(0,0,0,0.75)"
                  rx="0.3"
                  pointer-events="none"
                />
                <text
                  x="0"
                  y="0.35"
                  text-anchor="middle"
                  fill={isSelected && lineToolActive ? '#3b82f6' : '#f59e0b'}
                  font-size="0.8"
                  font-weight="bold"
                  pointer-events="none"
                >
                  {length.toFixed(1)}"
                </text>
              </g>
            </g>
          {/each}

          <!-- Line being drawn -->
          {#if isDrawingLine && lineDrawStart && lineDrawEnd}
            {@const length = calculateLineLength(lineDrawStart.x, lineDrawStart.y, lineDrawEnd.x, lineDrawEnd.y)}
            {@const midX = (lineDrawStart.x + lineDrawEnd.x) / 2}
            {@const midY = (lineDrawStart.y + lineDrawEnd.y) / 2}
            <g class="measurement-line drawing">
              <line
                x1={lineDrawStart.x}
                y1={lineDrawStart.y}
                x2={lineDrawEnd.x}
                y2={lineDrawEnd.y}
                stroke="#f59e0b"
                stroke-width="0.15"
                stroke-dasharray="0.3,0.15"
                stroke-linecap="round"
                pointer-events="none"
              />
              <circle cx={lineDrawStart.x} cy={lineDrawStart.y} r="0.3" fill="#f59e0b" pointer-events="none" />
              <circle cx={lineDrawEnd.x} cy={lineDrawEnd.y} r="0.3" fill="#f59e0b" pointer-events="none" />
              {#if length > 0.5}
                <g transform="translate({midX}, {midY})">
                  <rect
                    x="-2"
                    y="-0.6"
                    width="4"
                    height="1.2"
                    fill="rgba(0,0,0,0.75)"
                    rx="0.3"
                    pointer-events="none"
                  />
                  <text
                    x="0"
                    y="0.35"
                    text-anchor="middle"
                    fill="#f59e0b"
                    font-size="0.8"
                    font-weight="bold"
                    pointer-events="none"
                  >
                    {length.toFixed(1)}"
                  </text>
                </g>
              {/if}
            </g>
          {/if}

          <!-- Debug rays -->
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
          <p class="hint">Drag to select | Ctrl+Click multi-select | Del remove | L LoS | M measure</p>
        </div>
      </div>
    </div>
  </div>
</main>

<style>
  main {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    padding: 1rem;
    padding-top: 4rem;
    padding-bottom: 3rem;
    box-sizing: border-box;
  }

  .layout {
    display: flex;
    gap: 1.5rem;
    flex: 1;
  }

  .sidebar {
    width: 220px;
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
    padding: 0.375rem 0.5rem;
    border: 1px solid #444;
    border-radius: 4px;
    background: #333;
    color: #fff;
    cursor: pointer;
    font-size: 0.8rem;
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

  :global(.measurement-line line) {
    pointer-events: stroke;
  }

  :global(.measurement-line.tool-active line) {
    cursor: move;
  }

  :global(.measurement-line.tool-active.selected line) {
    filter: drop-shadow(0 0 2px #3b82f6);
  }

  :global(.measurement-line .endpoint) {
    cursor: crosshair;
  }

  :global(.group-rotate-handle) {
    cursor: grab;
    filter: drop-shadow(0.1px 0.1px 0.2px rgba(0,0,0,0.5));
    transition: filter 0.15s;
  }

  :global(.group-rotate-handle:hover) {
    filter: drop-shadow(0 0 0.5px #9333ea);
  }
</style>
