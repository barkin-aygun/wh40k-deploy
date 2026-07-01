<script>
  import { onMount, onDestroy } from 'svelte';
  import Battlefield from '../components/Battlefield.svelte';
  import TerrainRect from '../components/TerrainRect.svelte';
  import WallPiece from '../components/WallPiece.svelte';
  import ModelBase from '../components/ModelBase.svelte';
  import ModelPaletteItem from '../components/ModelPaletteItem.svelte';
  import CollapsibleSection from '../components/CollapsibleSection.svelte';
  import MeasureToolPanel from '../components/MeasureToolPanel.svelte';
  import RangeZones from '../components/RangeZones.svelte';
  import ArmyImportPanel from '../components/ArmyImportPanel.svelte';
  import UnmatchedUnitsDialog from '../components/UnmatchedUnitsDialog.svelte';
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
  import { pathToSvgD, OBJECTIVE_RADIUS } from '../stores/deployment.js';
  import { checkLineOfSight, checkUnitToUnitLineOfSight } from '../lib/visibility/lineOfSight.js';
  import { getRotatedRectVertices } from '../lib/visibility/geometry.js';
  import { armyImports } from '../stores/armyImports.js';
  import { parseArmyList } from '../lib/services/armyParser.js';
  import { mapParsedUnitsToModels } from '../lib/services/unitMapper.js';
  import { exportBattlefieldPng } from '../lib/exportPng.js';
  import { saveState, restoreState, exportToFile, applyState } from '../lib/statePersistence.js';
  import { COLORS } from '../lib/colors.js';

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

  // Unit drag state (drag any model → whole unit follows)
  let isDraggingUnit = false;
  let unitDragStart = null;
  let unitDragIds = [];
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

  const DRAG_THRESHOLD = 5; // pixels - movement below this is considered a click
  const DEEP_STRIKE_DENIAL_RADIUS = 9; // 9" radius around each model


  // Export to PNG
  async function handleExportPng() {
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `deployment-${timestamp}`;
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
        applyState(JSON.parse(e.target.result));
        selectedModelIds = [];
      } catch (err) {
        console.error('Failed to parse import file:', err);
        alert('Failed to import: Invalid JSON file');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  // Calculate positions for imported models on the side of the battlefield
  function calculateSidePositions(modelList, playerId) {
    const SPACING = 2; // 2" spacing between models
    const MAX_ROWS = 20; // Max models per column
    // Player 1 on left side (x = -4), Player 2 on right side (x = 64)
    const startX = playerId === 1 ? -4 : 64;
    const startY = 2;

    let currentX = startX;
    let currentY = startY;
    let rowCount = 0;

    return modelList.map(model => {
      const positionedModel = {
        ...model,
        x: currentX,
        y: currentY,
        inStaging: false
      };

      currentY += SPACING;
      rowCount++;

      if (rowCount >= MAX_ROWS) {
        currentY = startY;
        currentX += playerId === 1 ? -SPACING : SPACING;
        rowCount = 0;
      }

      return positionedModel;
    });
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
        // Position models on the side and add directly to battlefield
        const positionedModels = calculateSidePositions(matched, playerId);
        positionedModels.forEach(model => {
          models.update(current => [...current, model]);
        });

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
          name: selection.unitName,
          imported: true
        });
      }
    }

    // Combine with pending matched models
    const allModels = [...pendingMatched, ...additionalModels];

    // Position models on the side and add directly to battlefield
    const positionedModels = calculateSidePositions(allModels, currentPlayer);
    positionedModels.forEach(model => {
      models.update(current => [...current, model]);
    });

    if (importPanelRef) {
      importPanelRef.setSuccess(`Imported ${allModels.length} models`);
      importPanelRef.clearText();
    }

    // Reset state
    unmatchedUnits = [];
    pendingMatched = [];
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
    // Don't deselect if we just completed a marquee selection
    if (justCompletedMarquee) {
      justCompletedMarquee = false;
      return;
    }

    // Don't deselect if click originated from a model or line
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

    // Only create line if it has some length
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
  let draggingEndpoint = null; // null, 1, or 2 (for which endpoint)

  function handleLineDragStart(lineId, event) {
    if (!lineToolActive || !screenToSvgRef) return;
    event.stopPropagation();
    event.preventDefault();

    const line = measurementLines.find(l => l.id === lineId);
    if (!line) return;

    isDraggingLine = true;
    draggingLineId = lineId;
    draggingEndpoint = null; // Dragging whole line
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
    draggingEndpoint = endpoint; // 1 or 2
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
        // Dragging first endpoint
        return { ...line, x1: svgCoords.x, y1: svgCoords.y };
      } else if (draggingEndpoint === 2) {
        // Dragging second endpoint
        return { ...line, x2: svgCoords.x, y2: svgCoords.y };
      } else {
        // Dragging whole line
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
    // Only start marquee if clicking on battlefield (not on a model or line)
    const target = event.target;
    const isModelClick = target.closest('.model-base');
    const isLineClick = target.closest('.measurement-line');

    if (isModelClick || isLineClick) return;
    if (!screenToSvgRef) return;

    // Prevent text selection during drag
    event.preventDefault();

    // If line tool is active, start drawing a line
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
      const model = $models.find(m => m.id === id);
      if (model && model.unitId) {
        // Unit drag — move all models in the same unit together
        if (!isDraggingUnit) {
          isDraggingUnit = true;
          unitDragIds = $models.filter(m => m.unitId === model.unitId).map(m => m.id);
          unitDragStart = {};
          unitDragIds.forEach(modelId => {
            const m = $models.find(m => m.id === modelId);
            if (m) unitDragStart[modelId] = { x: m.x, y: m.y };
          });
        }
        const originalPos = unitDragStart[id];
        if (originalPos) {
          const dx = x - originalPos.x;
          const dy = y - originalPos.y;
          unitDragIds.forEach(modelId => {
            const startPos = unitDragStart[modelId];
            if (startPos) {
              models.updateModel(modelId, { x: startPos.x + dx, y: startPos.y + dy }, true);
            }
          });
        }
      } else {
        // Single model drag
        models.updateModel(id, { x, y }, true);
      }
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
    } else if (isDraggingUnit) {
      unitDragIds.forEach(modelId => {
        const startPos = unitDragStart[modelId];
        const model = $models.find(m => m.id === modelId);
        if (startPos && model) {
          history.push({
            type: 'move',
            modelId,
            before: { x: startPos.x, y: startPos.y },
            after: { x: model.x, y: model.y }
          });
        }
      });
      isDraggingUnit = false;
      unitDragStart = null;
      unitDragIds = [];
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

    // Store starting states for all selected models
    groupStartStates = {};
    selectedModels.forEach(model => {
      groupStartStates[model.id] = {
        x: model.x,
        y: model.y,
        rotation: model.rotation || 0
      };
    });

    // Calculate initial angle from center to mouse
    const svgCoords = screenToSvgRef(event.clientX, event.clientY);
    groupRotationStartAngle = Math.atan2(svgCoords.y - groupCenter.y, svgCoords.x - groupCenter.x) * 180 / Math.PI;

    window.addEventListener('mousemove', handleGroupRotateMouseMove);
    window.addEventListener('mouseup', handleGroupRotateMouseUp);
  }

  function handleGroupRotateMouseMove(event) {
    if (!isRotatingGroup || !screenToSvgRef || !groupCenter) return;

    const svgCoords = screenToSvgRef(event.clientX, event.clientY);
    let currentAngle = Math.atan2(svgCoords.y - groupCenter.y, svgCoords.x - groupCenter.x) * 180 / Math.PI;

    // Snap to 15 degree increments unless Shift is held
    let rotationDelta = currentAngle - groupRotationStartAngle;
    if (!event.shiftKey) {
      rotationDelta = Math.round(rotationDelta / 15) * 15;
    }

    // Update handle angle for visual feedback
    groupHandleAngle = -45 + rotationDelta;

    // Rotate all selected models around the center
    const angleRad = (rotationDelta * Math.PI) / 180;
    const cosAngle = Math.cos(angleRad);
    const sinAngle = Math.sin(angleRad);

    selectedModels.forEach(model => {
      const startState = groupStartStates[model.id];
      if (startState) {
        // Rotate position around center
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
      // Save group rotation to history
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
    groupHandleAngle = -45; // Reset handle angle

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
    console.log(UNIT_COLORS[index]);
    return UNIT_COLORS[index];
  }

  // Group rotation handle calculations (only when multiple models selected)
  $: groupCenter = selectedModels.length > 1 ? (() => {
    let sumX = 0, sumY = 0;
    selectedModels.forEach(m => { sumX += m.x; sumY += m.y; });
    return { x: sumX / selectedModels.length, y: sumY / selectedModels.length };
  })() : null;

  $: groupHandleDistance = selectedModels.length > 1 ? (() => {
    // Calculate max distance from center to any selected model, then add offset
    let maxDist = 0;
    selectedModels.forEach(m => {
      const dist = Math.sqrt(Math.pow(m.x - groupCenter.x, 2) + Math.pow(m.y - groupCenter.y, 2));
      // Add base radius to account for model size
      const baseSize = getBaseSize(m.baseType, m);
      const modelRadius = isRectangularBase(m.baseType)
        ? Math.max(m.customWidth, m.customHeight) / 2
        : (isOvalBase(m.baseType) ? Math.max(baseSize.width, baseSize.height) / 2 : baseSize.radius);
      maxDist = Math.max(maxDist, dist + modelRadius);
    });
    return maxDist + 2; // Add 2 inches offset for the handle
  })() : 0;

  // Group rotation handle angle (stored separately to allow rotation during drag)
  let groupHandleAngle = -45; // Default angle in degrees

  $: groupHandleX = groupCenter ? groupCenter.x + groupHandleDistance * Math.cos(groupHandleAngle * Math.PI / 180) : 0;
  $: groupHandleY = groupCenter ? groupCenter.y + groupHandleDistance * Math.sin(groupHandleAngle * Math.PI / 180) : 0;
  // Selected line
  $: selectedLine = selectedLineId ? measurementLines.find(l => l.id === selectedLineId) : null;
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
                  <span class="value">{losResults.filter(r => r.canSee).length}/{losResults.length} rays visible</span>
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
            <div class="field" style="margin-top: 0.5rem; border-top: 1px solid #333; padding-top: 0.5rem;">
              <span class="label-text">Range Zones</span>
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  checked={!!selectedModel.show6InchZone}
                  on:change={(e) => models.updateModel(selectedModel.id, { show6InchZone: e.target.checked })}
                />
                Show 6" zone
              </label>
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  checked={!!selectedModel.show9InchZone}
                  on:change={(e) => models.updateModel(selectedModel.id, { show9InchZone: e.target.checked })}
                />
                Show 9" zone
              </label>
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  checked={!!selectedModel.show12InchZone}
                  on:change={(e) => models.updateModel(selectedModel.id, { show12InchZone: e.target.checked })}
                />
                Show 12" zone
              </label>
            </div>
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
        <MeasureToolPanel
          bind:lineToolActive
          bind:show6InchZone
          bind:show9InchZone
          bind:show12InchZone
          {selectedLine}
          lineCount={measurementLines.length}
          onDeleteSelectedLine={() => { measurementLines = measurementLines.filter(l => l.id !== selectedLineId); selectedLineId = null; }}
          onClearAllLines={handleClearAllLines}
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
            <button on:click={() => exportToFile($loadedTerrain, `deployment-${new Date().toISOString().slice(0,10)}.json`)} title="Export deployment to share with others">
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
          <button on:click={handleExportPng} title="Export battlefield as PNG image">Export PNG</button>
          <button on:click={() => saveState($loadedTerrain)}>Save to Browser</button>
          <button on:click={() => { restoreState(); selectedModelIds = []; }}>Restore from Browser</button>
          <button class="secondary" on:click={handleClearAll}>Clear All Models</button>
        </div>
      </CollapsibleSection>

            <!-- Army Import -->
      <CollapsibleSection title="Import Army List" startOpen={false}>
        <ArmyImportPanel
          bind:this={importPanelRef}
          {currentPlayer}
          on:parse={handleArmyListParse}
        />
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

            <!-- Territory divider (attacker/defender halves) -->
            {#if $selectedDeployment.territory}
              <line
                x1={$selectedDeployment.territory.x1}
                y1={$selectedDeployment.territory.y1}
                x2={$selectedDeployment.territory.x2}
                y2={$selectedDeployment.territory.y2}
                stroke={COLORS.territory.line}
                stroke-width="0.1"
                stroke-dasharray="1.5,0.75"
                pointer-events="none"
              />
            {/if}

            <!-- Objectives -->
            {#each $selectedDeployment.objectives as obj}
              {@const markerColor = obj.isPrimary ? COLORS.objective.primary : COLORS.objective.secondary}
              <circle
                cx={obj.x}
                cy={obj.y}
                r={OBJECTIVE_RADIUS}
                fill={markerColor}
                stroke={COLORS.ui.black}
                stroke-width="0.06"
                pointer-events="none"
              />
              <circle
                cx={obj.x}
                cy={obj.y}
                r="0.15"
                fill={COLORS.ui.black}
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
                    fill={COLORS.player1.zone}
                    stroke={COLORS.player1.fillLight}
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
                    fill={COLORS.player1.zone}
                    stroke={COLORS.player1.fillLight}
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
                  fill={COLORS.player1.zone}
                  stroke={COLORS.player1.fillLight}
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
                    fill={COLORS.player2.zone}
                    stroke={COLORS.player2.fillLight}
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
                    fill={COLORS.player2.zone}
                    stroke={COLORS.player2.fillLight}
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
                  fill={COLORS.player2.zone}
                  stroke={COLORS.player2.fillLight}
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
                fill={COLORS.terrain.fillReadonly}
                stroke={COLORS.terrain.stroke}
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
          <!-- Range zone visualization (6", 9", and 12" zones) -->
          <RangeZones
            models={$models}
            {show6InchZone}
            {show9InchZone}
            {show12InchZone}
          />

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

          <!-- Group rotation handle (when multiple models selected) -->
          {#if groupCenter && selectedModels.length > 1}
            <!-- Center marker -->
            <circle
              cx={groupCenter.x}
              cy={groupCenter.y}
              r="0.4"
              fill={COLORS.selection.groupCenter}
              stroke={COLORS.selection.handle}
              stroke-width="0.1"
              pointer-events="none"
            />
            <!-- Line from center to handle -->
            <line
              x1={groupCenter.x}
              y1={groupCenter.y}
              x2={groupHandleX}
              y2={groupHandleY}
              stroke={COLORS.selection.handle}
              stroke-width="0.1"
              stroke-dasharray="0.3,0.15"
              pointer-events="none"
            />
            <!-- Rotation handle -->
            <circle
              cx={groupHandleX}
              cy={groupHandleY}
              r="0.8"
              fill={COLORS.selection.handle}
              stroke={COLORS.selection.handleDark}
              stroke-width="0.1"
              on:mousedown={handleGroupRotateMouseDown}
              role="button"
              tabindex="0"
              class="group-rotate-handle"
            />
            <!-- Rotate icon on handle -->
            <g transform="translate({groupHandleX}, {groupHandleY})" pointer-events="none">
              <path
                d="M -0.3 0 A 0.3 0.3 0 1 1 0.3 0"
                fill="none"
                stroke={COLORS.ui.white}
                stroke-width="0.08"
              />
              <path
                d="M 0.22 -0.15 L 0.3 0 L 0.15 0.08"
                fill="none"
                stroke={COLORS.ui.white}
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
                stroke={isSelected && lineToolActive ? COLORS.player1.primary : COLORS.measurement.line}
                stroke-width={isSelected && lineToolActive ? 0.2 : 0.15}
                stroke-linecap="round"
                on:click={(e) => lineToolActive && handleSelectLine(line.id, e)}
                on:mousedown={(e) => lineToolActive ? handleLineDragStart(line.id, e) : e.stopPropagation()}
                role={lineToolActive ? "button" : "presentation"}
                tabindex={lineToolActive ? 0 : -1}
              />
              <!-- End markers (only when tool is active) -->
              {#if lineToolActive}
                <circle
                  cx={line.x1}
                  cy={line.y1}
                  r="0.4"
                  fill={isSelected ? COLORS.player1.primary : COLORS.measurement.line}
                  stroke={COLORS.ui.black}
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
                  fill={isSelected ? COLORS.player1.primary : COLORS.measurement.line}
                  stroke={COLORS.ui.black}
                  stroke-width="0.05"
                  class="endpoint"
                  on:mousedown={(e) => handleEndpointDragStart(line.id, 2, e)}
                  role="button"
                  tabindex="0"
                />
              {/if}
              <!-- Length label -->
              <g transform="translate({midX}, {midY})">
                <rect
                  x="-2"
                  y="-0.6"
                  width="4"
                  height="1.2"
                  fill={COLORS.measurement.labelBg}
                  rx="0.3"
                  pointer-events="none"
                />
                <text
                  x="0"
                  y="0.35"
                  text-anchor="middle"
                  fill={isSelected && lineToolActive ? COLORS.player1.primary : COLORS.measurement.line}
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
                stroke={COLORS.measurement.line}
                stroke-width="0.15"
                stroke-dasharray="0.3,0.15"
                stroke-linecap="round"
                pointer-events="none"
              />
              <circle cx={lineDrawStart.x} cy={lineDrawStart.y} r="0.3" fill={COLORS.measurement.line} pointer-events="none" />
              <circle cx={lineDrawEnd.x} cy={lineDrawEnd.y} r="0.3" fill={COLORS.measurement.line} pointer-events="none" />
              {#if length > 0.5}
                <g transform="translate({midX}, {midY})">
                  <rect
                    x="-2"
                    y="-0.6"
                    width="4"
                    height="1.2"
                    fill={COLORS.measurement.labelBg}
                    rx="0.3"
                    pointer-events="none"
                  />
                  <text
                    x="0"
                    y="0.35"
                    text-anchor="middle"
                    fill={COLORS.measurement.line}
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

          <!-- Debug rays (render behind LoS lines) -->
          {#if showDebugRays && losVisualizationEnabled && selectedModels.length > 0 && losResults.length > 0}
            {#each losResults as result}
              {#each result.rays as ray}
                <line
                  x1={ray.from.x}
                  y1={ray.from.y}
                  x2={ray.to.x}
                  y2={ray.to.y}
                  stroke={ray.blocked ? COLORS.los.rayBlocked : COLORS.los.rayVisible}
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
                  stroke={COLORS.los.visible}
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
                  stroke={COLORS.los.blocked}
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
              fill={COLORS.player1.zone}
              stroke={COLORS.player1.primary}
              stroke-width="0.1"
              stroke-dasharray="0.3 0.2"
              pointer-events="none"
            />
          {/if}
        </Battlefield>
      </div>
        <div class="info">
          <p>Battlefield: 60" x 44" | {$player1Models.length} P1 models | {$player2Models.length} P2 models</p>
          <p class="hint">Drag to select | Ctrl+Click multi-select | Del remove | 1/2 player | L LoS | M measure</p>
        </div>
      </div>

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
    font-size: 0.8rem;
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

  /* Measurement line styles - these are global since they're in SVG */
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
