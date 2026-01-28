/**
 * Touch detection and mobile utilities
 */

/**
 * Detect if the device has touch capability
 * @returns {boolean}
 */
export function isTouchDevice() {
  if (typeof window === 'undefined') return false;
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    // @ts-ignore - msMaxTouchPoints for older IE/Edge
    navigator.msMaxTouchPoints > 0
  );
}

/**
 * Detect if we're on a mobile viewport (<=768px width)
 * @returns {boolean}
 */
export function isMobile() {
  if (typeof window === 'undefined') return false;
  return window.innerWidth <= 768;
}

/**
 * Check if the device is likely a mobile device based on user agent
 * More reliable than viewport size for actual device detection
 * @returns {boolean}
 */
export function isMobileDevice() {
  if (typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

/**
 * Create a reactive mobile state that updates on resize
 * Usage: const mobile = createMobileState();
 * Then access: $mobile for current value
 * @returns {import('svelte/store').Writable<boolean>}
 */
export function createMobileState() {
  const { writable } = require('svelte/store');
  const store = writable(isMobile());

  if (typeof window !== 'undefined') {
    const updateMobile = () => store.set(isMobile());
    window.addEventListener('resize', updateMobile);
  }

  return store;
}

/**
 * Mobile breakpoint constant
 */
export const MOBILE_BREAKPOINT = 768;
