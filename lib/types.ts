export type RecipeIngredient = { name: string; measure: string };
export type MealSummary = { id: string; name: string; image: string };
export type MealDetail = MealSummary & {
  category: string;
  area: string;
  instructions: string;
  youtube: string | null;
  ingredients: RecipeIngredient[];
};
export type RecipeMatch = MealDetail & {
  matchedIngredients: RecipeIngredient[];
  missingIngredients: RecipeIngredient[];
  totalRecipeIngredients: number;
  matchPercentage: number;
  candidateOverlap: number;
};
export type Macros = {
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
};
export type NutritionIngredientResult = {
  name: string;
  grams: number;
  matchedFood: string;
  values: Macros;
};
export type NutritionResult = {
  status: "available" | "unavailable";
  message: string;
  totals: Macros | null;
  included: NutritionIngredientResult[];
  excluded: { name: string; reason: string }[];
};
