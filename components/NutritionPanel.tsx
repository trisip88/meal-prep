"use client";
import { useState } from "react";
import type { NutritionResult } from "@/lib/types";
export default function NutritionPanel({ id }: { id: string }) {
  const [result, setResult] = useState<NutritionResult | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(false);
  async function calculate() {
    setLoading(true);
    setError(false);
    try {
      const response = await fetch(`/api/nutrition?id=${id}`);
      if (!response.ok) throw Error();
      const data: NutritionResult = await response.json();
      if (!["available", "unavailable"].includes(data.status)) throw Error();
      setResult(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }
  return (
    <section
      className="nutrition-panel panel"
      aria-labelledby="nutrition-title"
    >
      <div className="nutrition-heading">
        <div>
          <span className="eyebrow">AN APPROXIMATE PICTURE</span>
          <h2 id="nutrition-title">Estimated Nutrition</h2>
        </div>
        <span>Full recipe · No serving count assumed</span>
      </div>
      {!result && !error && !loading && (
        <>
          <p className="muted small">
            Estimate nutrition using ingredients with reliable weight
            measurements.
          </p>
          <button
            className="primary"
            style={{ marginTop: 18 }}
            onClick={calculate}
          >
            Calculate nutrition
          </button>
        </>
      )}
      {loading && (
        <p role="status" className="muted" style={{ marginTop: 20 }}>
          Calculating nutrition…
        </p>
      )}
      {error && (
        <>
          <p role="status" className="muted" style={{ marginTop: 20 }}>
            Nutrition information unavailable.
          </p>
          <button className="text-button" onClick={calculate}>
            Try again
          </button>
        </>
      )}
      {result && (
        <>
          <p className="muted small" role="status">
            {result.message}
          </p>
          {result.totals && (
            <div className="macro-grid">
              {(
                [
                  ["calories", "Calories", "kcal"],
                  ["protein", "Protein", "g"],
                  ["carbohydrates", "Carbohydrates", "g"],
                  ["fat", "Fat", "g"],
                ] as const
              ).map(([key, label, unit]) => (
                <div className="macro" key={key}>
                  <span>{label}</span>
                  <strong>
                    {result.totals![key].toLocaleString("en-SG", {
                      maximumFractionDigits: key === "calories" ? 0 : 1,
                    })}
                  </strong>
                  <small>{unit}</small>
                </div>
              ))}
            </div>
          )}
          {result.status === "available" && (
            <p className="small muted">
              Estimated nutrition for full recipe, based on{" "}
              {result.included.length} of{" "}
              {result.included.length + result.excluded.length} ingredients.
              {result.excluded.length > 0
                ? " Some ingredients could not be included because their quantities could not be reliably converted to weight or nutrition data was unavailable."
                : ""}
            </p>
          )}
          {(result.included.length > 0 || result.excluded.length > 0) && (
            <details>
              <summary>What went into this estimate?</summary>
              <ul>
                {result.included.map((i, index) => (
                  <li key={`included-${index}`}>
                    {i.name}:{" "}
                    {i.grams.toLocaleString("en-SG", {
                      maximumFractionDigits: 1,
                    })}{" "}
                    g · API food match: {i.matchedFood}
                  </li>
                ))}
                {result.excluded.map((i, index) => (
                  <li key={`excluded-${index}`}>
                    {i.name}: excluded — {i.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}
