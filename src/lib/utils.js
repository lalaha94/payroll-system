import { clsx } from 'clsx';

/**
 * Combines multiple class names in a way that handles conflicts properly
 * This can still be useful with MUI
 */
export function cn(...inputs) {
  return clsx(inputs);
}
