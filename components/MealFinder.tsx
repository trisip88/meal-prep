"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Check,
  ChefHat,
  Leaf,
  Plus,
  Search,
  X,
} from "lucide-react";
import { normalizeIngredient, rankMatches } from "@/lib/ingredientMatcher";
import type { RecipeMatch } from "@/lib/types";
export default function MealFinder() {
  const [ingredients, setIngredients] = useState<string[]>([]),
    [query, setQuery] = useState(""),
    [known, setKnown] = useState<string[]>([]),
    [suggestionError, setSuggestionError] = useState(""),
    [active, setActive] = useState(-1),
    [focused, setFocused] = useState(false);
  const [recipes, setRecipes] = useState<RecipeMatch[]>([]),
    [searched, setSearched] = useState<string[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [warning, setWarning] = useState(""),
    [didSearch, setDidSearch] = useState(false),
    [minimum, setMinimum] = useState("0"),
    [sort, setSort] = useState("best");
  const input = useRef<HTMLInputElement>(null),
    abort = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/ingredients", { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((data) => setKnown(data.ingredients))
      .catch(() => {
        if (!controller.signal.aborted)
          setSuggestionError(
            "Suggestions are unavailable. Type an ingredient and press Enter to add it.",
          );
      });
    return () => {
      controller.abort();
      abort.current?.abort();
    };
  }, []);
  const suggestions = query.trim()
    ? known
        .filter(
          (i) =>
            normalizeIngredient(i).includes(normalizeIngredient(query)) &&
            !ingredients.some(
              (s) => normalizeIngredient(s) === normalizeIngredient(i),
            ),
        )
        .slice(0, 6)
    : [];
  function add(value: string) {
    const clean = value.replace(/_/g, " ").trim().replace(/\s+/g, " ");
    if (!clean) return;
    if (clean.length > 100 || /[,\n\r]/.test(clean)) {
      setError("Add one ingredient at a time, up to 100 characters.");
      return;
    }
    if (ingredients.length >= 12) {
      setError("You can search with up to 12 ingredients.");
      return;
    }
    if (
      !ingredients.some(
        (i) => normalizeIngredient(i) === normalizeIngredient(clean),
      )
    )
      setIngredients([...ingredients, clean]);
    setQuery("");
    setActive(-1);
    setError("");
    input.current?.focus();
  }
  async function search() {
    if (!ingredients.length || loading) return;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setLoading(true);
    setError("");
    setWarning("");
    setDidSearch(true);
    setSearched([...ingredients]);
    setRecipes([]);
    try {
      const response = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredients }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok)
        throw Error(data.error ?? "Unable to find recipes. Please try again.");
      setRecipes(data.recipes);
      setWarning(data.warning ?? "");
    } catch (e) {
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : "Unable to find recipes.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }
  const visible = recipes
    .filter((r) => r.matchPercentage >= Number(minimum))
    .sort(
      sort === "alphabetical"
        ? (a, b) => a.name.localeCompare(b.name)
        : sort === "missing"
          ? (a, b) =>
              a.missingIngredients.length - b.missingIngredients.length ||
              rankMatches(a, b)
          : rankMatches,
    );
  const changed =
    didSearch && JSON.stringify(ingredients) !== JSON.stringify(searched);
  return (
    <main className="home">
      <div className="intro">
        <span className="eyebrow">
          <Leaf size={14} /> GOOD FOOD STARTS AT HOME
        </span>
        <h1>
          What Can I <em>Cook?</em>
        </h1>
        <p>
          Enter the ingredients you already have and discover meals you can
          make.
        </p>
      </div>
      <section className="pantry panel" aria-labelledby="pantry-heading">
        <div className="section-top">
          <h2 id="pantry-heading">What’s in your fridge?</h2>
          <span className="muted">{ingredients.length}/12 ingredients</span>
        </div>
        <label htmlFor="ingredient" className="input-label">
          Add an ingredient
        </label>
        <div className="input-wrap">
          <Search size={20} />
          <input
            ref={input}
            id="ingredient"
            placeholder="Try chicken breast, potato, garlic…"
            value={query}
            maxLength={100}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={focused && suggestions.length > 0}
            aria-controls="suggestions"
            aria-activedescendant={
              active >= 0 && suggestions[active]
                ? `suggestion-${active}`
                : undefined
            }
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(-1);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, suggestions.length - 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              }
              if (e.key === "Enter") {
                e.preventDefault();
                add(
                  active >= 0 && suggestions[active]
                    ? suggestions[active]
                    : query,
                );
              }
              if (e.key === "Escape") {
                setFocused(false);
                setActive(-1);
              }
            }}
          />
          <button
            className="add"
            aria-label="Add ingredient"
            disabled={!query.trim() || loading}
            onClick={() => add(query)}
          >
            <Plus size={20} />
          </button>
          {focused && suggestions.length > 0 && (
            <ul id="suggestions" role="listbox" className="suggestions">
              {suggestions.map((s, i) => (
                <li
                  key={s}
                  id={`suggestion-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className={i === active ? "active" : ""}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    add(s);
                  }}
                >
                  {s}
                  <Plus size={16} />
                </li>
              ))}
            </ul>
          )}
        </div>
        {suggestionError && <p className="muted small">{suggestionError}</p>}
        <div className="chips">
          {ingredients.map((i) => (
            <span key={i} className="chip">
              {i}
              <button
                aria-label={`Remove ${i}`}
                disabled={loading}
                onClick={() =>
                  setIngredients(ingredients.filter((s) => s !== i))
                }
              >
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
        {!ingredients.length && (
          <div className="quick-add">
            <span>Start with something you have:</span>
            {["Chicken Breast", "Salmon", "Potato", "Rice", "Egg"].map((i) => (
              <button key={i} onClick={() => add(i)}>
                {i} <Plus size={12} />
              </button>
            ))}
          </div>
        )}
        <div className="pantry-actions">
          <span className="muted small">
            Add your staples, too — every ingredient counts.
          </span>
          <div>
            <button
              className="text-button"
              disabled={loading || (!ingredients.length && !query)}
              onClick={() => {
                setIngredients([]);
                setQuery("");
                setRecipes([]);
                setDidSearch(false);
                setError("");
                setWarning("");
              }}
            >
              Clear All
            </button>
            <button
              className="primary"
              disabled={!ingredients.length || loading}
              onClick={search}
            >
              {loading ? "Finding meals…" : "Find Meals"}
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>
      <section className="results" aria-labelledby="results-heading">
        <div className="results-top">
          <div>
            <span className="eyebrow">YOUR NEXT HOME-COOKED MEAL</span>
            <h2 id="results-heading">
              {didSearch
                ? "Meals for your ingredients"
                : "Good things are in your fridge."}
            </h2>
            {didSearch && !loading && (
              <p className="muted">
                {visible.length} recipes · {searched.join(", ")}
                {changed
                  ? " · Ingredients changed — search again to update."
                  : ""}
              </p>
            )}
          </div>
          {didSearch && !loading && recipes.length > 0 && (
            <div className="controls">
              <label>
                Minimum Match
                <select
                  value={minimum}
                  onChange={(e) => setMinimum(e.target.value)}
                >
                  <option value="0">Any match</option>
                  <option value="50">50%+</option>
                  <option value="70">70%+</option>
                  <option value="90">90%+</option>
                </select>
              </label>
              <label>
                Sort by
                <select value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="best">Best Match</option>
                  <option value="missing">Fewest Missing Ingredients</option>
                  <option value="alphabetical">Alphabetical</option>
                </select>
              </label>
            </div>
          )}
        </div>
        {error && (
          <div role="alert" className="notice error">
            {error}
          </div>
        )}
        {warning && (
          <div role="status" className="notice">
            {warning}
          </div>
        )}
        {loading ? (
          <div role="status">
            <p>Finding recipes from your ingredients…</p>
            <div className="recipe-grid">
              {[1, 2, 3].map((n) => (
                <div className="skeleton" key={n} />
              ))}
            </div>
          </div>
        ) : !didSearch ? (
          <div className="empty-start">
            <ChefHat size={42} strokeWidth={1.3} />
            <h3>A few ingredients. Plenty of possibilities.</h3>
            <p>
              Add what you have above. We’ll find real recipes and show you
              exactly what’s missing.
            </p>
            <div className="steps">
              <span>
                <b>01</b> Add ingredients
              </span>
              <span>
                <b>02</b> Find your best match
              </span>
              <span>
                <b>03</b> Get cooking
              </span>
            </div>
          </div>
        ) : !visible.length && !error ? (
          <div className="empty-start">
            <Search size={32} />
            <h3>
              {recipes.length
                ? "No recipes meet this filter."
                : "No matching meals found."}
            </h3>
            <p>
              {recipes.length
                ? "Choose a lower minimum match."
                : "Try a broader ingredient such as chicken, beef, salmon, potato, rice, or egg."}
            </p>
          </div>
        ) : (
          <div className="recipe-grid">
            {visible.map((recipe) => (
              <article className="recipe-card" key={recipe.id}>
                <div className="card-photo">
                  {recipe.image ? (
                    <Image
                      src={recipe.image}
                      alt={recipe.name}
                      fill
                      sizes="(max-width: 600px) 100vw, (max-width: 1000px) 50vw, 33vw"
                    />
                  ) : (
                    <span>Photo unavailable</span>
                  )}
                  <span className="match-badge">
                    <Check size={14} />
                    {Math.round(recipe.matchPercentage)}% match
                  </span>
                </div>
                <div className="card-content">
                  <span className="card-meta">
                    {[recipe.category, recipe.area].filter(Boolean).join(" · ")}
                  </span>
                  <h3>{recipe.name}</h3>
                  <p>
                    You have{" "}
                    <strong>
                      {recipe.matchedIngredients.length} of{" "}
                      {recipe.totalRecipeIngredients}
                    </strong>{" "}
                    ingredients
                  </p>
                  <div className="progress">
                    <span style={{ width: `${recipe.matchPercentage}%` }} />
                  </div>
                  <p className="have">
                    ✓{" "}
                    {recipe.matchedIngredients
                      .slice(0, 3)
                      .map((i) => i.name)
                      .join(", ") || "No exact ingredient matches"}
                  </p>
                  <p className="missing">
                    Missing {recipe.missingIngredients.length}:{" "}
                    {recipe.missingIngredients
                      .slice(0, 3)
                      .map((i) => i.name)
                      .join(", ") || "Nothing!"}
                    {recipe.missingIngredients.length > 3 ? "…" : ""}
                  </p>
                  <Link
                    className="recipe-link"
                    href={`/recipe/${recipe.id}?ingredients=${encodeURIComponent(JSON.stringify(searched))}`}
                  >
                    View Recipe
                    <ArrowRight size={17} />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
