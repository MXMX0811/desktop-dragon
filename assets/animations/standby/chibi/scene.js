import {loadArt, drawPet} from './renderer.js';

// The shared scene renders the adopted wake gesture and its two resting
// poses. Its caller owns the clock, events, and pause/visibility lifecycle.
export const SOURCE_SIZE = 1414;
export const REFERENCE_HEIGHT = 1200;

export async function createScene({canvas}) {
  let art = await loadArt();
  const context = canvas.getContext('2d');
  return {
    resize(size) {
      const side = SOURCE_SIZE * size / REFERENCE_HEIGHT;
      const pixels = Math.ceil(side * Math.min(window.devicePixelRatio, 2));
      canvas.width = canvas.height = pixels;
      canvas.style.width = canvas.style.height = `${side}px`;
      context.setTransform(pixels / SOURCE_SIZE, 0, 0, pixels / SOURCE_SIZE, 0, 0);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
    },
    render(pose) { drawPet(context, art, pose); },
    destroy() {
      art = null;
      canvas.width = canvas.height = 0;
    },
  };
}
