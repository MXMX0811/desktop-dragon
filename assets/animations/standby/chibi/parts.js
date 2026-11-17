// Parts retain their integer position in the adopted 1254px artwork. Only the
// backing store is cropped; animation paths and joint coordinates stay intact.
export function createPart([x, y, width, height], paint) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d');
  context.translate(-x, -y);
  paint(context);
  return {canvas, x, y};
}

export function drawPart(context, part) {
  context.drawImage(part.canvas, part.x, part.y);
}

export function releasePart(part) {
  part.canvas.width = part.canvas.height = 0;
}
