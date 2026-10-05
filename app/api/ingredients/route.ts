import { getIngredients } from "@/lib/mealdb";
export async function GET() {
  try {
    return Response.json({ ingredients: await getIngredients() });
  } catch {
    return Response.json(
      {
        error:
          "Ingredient suggestions are temporarily unavailable. You can still type an ingredient.",
      },
      { status: 502 },
    );
  }
}
