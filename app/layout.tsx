import type { Metadata } from "next";
import Link from "next/link";
import { Refrigerator, ArrowUpRight } from "lucide-react";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "Fridge Meal Finder", template: "%s · Fridge Meal Finder" },
  description: "Discover recipes from the ingredients you already have.",
  icons: { icon: "/favicon.svg" },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <Link href="/" className="brand">
            <span className="brand-icon">
              <Refrigerator size={22} />
            </span>
            fridge<span className="brand-light">meal finder</span>
          </Link>
          <span className="header-note">
            A little less waste. A lot more flavour.
          </span>
        </header>
        {children}
        <footer>
          <span>Make more of what’s in your fridge.</span>
          <span>
            Recipes by{" "}
            <a
              href="https://www.themealdb.com"
              target="_blank"
              rel="noreferrer"
            >
              TheMealDB <ArrowUpRight size={12} />
            </a>{" "}
            · Nutrition by{" "}
            <a href="https://apiverve.com" target="_blank" rel="noreferrer">
              APIVerve <ArrowUpRight size={12} />
            </a>
          </span>
        </footer>
      </body>
    </html>
  );
}
