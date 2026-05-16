export const ONBOARDING_Z_INDEX = {
  overlay: 260,
  spotlight: 262,
  tooltip: 264,
};

const DEFAULT_MARGIN = 16;
const DEFAULT_GAP = 18;

function clamp(value, min, max) {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

function rectCenter(rect) {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

function getViewportCenterPosition({ viewportWidth, viewportHeight, popoverWidth, popoverHeight, margin }) {
  return {
    placement: 'center',
    left: clamp((viewportWidth - popoverWidth) / 2, margin, viewportWidth - popoverWidth - margin),
    top: clamp((viewportHeight - popoverHeight) / 2, margin, viewportHeight - popoverHeight - margin),
    arrow: null,
  };
}

export function calculateOnboardingPopoverPosition({
  targetRect,
  viewportWidth,
  viewportHeight,
  popoverWidth,
  popoverHeight,
  margin = DEFAULT_MARGIN,
  gap = DEFAULT_GAP,
  preferredPlacements = ['right', 'left', 'bottom', 'top'],
}) {
  const safeWidth = Math.min(popoverWidth || 360, Math.max(viewportWidth - margin * 2, 0));
  const safeHeight = Math.min(popoverHeight || 280, Math.max(viewportHeight - margin * 2, 0));

  if (!targetRect || !viewportWidth || !viewportHeight) {
    return getViewportCenterPosition({
      viewportWidth: viewportWidth || 390,
      viewportHeight: viewportHeight || 800,
      popoverWidth: safeWidth,
      popoverHeight: safeHeight,
      margin,
    });
  }

  const spaces = {
    right: viewportWidth - margin - targetRect.right - gap,
    left: targetRect.left - margin - gap,
    bottom: viewportHeight - margin - targetRect.bottom - gap,
    top: targetRect.top - margin - gap,
  };

  const fits = {
    right: spaces.right >= safeWidth,
    left: spaces.left >= safeWidth,
    bottom: spaces.bottom >= safeHeight,
    top: spaces.top >= safeHeight,
  };

  const horizontalFits = preferredPlacements.find((placement) => (
    (placement === 'right' || placement === 'left') && fits[placement]
  ));
  const verticalFits = preferredPlacements.find((placement) => (
    (placement === 'top' || placement === 'bottom') && fits[placement]
  ));

  let placement = horizontalFits || verticalFits || null;

  if (!placement) {
    return getViewportCenterPosition({
      viewportWidth,
      viewportHeight,
      popoverWidth: safeWidth,
      popoverHeight: safeHeight,
      margin,
    });
  }

  const center = rectCenter(targetRect);
  let left = margin;
  let top = margin;

  if (placement === 'right') {
    left = targetRect.right + gap;
    top = clamp(center.y - safeHeight / 2, margin, viewportHeight - safeHeight - margin);
  } else if (placement === 'left') {
    left = targetRect.left - safeWidth - gap;
    top = clamp(center.y - safeHeight / 2, margin, viewportHeight - safeHeight - margin);
  } else if (placement === 'top') {
    left = clamp(center.x - safeWidth / 2, margin, viewportWidth - safeWidth - margin);
    top = targetRect.top - safeHeight - gap;
  } else if (placement === 'bottom') {
    left = clamp(center.x - safeWidth / 2, margin, viewportWidth - safeWidth - margin);
    top = targetRect.bottom + gap;
  }

  const arrowSize = 12;
  const arrowInset = 22;
  let arrow = null;

  if (placement === 'right' || placement === 'left') {
    arrow = {
      left: placement === 'right' ? -arrowSize / 2 : safeWidth - arrowSize / 2,
      top: clamp(center.y - top - arrowSize / 2, arrowInset, safeHeight - arrowInset),
    };
  } else if (placement === 'top' || placement === 'bottom') {
    arrow = {
      left: clamp(center.x - left - arrowSize / 2, arrowInset, safeWidth - arrowInset),
      top: placement === 'bottom' ? -arrowSize / 2 : safeHeight - arrowSize / 2,
    };
  }

  return {
    placement,
    left,
    top,
    arrow,
  };
}
