// Keep artwork and rig coordinates intact; allocate only displayed device pixels.
export const canvasResolution = scale => scale * Math.min(globalThis.devicePixelRatio, 2);

export function resizeSceneCanvas(app, canvas, width, height, scale) {
 const resolution = canvasResolution(scale);
 if (app.renderer.resolution !== resolution) {
  app.renderer.resize(width, height, resolution);
  // A resize clears the buffer, including when the scene is paused.
  app.renderer.render(app.stage);
 }
 canvas.style.width = `${width * scale}px`;
 canvas.style.height = `${height * scale}px`;
}
