import type { MealDetail, RecipeMatch } from "./types";
// Deliberately conservative aliases: chicken is not chicken breast, and stock is not meat.
const plurals: Record<string, string> = {
  potatoes: "potato",
  tomatoes: "tomato",
  onions: "onion",
  eggs: "egg",
  carrots: "carrot",
  mushrooms: "mushroom",
  lemons: "lemon",
  limes: "lime",
  "chicken breasts": "chicken breast",
  "garlic cloves": "garlic",
  "garlic clove": "garlic",
  "cloves of garlic": "garlic",
  "clove of garlic": "garlic",
};
export function normalizeIngredient(value: string): string {
  const clean = value
    .toLowerCase()
    .replace(/_/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  return plurals[clean] ?? clean;
}
export function validateIngredients(value: unknown): string[] {
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > 12 ||
    value.some(
      (i) =>
        typeof i !== "string" ||
        !i.trim() ||
        i.length > 100 ||
        /[,\n\r]/.test(i),
    )
  )
    throw new Error(
      "Enter 1–12 ingredients, each no longer than 100 characters.",
    );
  return [...new Set(value.map(normalizeIngredient))];
}
export function matchRecipe(
  meal: MealDetail,
  available: string[],
  candidateOverlap = 0,
): RecipeMatch {
  const pantry = new Set(available.map(normalizeIngredient));
  const matchedIngredients = meal.ingredients.filter((i) =>
    pantry.has(normalizeIngredient(i.name)),
  );
  const missingIngredients = meal.ingredients.filter(
    (i) => !pantry.has(normalizeIngredient(i.name)),
  );
  return {
    ...meal,
    matchedIngredients,
    missingIngredients,
    totalRecipeIngredients: meal.ingredients.length,
    matchPercentage: meal.ingredients.length
      ? (matchedIngredients.length / meal.ingredients.length) * 100
      : 0,
    candidateOverlap,
  };
}
export function rankMatches(a: RecipeMatch, b: RecipeMatch): number {
  return (
    b.matchPercentage - a.matchPercentage ||
    a.missingIngredients.length - b.missingIngredients.length ||
    b.matchedIngredients.length - a.matchedIngredients.length ||
    b.candidateOverlap - a.candidateOverlap ||
    a.name.localeCompare(b.name)
  );
}
