// Calibrated against CrossPet's GPT materials and the actual production artwork.
// Still-image skin light anchors share RGB(253,244,240); video retains exposure.
// Lavender shadows retain their depth.
// Neutral black/white and alpha are preserved. Each scene uses one matrix for
// its whole action, including waiting and eye layers. See colors/README.txt.
const matrix = rows => [...rows[0], 0, 0, ...rows[1], 0, 0, ...rows[2], 0, 0, 0, 0, 0, 1, 0];
const readingChibi = matrix([
  [.986969207, .029319284, -.016288491],
  [.108452583, .880981688, .010565729],
  [.195409105, .185329514, .619261381],
]);
export const referenceMatrices = {
  // These sources already approach the reference palette. Keep their own
  // lavender wing anchor and neutral greys fixed while matching skin light.
  // Apply once after rendering; do not reuse standby's source-art transform.
  'drag-chibi': matrix([
    [.918057663, .062215478, .019726859],
    [.081942337, .937784522, -.019726859],
    [.163884674, -.124430956, .960546282],
  ]),
  'peek-chibi': matrix([
    [.902631579, .071052632, .026315789],
    [0, 1, 0],
    [-.292105263, .213157895, 1.078947368],
  ]),
  // Match the video's skin chroma while retaining its original exposure.
  'flight-chibi': matrix([
    [1, 0, 0],
    [.263605442, .829931973, -.093537415],
    [.790816327, -.510204082, .719387755],
  ]),
  'standby-chibi': matrix([
    [.983322034, .031132203, -.014454237],
    [.251900913, .796451630, -.048352542],
    [.687363755, -.283079009, .595715254],
  ]),
  'reading-chibi': readingChibi,
  'drawing-chibi': readingChibi,
  'work-chibi': readingChibi,
  'thinking-chibi': matrix([
    [.961719113, -.009961633, .048242520],
    [.083312798, .923650470, -.006963268],
    [.460309603, -.132260073, .671950470],
  ]),
  'reading-normal': matrix([
    [.914736990, .048420534, .036842476],
    [-.000997402, 1.003490906, -.002493504],
    [-.000997402, .003490906, .997506496],
  ]),
  'work-normal': matrix([
    [1.104762004, -.076191023, -.028570982],
    [.108352975, .904058635, -.012411611],
    [-.141647025, .279058635, .862588389],
  ]),
  'drawing-normal': matrix([
    [.894802703, .112622008, -.007424710],
    [.016424324, .960112355, .023463320],
    [.151559459, .060498456, .787942085],
  ]),
};

function palette(key) {
  const value = referenceMatrices[key];
  if (!value) throw new Error(`Unknown character palette: ${key}`);
  return value;
}

// Browser compositing applies one constant colour transform after the complete
// pose. No per-frame CPU pixel reads or per-part colour corrections are needed.
export function applyReferenceColor(canvas, key) {
  const values = palette(key), id = `dragon-reference-${key}`;
  if (!document.getElementById(id)) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.position = 'absolute';
    svg.style.pointerEvents = 'none';
    const filter = document.createElementNS(ns, 'filter');
    filter.setAttribute('id', id);
    filter.setAttribute('x', '0');
    filter.setAttribute('y', '0');
    filter.setAttribute('width', '100%');
    filter.setAttribute('height', '100%');
    filter.setAttribute('color-interpolation-filters', 'sRGB');
    const transform = document.createElementNS(ns, 'feColorMatrix');
    transform.setAttribute('type', 'matrix');
    transform.setAttribute('values', values.join(' '));
    filter.append(transform);
    svg.append(filter);
    document.body.append(svg);
  }
  canvas.style.filter = `url(#${id})`;
}

// Exported review frames must contain the same colour as the displayed canvas:
// drawImage alone does not capture CSS filters. Only export uses CPU pixels.
export function gradePixels(pixels, key) {
  const m = palette(key);
  for (let i = 0; i < pixels.length; i += 4) {
    if (!pixels[i + 3]) continue;
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    pixels[i] = m[0] * r + m[1] * g + m[2] * b;
    pixels[i + 1] = m[5] * r + m[6] * g + m[7] * b;
    pixels[i + 2] = m[10] * r + m[11] * g + m[12] * b;
  }
  return pixels;
}

export function drawReferenceFrame(ctx, source, x, y, width, height, key) {
  palette(key);
  const frame = document.createElement('canvas');
  frame.width = Math.ceil(width);
  frame.height = Math.ceil(height);
  const paint = frame.getContext('2d');
  paint.drawImage(source, 0, 0, frame.width, frame.height);
  const image = paint.getImageData(0, 0, frame.width, frame.height);
  gradePixels(image.data, key);
  paint.putImageData(image, 0, 0);
  ctx.drawImage(frame, x, y, width, height);
}
