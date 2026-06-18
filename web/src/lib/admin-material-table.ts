export function materialCostLabel(material: {
  durationSeconds: number;
  creditsPerSecond: number;
  costCredits: number;
}) {
  return `${material.costCredits} 分/次`;
}
