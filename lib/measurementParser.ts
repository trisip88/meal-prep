/** Only complete, unambiguous weight measurements; no guessed densities or piece weights. */
export function parseWeightInGrams(measure: string): number | null {
  const fractions: Record<string, string> = {
    "½": "1/2",
    "¼": "1/4",
    "¾": "3/4",
    "⅓": "1/3",
    "⅔": "2/3",
  };
  const input = measure
    .trim()
    .toLowerCase()
    .replace(/[½¼¾⅓⅔]/g, (c) => ` ${fractions[c]}`)
    .replace(/\s+/g, " ")
    .trim();
  const match = input.match(
    /^(\d+(?:\.\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+)\s*(kg|kilograms?|g|grams?|mg|milligrams?|oz|ounces?|lb|lbs|pounds?)$/,
  );
  if (!match) return null;
  let amount = 0;
  for (const part of match[1].split(" ")) {
    const [a, b] = part.split("/").map(Number);
    amount += b === undefined ? a : a / b;
  }
  const unit = match[2];
  const factor = /^(kg|kilogram)/.test(unit)
    ? 1000
    : /^(mg|milligram)/.test(unit)
      ? 0.001
      : /^(oz|ounce)/.test(unit)
        ? 28.349523125
        : /^(lb|pound)/.test(unit)
          ? 453.59237
          : 1;
  const grams = amount * factor;
  return Number.isFinite(grams) && grams > 0 && grams <= 100000 ? grams : null;
}
