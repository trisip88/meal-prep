# Fridge Meal Finder

An SMU Singapore course assignment application that discovers real recipes from ingredients already in the kitchen, calculates ingredient matches, and estimates nutrition without inventing quantities or servings.

## Stack and architecture

Next.js 16.3.8 App Router, React 19.3, TypeScript, Tailwind CSS 4, and Lucide icons. `app/page.tsx` renders the interactive ingredient selector and recipe grid. Next.js Route Handlers proxy external APIs; the recipe page renders on the server. No database or account is needed.

```text
Browser → /api/ingredients → TheMealDB ingredient list
Browser → /api/recipes → individual TheMealDB filters → up to 25 recipe lookups
Browser → /recipe/[id] → server-rendered recipe + ingredient availability
Browser → /api/nutrition?id=... → server-only APIVerve → scaled estimates
```

## Application Logic

1. Receive 1–12 ingredient selections, validate them, and remove normalized duplicates.
2. Resolve safe normalized ingredient aliases against the cached provider catalogue (for example potato → Potatoes), then search TheMealDB separately for each ingredient. Free V1 supports only one ingredient per request.
3. Combine candidate meals and remove duplicate meal IDs.
4. Count how many searches returned each meal and prioritize the strongest overlap (deterministic meal-ID tie break).
5. Fetch full details for at most 25 candidate meals, using five concurrent lookups; ingredient filters use four concurrent requests.
6. Extract `strIngredient1` / `strMeasure1` through `strIngredient20` / `strMeasure20`, ignoring blank ingredients.
7. Normalize case, whitespace and underscores; use a small explicit list of safe plural aliases (such as potatoes → potato). Do not fuzzy-match chicken stock with chicken.
8. Compare each recipe ingredient row with the user's normalized ingredient set.
9. Calculate `(matched ingredient rows / total ingredient rows) × 100`. Keep full precision for ranking and filtering; round only the displayed percentage.
10. Identify matched and missing ingredient rows. Repeated ingredient rows in source recipes are preserved with their original measurements.
11. Rank by highest match percentage, fewest missing ingredients, most matched ingredients, candidate overlap, then alphabetical name.
12. Let users filter by Any, 50%+, 70%+, or 90%+ and sort by best match, fewest missing, or name.
13. On the recipe page, the user can calculate nutrition. Fetch the trusted recipe on the server rather than accepting arbitrary client-supplied nutrition ingredients.
14. Request APIVerve data for ingredients with safely parsed weights, scale each per-100g panel to its recipe weight, and aggregate calories, protein, carbohydrates and fat.

The ingredient list is loaded once per homepage mount and filtered locally as the user types. Public TheMealDB fetches cache for one hour. User selections and nutrition results are not persisted or placed in a shared cache. Recipe links include selected ingredients in their URL so availability remains visible on refresh.

## APIs

### TheMealDB

Only `https://www.themealdb.com/api/json/v1/1/` is used:

- `list.php?i=list` — ingredient autocomplete.
- `filter.php?i=chicken_breast` — one filter per selected ingredient.
- `lookup.php?i=MEAL_ID` — original recipe, measurements, instructions, image and optional YouTube link.

External JSON is checked before use. Images and optional video links are restricted to the expected provider domains. Requests time out after ten seconds. Partial failures show a warning; complete failures show a helpful error. No results remain empty rather than being replaced with fictional recipes.

Official documentation: https://www.themealdb.com/documentation

### APIVerve

Server-only `lib/apiverve.ts` reads `process.env.APIVERVE_API_KEY` and sends it in the documented `x-api-key` header to `GET https://api.apiverve.com/v1/nutrition?food=...`. The browser only calls our internal endpoint. The secret is never returned, logged, or bundled into browser JavaScript. The module uses `server-only` to prevent accidental client imports.

The documented response must have `status: "ok"`, no error, `data.basis: "per 100g"`, and numeric nonnegative values in `data.nutrition.calories`, `protein`, `carbohydrates`, and `totalFat`. Missing values are not assumed to be zero. The returned USDA food name is shown in the calculation breakdown for transparency.

The premium `grams` parameter is intentionally omitted. All scaling is done locally:

```text
recipe ingredient nutrition = per-100g nutrition × ingredient grams / 100
```

Direct weights supported: g, kg, mg, oz and lb (including fractions). Exact conversions: 1 oz = 28.349523125 g; 1 lb = 453.59237 g. Ambiguous ranges, counts, cups, tablespoons, teaspoons, cloves, cans and pieces are excluded. No density or individual ingredient weight is guessed. Duplicate food lookups within one calculation are deduplicated. Requests are sequential with five-second timeouts and an overall 20-second provider budget, avoiding bursts. If some calls fail, the app reports which ingredients were excluded. If none can be included, it displays **Nutrition information unavailable.**

Official documentation: https://docs.apiverve.com/ref/nutrition

## Local development

Requires Node.js 20.9 or newer; Node.js 24 LTS is recommended.

```sh
git clone https://github.com/trisip88/meal-prep.git
cd meal-prep
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. Optionally set `APIVERVE_API_KEY` inside your local `.env.local` using your own key. Recipe searching and details work without it. `.env.local` and other private environment files are ignored by Git; `.env.example` contains only the empty variable name. Production reads Vercel's environment and does not require an `.env.local` file.

## Vercel deployment

1. Sign in to Vercel and select **Add New → Project**.
2. Connect GitHub if needed and import **trisip88/meal-prep**.
3. Use **Next.js** as the framework and keep the repository root as the Root Directory.
4. Keep the defaults: install `npm install`, build `npm run build`, output directory managed by Next.js. Choose Node.js 24 if available (otherwise a supported version ≥20.9).
5. Deploy. Recipe search works before configuring nutrition.
6. Open **Project → Settings → Environment Variables**.
7. Add the exact name **APIVERVE_API_KEY**. Enter your actual key privately in Vercel's Value field; enable Sensitive if offered. Select **Production** and **Preview**, and **Development** if needed. Save.
8. Open **Deployments**, select the latest deployment, and choose **Redeploy** so the runtime receives the new variable. Future GitHub pushes redeploy automatically.
9. Open the deployed URL, add ingredients, find meals, open a recipe, and select **Calculate nutrition**. A recipe without reliably measurable quantities may correctly report that nutrition is unavailable.

Never create a public-prefixed environment variable for this key. Never commit the real key or put it into an issue, source file, screenshot or README.

## Main files

- `components/MealFinder.tsx`: chips, keyboard autocomplete, search states, grid, filters and sorting.
- `components/NutritionPanel.tsx`: optional calculation, estimates, coverage and excluded-ingredient explanation.
- `app/recipe/[id]/page.tsx`: full recipe, measurements, availability, instructions and video.
- `app/api/{ingredients,recipes,nutrition}/route.ts`: input validation and server API boundary.
- `lib/mealdb.ts`: typed provider parsing, caching, controlled concurrency and candidate search.
- `lib/ingredientMatcher.ts`: normalization, match calculation and ranking.
- `lib/measurementParser.ts`: conservative weight conversion.
- `lib/nutrition.ts`: response validation, scaling and aggregation.
- `lib/apiverve.ts`: secret handling and provider calls.
- `lib/types.ts`: application data models.
- `app/globals.css`: responsive green and neutral design.
- `tests/logic.test.ts`: deterministic algorithm and failure tests with mocked providers.

## Validation

```sh
npm test
npm run lint
npm run typecheck
npm run build
npm start
```

Tests use clearly labeled synthetic provider fixtures exclusively in test files; no meal results or nutritional values are hardcoded into application code. The `react-server` test condition allows server-only modules to be exercised in Node.

## Limitations

- The 25-candidate cap means a high-match recipe outside the strongest candidate set may be omitted.
- Ingredient matching deliberately avoids fuzzy equivalences; preparation forms and substitutions may not match.
- Recipe ingredient availability indicates names, not whether you have enough of the required quantity.
- Nutrition is an estimate for included ingredients of the full recipe, not per serving. No serving count is invented. Many TheMealDB measurements cannot safely be converted to grams.
- APIVerve chooses a generic USDA food match; the actual product, preparation and nutrition may differ. The breakdown exposes that match.
- API outages, limits and account credit availability affect external data. No successful live APIVerve request was tested with a real key; configure and verify it in Vercel. Missing-key and invalid-response paths are tested.
- Public production use may require reviewing TheMealDB's supporter-key guidance; this academic implementation follows the requested free V1 test key.
- `npm audit` currently flags five development dependency findings through ESLint's transitive `braces` dependency; no fix is published by the registry. Production dependencies have no audit findings at verification time.
- No authentication or distributed quota controls are included. For wider public use, apply platform request limits to protect nutrition credits.
