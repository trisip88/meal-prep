import { getMeal } from "@/lib/mealdb";
import { getNutrition } from "@/lib/apiverve";
export const maxDuration = 30;
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!/^\d{1,10}$/.test(id))
    return Response.json({ error: "Invalid recipe ID." }, { status: 400 });
  try {
    const meal = await getMeal(id);
    if (!meal)
      return Response.json({ error: "Recipe not found." }, { status: 404 });
    return Response.json(await getNutrition(meal.ingredients), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      {
        status: "unavailable",
        message: "Nutrition information unavailable.",
        totals: null,
        included: [],
        excluded: [],
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
