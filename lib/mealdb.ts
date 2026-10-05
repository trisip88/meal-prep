import "server-only";
import type { MealDetail, MealSummary } from "./types";
import {
  matchRecipe,
  normalizeIngredient,
  rankMatches,
} from "./ingredientMatcher";
const BASE = "https://www.themealdb.com/api/json/v1/1/";
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid provider response");
  return value as Record<string, unknown>;
}
function string(row: Record<string, unknown>, key: string): string {
  return typeof row[key] === "string" ? row[key].trim() : "";
}
function summary(value: unknown): MealSummary {
  const row = record(value);
  const id = string(row, "idMeal"),
    name = string(row, "strMeal"),
    image = string(row, "strMealThumb");
  if (!/^\d+$/.test(id) || !name) throw new Error("Invalid meal");
  const safeImage =
    /^https:\/\/www\.themealdb\.com\/images\/media\/meals\//.test(image)
      ? image
      : "";
  return { id, name, image: safeImage };
}
async function request(endpoint: string): Promise<unknown[]> {
  const response = await fetch(BASE + endpoint, {
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("TheMealDB unavailable");
  const json = record(await response.json());
  if (json.meals === null) return [];
  if (!Array.isArray(json.meals)) throw new Error("Invalid provider response");
  return json.meals;
}
export async function getIngredients(): Promise<string[]> {
  return (await request("list.php?i=list"))
    .map((v) => string(record(v), "strIngredient"))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}
export async function getMeal(id: string): Promise<MealDetail | null> {
  if (!/^\d{1,10}$/.test(id)) return null;
  const values = await request(`lookup.php?i=${id}`);
  if (!values.length) return null;
  const row = record(values[0]);
  const ingredients = [];
  for (let i = 1; i <= 20; i++) {
    const name = string(row, `strIngredient${i}`);
    if (name)
      ingredients.push({ name, measure: string(row, `strMeasure${i}`) });
  }
  const youtube = string(row, "strYoutube");
  return {
    ...summary(row),
    category: string(row, "strCategory"),
    area: string(row, "strArea"),
    instructions: string(row, "strInstructions"),
    ingredients,
    youtube: /^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(youtube)
      ? youtube
      : null,
  };
}
export async function mapConcurrent<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (index < items.length) {
        const i = index++;
        results[i] = await fn(items[i]);
      }
    }),
  );
  return results;
}
export async function searchMeals(ingredients: string[]) {
  // Provider filters require catalogue names, while matching uses normalized aliases.
  const catalogue = new Map<string, string>();
  try {
    for (const name of await getIngredients()) {
      const normalized = normalizeIngredient(name);
      if (!catalogue.has(normalized)) catalogue.set(normalized, name);
    }
  } catch {
    // Catalogue failure must not prevent searches with explicitly typed names.
  }

  const searches = await mapConcurrent(ingredients, 4, async (ingredient) => {
    try {
      return {
        ok: true,
        meals: (
          await request(
            `filter.php?i=${encodeURIComponent((catalogue.get(normalizeIngredient(ingredient)) ?? ingredient).replace(/ /g, "_"))}`,
          )
        ).map(summary),
      };
    } catch {
      return { ok: false, meals: [] };
    }
  });
  if (searches.every((s) => !s.ok))
    throw new Error("TheMealDB is temporarily unavailable. Please try again.");
  const candidates = new Map<string, number>();
  for (const search of searches)
    for (const id of new Set(search.meals.map((m) => m.id)))
      candidates.set(id, (candidates.get(id) ?? 0) + 1);
  const strongest = [...candidates]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 25);
  let failedDetails = 0;
  const details = await mapConcurrent(strongest, 5, async ([id, overlap]) => {
    try {
      const meal = await getMeal(id);
      if (!meal) {
        failedDetails++;
        return null;
      }
      return matchRecipe(meal, ingredients, overlap);
    } catch {
      failedDetails++;
      return null;
    }
  });
  if (strongest.length && failedDetails === strongest.length)
    throw new Error("TheMealDB is temporarily unavailable. Please try again.");
  return {
    recipes: details.filter((v) => v !== null).sort(rankMatches),
    candidateCount: candidates.size,
    warning:
      searches.some((s) => !s.ok) || failedDetails
        ? "Some recipes could not be loaded. Results may be incomplete; please try again."
        : null,
  };
}
