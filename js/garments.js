// ============================================================================
// GARMENT CONFIG
// ----------------------------------------------------------------------------
// This is the ONLY file you need to touch to add a new garment type manually.
// Each garment has:
//   label   - shown in the UI picker
//   outline - a single closed path (flat-lay silhouette) shared by the 2D
//             canvas AND the 3D preview, so both always match.
//   zone    - the printable "design area" rectangle (where text/images sit)
//
// Path format: array of segments, each one of:
//   ['M', x, y]           move to
//   ['L', x, y]           line to
//   ['Q', cx, cy, x, y]    quadratic curve to
//   ['Z']                  close path
// Coordinates live in a 400 x 520 box (VIEW_W x VIEW_H below).
// ============================================================================

export const VIEW_W = 400;
export const VIEW_H = 520;

export const GARMENTS = {
  tshirt: {
    label: 'T-Shirt',
    outline: [
      ['M', 130, 480], ['L', 130, 140], ['L', 90, 140], ['L', 55, 70],
      ['L', 150, 45], ['Q', 200, 70, 250, 45], ['L', 345, 70],
      ['L', 310, 140], ['L', 270, 140], ['L', 270, 480], ['Z']
    ],
    zone: { x: 150, y: 150, w: 100, h: 120 }
  },

  hoodie: {
    label: 'Hoodie',
    outline: [
      ['M', 130, 480], ['L', 130, 170], ['L', 85, 170], ['L', 50, 80],
      ['Q', 90, 55, 130, 50], ['Q', 140, 10, 200, 5], ['Q', 260, 10, 270, 50],
      ['Q', 310, 55, 350, 80], ['L', 315, 170], ['L', 270, 170],
      ['L', 270, 480], ['Z']
    ],
    zone: { x: 150, y: 195, w: 100, h: 115 }
  },

  tank: {
    label: 'Tank Top',
    outline: [
      ['M', 155, 480], ['L', 155, 80], ['Q', 155, 50, 175, 45],
      ['L', 200, 60], ['L', 225, 45], ['Q', 245, 50, 245, 80],
      ['L', 245, 480], ['Z']
    ],
    zone: { x: 162, y: 150, w: 76, h: 130 }
  },

  longsleeve: {
    label: 'Long Sleeve',
    outline: [
      ['M', 130, 480], ['L', 130, 150], ['L', 80, 150], ['L', 40, 175],
      ['L', 58, 395], ['L', 102, 410], ['L', 120, 195], ['L', 150, 45],
      ['Q', 200, 70, 250, 45], ['L', 280, 195], ['L', 298, 410],
      ['L', 342, 395], ['L', 360, 175], ['L', 320, 150], ['L', 270, 150],
      ['L', 270, 480], ['Z']
    ],
    zone: { x: 150, y: 195, w: 100, h: 115 }
  },

  polo: {
    label: 'Polo',
    outline: [
      ['M', 130, 480], ['L', 130, 140], ['L', 90, 140], ['L', 55, 70],
      ['L', 150, 45], ['L', 180, 75], ['L', 200, 55], ['L', 220, 75],
      ['L', 250, 45], ['L', 345, 70], ['L', 310, 140], ['L', 270, 140],
      ['L', 270, 480], ['Z']
    ],
    zone: { x: 150, y: 165, w: 100, h: 105 }
  }
};

// Trace a path onto a 2D canvas context
export function tracePath2D(ctx, segments) {
  ctx.beginPath();
  for (const seg of segments) {
    const [cmd, ...p] = seg;
    if (cmd === 'M') ctx.moveTo(p[0], p[1]);
    else if (cmd === 'L') ctx.lineTo(p[0], p[1]);
    else if (cmd === 'Q') ctx.quadraticCurveTo(p[0], p[1], p[2], p[3]);
    else if (cmd === 'Z') ctx.closePath();
  }
}

// Trace the same path into a THREE.Shape (used by scene3d.js)
export function traceThreeShape(THREE, segments) {
  const shape = new THREE.Shape();
  for (const seg of segments) {
    const [cmd, ...p] = seg;
    if (cmd === 'M') shape.moveTo(p[0], -p[1]);
    else if (cmd === 'L') shape.lineTo(p[0], -p[1]);
    else if (cmd === 'Q') shape.quadraticCurveTo(p[0], -p[1], p[2], -p[3]);
    else if (cmd === 'Z') shape.closePath();
  }
  return shape;
}
