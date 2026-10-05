import type { Macros, NutritionResult, RecipeIngredient } from "./types";
import { parseWeightInGrams } from "./measurementParser";
export function parseNutritionResponse(raw: unknown): {
  food: string;
  values: Macros;
} {
  if (!raw || typeof raw !== "object") throw new Error("Invalid nutrition");
  const envelope = raw as Record<string, unknown>;
  if (
    envelope.status !== "ok" ||
    envelope.error ||
    !envelope.data ||
    typeof envelope.data !== "object"
  )
    throw new Error("Invalid nutrition");
  const data = envelope.data as Record<string, unknown>;
  if (
    data.basis !== "per 100g" ||
    typeof data.food !== "string" ||
    !data.food.trim() ||
    !data.nutrition ||
    typeof data.nutrition !== "object"
  )
    throw new Error("Unknown nutrition basis");
  const n = data.nutrition as Record<string, unknown>;
  const fields = ["calories", "protein", "carbohydrates", "totalFat"];
  if (
    fields.some(
      (f) =>
        typeof n[f] !== "number" ||
        !Number.isFinite(n[f]) ||
        (n[f] as number) < 0,
    )
  )
    throw new Error("Missing nutrition fields");
  return {
    food: data.food,
    values: {
      calories: n.calories as number,
      protein: n.protein as number,
      carbohydrates: n.carbohydrates as number,
      fat: n.totalFat as number,
    },
  };
}
export async function aggregateNutrition(
  ingredients: RecipeIngredient[],
  lookup: (name: string) => Promise<{ food: string; values: Macros }>,
): Promise<NutritionResult> {
  const included: NutritionResult["included"] = [],
    excluded: NutritionResult["excluded"] = [];
  const pending = new Map<string, Promise<{ food: string; values: Macros }>>();
  // Sequential requests keep a recipe's provider usage bounded and avoid bursts.
  for (const ingredient of ingredients) {
    const grams = parseWeightInGrams(ingredient.measure);
    if (grams === null) {
      excluded.push({
        name: ingredient.name,
        reason: "Quantity cannot be reliably converted to weight.",
      });
      continue;
    }
    try {
      const key = ingredient.name.toLowerCase();
      if (!pending.has(key)) pending.set(key, lookup(ingredient.name));
      const data = await pending.get(key)!;
      const values = Object.fromEntries(
        Object.entries(data.values).map(([k, v]) => [k, (v * grams) / 100]),
      ) as Macros;
      included.push({
        name: ingredient.name,
        grams,
        matchedFood: data.food,
        values,
      });
    } catch {
      excluded.push({
        name: ingredient.name,
        reason: "Nutrition data unavailable.",
      });
    }
  }
  if (!included.length)
    return {
      status: "unavailable",
      message: "Nutrition information unavailable.",
      totals: null,
      included,
      excluded,
    };
  const totals: Macros = { calories: 0, protein: 0, carbohydrates: 0, fat: 0 };
  for (const item of included)
    for (const key of Object.keys(totals) as (keyof Macros)[])
      totals[key] += item.values[key];
  return {
    status: "available",
    message:
      "Nutrition values are estimates based on available recipe quantities and nutrition API data.",
    totals,
    included,
    excluded,
  };
}
