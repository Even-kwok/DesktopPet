export type NormalizedPixel = {
  red: number;
  green: number;
  blue: number;
  alpha: number;
};

const threshold = 0.15;
const softness = 0.16;
const edgeAlphaGamma = 1;
const despillThreshold = 0.02;
const despillStrength = 0.72;

export function chromaKeyPixel(pixel: NormalizedPixel): NormalizedPixel {
  const greenDominance = pixel.green - Math.max(pixel.red, pixel.blue);
  const keyAmount = smoothStep(threshold, threshold + softness, greenDominance);
  const alpha = pixel.alpha * Math.pow(1 - keyAmount, edgeAlphaGamma);
  const despillAmount =
    smoothStep(despillThreshold, threshold + softness, greenDominance) * despillStrength;
  const cleanGreen = Math.min(
    pixel.green,
    Math.max(pixel.red, pixel.blue) * 0.9 + Math.min(pixel.red, pixel.blue) * 0.1
  );

  return {
    red: pixel.red,
    green: mix(pixel.green, cleanGreen, despillAmount),
    blue: pixel.blue,
    alpha
  };
}

export function processChromaKeyFrame(frame: ImageData) {
  const data = frame.data;

  for (let offset = 0; offset < data.length; offset += 4) {
    const keyed = chromaKeyPixel({
      red: data[offset] / 255,
      green: data[offset + 1] / 255,
      blue: data[offset + 2] / 255,
      alpha: data[offset + 3] / 255
    });

    data[offset] = Math.round(keyed.red * 255);
    data[offset + 1] = Math.round(keyed.green * 255);
    data[offset + 2] = Math.round(keyed.blue * 255);
    data[offset + 3] = Math.round(keyed.alpha * 255);
  }

  return frame;
}

function smoothStep(edge0: number, edge1: number, value: number) {
  if (edge0 === edge1) {
    return value < edge0 ? 0 : 1;
  }

  const normalized = Math.min(Math.max((value - edge0) / (edge1 - edge0), 0), 1);
  return normalized * normalized * (3 - 2 * normalized);
}

function mix(start: number, end: number, amount: number) {
  return start + (end - start) * Math.min(Math.max(amount, 0), 1);
}
