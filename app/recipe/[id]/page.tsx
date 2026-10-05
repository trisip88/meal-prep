import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Check, ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";
import { getMeal } from "@/lib/mealdb";
import {
  matchRecipe,
  normalizeIngredient,
  validateIngredients,
} from "@/lib/ingredientMatcher";
import NutritionPanel from "@/components/NutritionPanel";
export default async function RecipePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ingredients?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  let available: string[] = [];
  try {
    if (query.ingredients)
      available = validateIngredients(JSON.parse(query.ingredients));
  } catch {
    available = [];
  }
  let meal;
  try {
    meal = await getMeal(id);
  } catch {
    return (
      <main className="detail">
        <Link href="/" className="back">
          <ArrowLeft size={16} />
          Back to ingredient search
        </Link>
        <div className="notice error">
          TheMealDB is temporarily unavailable. Please try again.
        </div>
      </main>
    );
  }
  if (!meal) notFound();
  const match = matchRecipe(meal, available);
  const pantry = new Set(available.map(normalizeIngredient));
  return (
    <main className="detail">
      <Link href="/" className="back">
        <ArrowLeft size={16} />
        Back to ingredient search
      </Link>
      <div className="detail-hero">
        <div className="detail-image">
          {meal.image ? (
            <Image
              src={meal.image}
              alt={meal.name}
              fill
              priority
              sizes="(max-width:650px) 100vw, 50vw"
            />
          ) : (
            <p>Photo unavailable</p>
          )}
        </div>
        <div className="detail-title">
          <span className="eyebrow">
            {[meal.category, meal.area].filter(Boolean).join(" / ")}
          </span>
          <h1>{meal.name}</h1>
          <span className="match-badge">
            <Check size={18} />
            {Math.round(match.matchPercentage)}% ingredient match
          </span>
          <p>
            You have {match.matchedIngredients.length} of{" "}
            {match.totalRecipeIngredients} ingredients.{" "}
            {match.missingIngredients.length} missing.
          </p>
          {!available.length && (
            <p>
              Add your ingredients on the homepage to see what you already have.
            </p>
          )}
        </div>
      </div>
      <div className="detail-columns">
        <section className="panel ingredient-panel">
          <h2>Ingredients</h2>
          <p className="muted small" style={{ marginTop: 8 }}>
            Measurements from the original recipe
          </p>
          <ul className="ingredient-list">
            {meal.ingredients.map((i, index) => {
              const has = pantry.has(normalizeIngredient(i.name));
              return (
                <li key={index}>
                  <span>
                    {i.name}
                    <small>{i.measure || "Quantity not specified"}</small>
                  </span>
                  <span className={has ? "available" : "needed"}>
                    {has ? "✓ Available" : "Missing"}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
        <div>
          <section className="instructions">
            <span className="eyebrow">LET’S GET COOKING</span>
            <h2 style={{ marginTop: 9 }}>Cooking instructions</h2>
            {meal.instructions ? (
              meal.instructions
                .split(/\r?\n/)
                .filter((p) => p.trim())
                .map((p, i) => <p key={i}>{p}</p>)
            ) : (
              <p>Cooking instructions unavailable.</p>
            )}
            {meal.youtube && (
              <a
                href={meal.youtube}
                target="_blank"
                rel="noreferrer"
                className="video"
              >
                Watch Cooking Video <ExternalLink size={15} />
              </a>
            )}
          </section>
          <NutritionPanel id={id} />
        </div>
      </div>
    </main>
  );
}
