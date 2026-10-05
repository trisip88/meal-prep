import { searchMeals } from "@/lib/mealdb";
import { validateIngredients } from "@/lib/ingredientMatcher";
export async function POST(request: Request) {
  let ingredients: string[];
  try {
    const body = await request.json();
    ingredients = validateIngredients(body.ingredients);
  } catch {
    return Response.json(
      { error: "Enter 1–12 valid ingredients." },
      { status: 400 },
    );
  }
  try {
    return Response.json(await searchMeals(ingredients), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: "TheMealDB is temporarily unavailable. Please try again." },
      { status: 502 },
    );
  }
}
