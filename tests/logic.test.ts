import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeIngredient,
  validateIngredients,
  matchRecipe,
  rankMatches,
} from "../lib/ingredientMatcher";
import { parseWeightInGrams } from "../lib/measurementParser";
import { aggregateNutrition, parseNutritionResponse } from "../lib/nutrition";
import { searchMeals } from "../lib/mealdb";
import { getNutrition } from "../lib/apiverve";
import type { MealDetail } from "../lib/types";
const meal: MealDetail = {
  id: "1",
  name: "Test recipe",
  image: "",
  category: "",
  area: "",
  instructions: "Original",
  youtube: null,
  ingredients: [
    { name: "Chicken Breast", measure: "300g" },
    { name: "Potatoes", measure: "250 g" },
    { name: "Garlic", measure: "2 cloves" },
    { name: "Coconut Milk", measure: "1 cup" },
  ],
};
test("conservative normalization and input validation", () => {
  assert.equal(normalizeIngredient(" Chicken_Breast "), "chicken breast");
  assert.equal(normalizeIngredient("potatoes"), "potato");
  assert.notEqual(
    normalizeIngredient("chicken stock"),
    normalizeIngredient("chicken"),
  );
  assert.deepEqual(validateIngredients([" Potato ", "potatoes"]), ["potato"]);
  assert.throws(() => validateIngredients([]));
  assert.throws(() => validateIngredients(["chicken,potato"]));
  assert.throws(() => validateIngredients(Array(13).fill("egg")));
});
test("matching, missing ingredients, ranking and empty ingredients", () => {
  const match = matchRecipe(meal, ["chicken_breast", "potato", "garlic"]);
  assert.equal(match.matchPercentage, 75);
  assert.equal(match.matchedIngredients.length, 3);
  assert.deepEqual(
    match.missingIngredients.map((i) => i.name),
    ["Coconut Milk"],
  );
  assert.ok(rankMatches(match, matchRecipe(meal, ["garlic"])) < 0);
  assert.equal(
    matchRecipe({ ...meal, ingredients: [] }, []).matchPercentage,
    0,
  );
});
test("weight conversions and ambiguous quantities", () => {
  for (const [text, expected] of [
    ["300g", 300],
    ["250 g", 250],
    ["1 kg", 1000],
    ["500 mg", 0.5],
    ["4 oz", 113.3980925],
    ["1 lb", 453.59237],
    ["1/2 kg", 500],
    ["1 1/2 lb", 680.388555],
    ["½ kg", 500],
  ] as const)
    assert.ok(Math.abs(parseWeightInGrams(text)! - expected) < 0.000001, text);
  for (const text of [
    "1 cup",
    "2 tbsp",
    "1 tsp",
    "2 cloves",
    "1 onion",
    "300g or more",
    "100-200g",
    "0g",
    "1/0 kg",
    "2 x 400g cans",
  ])
    assert.equal(parseWeightInGrams(text), null, text);
});
const provider = {
  status: "ok",
  error: null,
  data: {
    food: "Provider fixture",
    basis: "per 100g",
    nutrition: { calories: 100, protein: 10, carbohydrates: 20, totalFat: 3 },
  },
};
test("nutrition response validates basis and required numeric fields", () => {
  assert.equal(parseNutritionResponse(provider).values.fat, 3);
  assert.throws(() => parseNutritionResponse({ ...provider, status: "error" }));
  assert.throws(() =>
    parseNutritionResponse({
      ...provider,
      data: { ...provider.data, basis: "per serving" },
    }),
  );
  assert.throws(() =>
    parseNutritionResponse({
      ...provider,
      data: { ...provider.data, nutrition: { calories: 0 } },
    }),
  );
});
test("nutrition scaling, aggregation and failures", async () => {
  const result = await aggregateNutrition(meal.ingredients, async () =>
    parseNutritionResponse(provider),
  );
  assert.equal(result.totals?.calories, 550);
  assert.equal(result.totals?.protein, 55);
  assert.equal(result.excluded.length, 2);
  const failure = await aggregateNutrition(meal.ingredients, async () => {
    throw Error("timeout");
  });
  assert.equal(failure.status, "unavailable");
  assert.equal(failure.totals, null);
});
test("missing API key is graceful", async () => {
  const original = process.env.APIVERVE_API_KEY;
  delete process.env.APIVERVE_API_KEY;
  try {
    assert.equal((await getNutrition(meal.ingredients)).status, "unavailable");
  } finally {
    if (original) process.env.APIVERVE_API_KEY = original;
  }
});
test("separate filters, deduplication, 25 lookup cap and ranking", async () => {
  const original = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    urls.push(url);
    const parsed = new URL(url);
    if (parsed.pathname.endsWith("list.php"))
      return Response.json({
        meals: [
          { strIngredient: "Potatoes" },
          { strIngredient: "Chicken Breast" },
          { strIngredient: "Garlic" },
        ],
      });
    if (parsed.pathname.endsWith("filter.php"))
      return Response.json({
        meals: Array.from({ length: 35 }, (_, i) => ({
          idMeal: String(i + 1),
          strMeal: `Meal ${i + 1}`,
          strMealThumb: "",
        })),
      });
    const id = parsed.searchParams.get("i")!;
    return Response.json({
      meals: [
        {
          idMeal: id,
          strMeal: `Meal ${id}`,
          strIngredient1: "Chicken Breast",
          strMeasure1: "300g",
          strIngredient2: "Garlic",
          strMeasure2: "2 cloves",
        },
      ],
    });
  };
  try {
    const result = await searchMeals(["chicken breast", "potato", "garlic"]);
    assert.equal(urls.filter((u) => u.includes("filter.php")).length, 3);
    assert.ok(
      urls
        .filter((u) => u.includes("filter.php"))
        .every((u) => !new URL(u).searchParams.get("i")?.includes(",")),
    );
    const lookups = urls.filter((u) => u.includes("lookup.php"));
    assert.ok(
      urls.some(
        (u) =>
          u.includes("filter.php") &&
          new URL(u).searchParams.get("i") === "Potatoes",
      ),
    );
    assert.equal(lookups.length, 25);
    assert.equal(new Set(lookups).size, 25);
    assert.equal(result.candidateCount, 35);
    assert.equal(result.recipes[0].matchPercentage, 100);
    assert.equal(result.recipes[0].candidateOverlap, 3);
  } finally {
    globalThis.fetch = original;
  }
});
test("empty results and provider outage", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({ meals: null });
    assert.deepEqual((await searchMeals(["nonexistent"])).recipes, []);
    globalThis.fetch = async () => {
      throw Error("offline");
    };
    await assert.rejects(() => searchMeals(["salmon"]));
  } finally {
    globalThis.fetch = original;
  }
});
