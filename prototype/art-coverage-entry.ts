/**
 * Entry point for the silhouette coverage harness.
 *
 * Re-exports the shipped renderers so the harness imports the same code the
 * browser bundle uses, rather than a copy of it.
 */
export { drawFood, drawFoodIcon, donenessColors } from './src/foods.ts';
