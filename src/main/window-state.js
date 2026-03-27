const DEFAULT_MIN_WIDTH = 1100;
const DEFAULT_MIN_HEIGHT = 700;
const DEFAULT_WIDTH_RATIO = 0.92;
const DEFAULT_HEIGHT_RATIO = 0.9;

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function normalizeBounds(bounds = {}) {
    const normalized = {
        x: Number(bounds.x),
        y: Number(bounds.y),
        width: Number(bounds.width),
        height: Number(bounds.height),
    };

    if (!Number.isFinite(normalized.width) || !Number.isFinite(normalized.height)) {
        return null;
    }

    if (!Number.isFinite(normalized.x)) normalized.x = 0;
    if (!Number.isFinite(normalized.y)) normalized.y = 0;
    return normalized;
}

function computeDefaultBounds(workArea = {}) {
    const workWidth = Math.max(DEFAULT_MIN_WIDTH, Number(workArea.width) || DEFAULT_MIN_WIDTH);
    const workHeight = Math.max(DEFAULT_MIN_HEIGHT, Number(workArea.height) || DEFAULT_MIN_HEIGHT);
    const width = clamp(Math.floor(workWidth * DEFAULT_WIDTH_RATIO), DEFAULT_MIN_WIDTH, workWidth);
    const height = clamp(Math.floor(workHeight * DEFAULT_HEIGHT_RATIO), DEFAULT_MIN_HEIGHT, workHeight);
    const x = Math.max(Number(workArea.x) || 0, Math.floor((workWidth - width) / 2) + (Number(workArea.x) || 0));
    const y = Math.max(Number(workArea.y) || 0, Math.floor((workHeight - height) / 2) + (Number(workArea.y) || 0));

    return { x, y, width, height };
}

function isUsableBounds(bounds, workArea = {}) {
    const normalized = normalizeBounds(bounds);
    if (!normalized) return false;
    if (normalized.width < DEFAULT_MIN_WIDTH || normalized.height < DEFAULT_MIN_HEIGHT) return false;

    const workX = Number(workArea.x) || 0;
    const workY = Number(workArea.y) || 0;
    const workWidth = Math.max(DEFAULT_MIN_WIDTH, Number(workArea.width) || DEFAULT_MIN_WIDTH);
    const workHeight = Math.max(DEFAULT_MIN_HEIGHT, Number(workArea.height) || DEFAULT_MIN_HEIGHT);
    const margin = 80;

    const visibleHorizontally = normalized.x < (workX + workWidth - margin) && (normalized.x + margin) > workX;
    const visibleVertically = normalized.y < (workY + workHeight - margin) && (normalized.y + margin) > workY;

    return visibleHorizontally && visibleVertically;
}

function resolveInitialWindowState({ savedState = null, workArea = {} } = {}) {
    const fallbackBounds = computeDefaultBounds(workArea);
    const hasSavedState = !!savedState && typeof savedState === 'object';
    const savedBounds = normalizeBounds(savedState?.bounds);
    const useSavedBounds = hasSavedState && isUsableBounds(savedBounds, workArea);
    const hasExplicitMaximizedFlag = typeof savedState?.isMaximized === 'boolean';

    return {
        bounds: useSavedBounds ? savedBounds : fallbackBounds,
        maximize: hasExplicitMaximizedFlag ? savedState.isMaximized : true,
        hasSavedState,
    };
}

function serializeWindowState({ bounds = null, isMaximized = false } = {}) {
    const normalizedBounds = normalizeBounds(bounds);
    if (!normalizedBounds) {
        return { bounds: null, isMaximized: !!isMaximized };
    }

    return {
        bounds: normalizedBounds,
        isMaximized: !!isMaximized,
        savedAt: new Date().toISOString(),
    };
}

module.exports = {
    DEFAULT_MIN_WIDTH,
    DEFAULT_MIN_HEIGHT,
    computeDefaultBounds,
    isUsableBounds,
    resolveInitialWindowState,
    serializeWindowState,
};
