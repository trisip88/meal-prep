import "server-only";
import { aggregateNutrition, parseNutritionResponse } from "./nutrition";
import type { NutritionResult, RecipeIngredient } from "./types";
export async function getNutrition(
  ingredients: RecipeIngredient[],
): Promise<NutritionResult> {
  const apiKey = process.env.APIVERVE_API_KEY;
  if (!apiKey)
    return {
      status: "unavailable",
      message: "Nutrition information unavailable.",
      totals: null,
      included: [],
      excluded: ingredients.map((i) => ({
        name: i.name,
        reason: "Nutrition service is not configured.",
      })),
    };
  const deadline = Date.now() + 20000;
  return aggregateNutrition(ingredients, async (name) => {
    if (Date.now() >= deadline) throw new Error("Nutrition timeout");
    const url = new URL("https://api.apiverve.com/v1/nutrition");
    url.searchParams.set("food", name);
    // No premium grams parameter: explicitly validate per-100g basis and scale locally.
    const response = await fetch(url, {
      headers: { "x-api-key": apiKey },
      cache: "no-store",
      signal: AbortSignal.timeout(Math.min(5000, deadline - Date.now())),
    });
    if (!response.ok) throw new Error("Nutrition service unavailable");
    return parseNutritionResponse(await response.json());
  });
}
