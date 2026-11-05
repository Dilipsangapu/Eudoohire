
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./CategoriesSection.css";

const INITIAL_CATEGORY_COUNT = 6;

const categories = [
  { name: "Engineering & Technology", count: "3,240", color: "blue", roles: "Software, Civil, Mechanical, Electrical", icon: "settings" },
  { name: "Design & Creative", count: "1,890", color: "violet", roles: "UI/UX, Graphic Design, Animation", icon: "palette" },
  { name: "Sales & Marketing", count: "2,150", color: "sky", roles: "Digital Marketing, Sales, SEO", icon: "megaphone" },
  { name: "Finance & Accounts", count: "1,420", color: "cyan", roles: "Accounting, Audit, Banking", icon: "wallet" },
  { name: "Human Resources", count: "980", color: "indigo", roles: "Recruitment, HR Operations, Payroll", icon: "users" },
  { name: "Operations & Logistics", count: "1,670", color: "azure", roles: "Supply Chain, Procurement, Admin", icon: "package" },
  { name: "Customer Support", count: "760", color: "periwinkle", roles: "Customer Success, Help Desk, Service", icon: "message" },
  { name: "Data & Analytics", count: "2,040", color: "teal", roles: "Data Analyst, BI, Data Science", icon: "chart" },
  { name: "Healthcare & Medical", count: "1,310", color: "ice", roles: "Nursing, Clinical, Medical Admin", icon: "medical" },
  { name: "Education & Training", count: "1,120", color: "navy", roles: "Teaching, Instructional Design, L&D", icon: "graduation" },
  { name: "Product & Project Management", count: "870", color: "violet", roles: "Product Manager, Scrum Master, PMO", icon: "layers" },
  { name: "Legal & Compliance", count: "540", color: "slateblue", roles: "Legal Counsel, Compliance, Contracts", icon: "scale" },
  { name: "Hospitality & Travel", count: "690", color: "sky", roles: "Hotels, Tourism, Guest Services", icon: "plane" },
  { name: "Media & Communications", count: "830", color: "cyan", roles: "Content, PR, Journalism", icon: "mic" },
  { name: "Architecture & Construction", count: "940", color: "azure", roles: "Architect, Site Engineer, Planning", icon: "building" },
  { name: "Internships & Freshers", count: "1,560", color: "teal", roles: "Graduate Trainee, Entry-level, Intern", icon: "sprout" },
];

function CategoryIcon({ name }) {
  const common = {
    width: 25,
    height: 25,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    focusable: "false",
  };

  const paths = {
    settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a7.8 7.8 0 0 1-1.5.9l-.3 1.8h-2.8l-.3-1.8a7.8 7.8 0 0 1-1.5-.9l-1.7.7-1.4-2.4 1.4-1.1a7.5 7.5 0 0 1 0-1.8l-1.4-1.1 1.4-2.4 1.7.7a7.8 7.8 0 0 1 1.5-.9l.3-1.8h2.8l.3 1.8a7.8 7.8 0 0 1 1.5.9l1.7-.7 1.4 2.4-1.4 1.1a7.5 7.5 0 0 1 0 1.8Z" transform="translate(-1 -1) scale(1.04)" /></>,
    palette: <><path d="M12 3a9 9 0 1 0 0 18h1.1a2 2 0 0 0 1.5-3.3 1.7 1.7 0 0 1 1.3-2.8H18a3 3 0 0 0 3-3c0-5-4-8.9-9-8.9Z" /><circle cx="7.5" cy="10" r="1" /><circle cx="10" cy="6.8" r="1" /><circle cx="14.5" cy="7.5" r="1" /></>,
    megaphone: <><path d="m3 11 15-6v14L3 13v-2Z" /><path d="m6 14 2 6h4l-2.5-4.8" /><path d="M21 9v6" /></>,
    wallet: <><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M3 9V6a2 2 0 0 1 2-2h12" /><path d="M16 12h5v4h-5a2 2 0 0 1 0-4Z" /><path d="M17 14h.01" /></>,
    users: <><path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20Z" /><circle cx="9.5" cy="8" r="3.5" /><path d="M17 11a3.5 3.5 0 1 0-1-6.8M17 14.5h1a3 3 0 0 1 3 3V20h-3" /></>,
    package: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="M3 8v9l9 4 9-4V8M12 13v8" /></>,
    message: <><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H5l-2 2v-6.5a7.5 7.5 0 1 1 17-3Z" /><path d="M7.5 11.5h.01M12 11.5h.01M16.5 11.5h.01" /></>,
    chart: <><path d="M4 20V4h16v16Z" /><path d="M8 16v-4M12 16V7M16 16v-6" /></>,
    medical: <><path d="M9 3h6a2 2 0 0 1 2 2v2a5 5 0 0 1-10 0V5a2 2 0 0 1 2-2Z" /><path d="M7 9H5a2 2 0 0 0-2 2v7a3 3 0 0 0 3 3h5" /><path d="M12 15h8M16 11v8" /></>,
    graduation: <><path d="m2 9 10-5 10 5-10 5L2 9Z" /><path d="M6 11v5c4 3 8 3 12 0v-5M22 9v6" /></>,
    layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></>,
    scale: <><path d="M12 3v18M5 6h14M7 6l-4 8h8L7 6ZM17 6l-4 8h8l-4-8ZM8 21h8" /></>,
    plane: <><path d="m3 11 18-8-8 18-2-7-8-3Z" /><path d="m11 14 5-5" /></>,
    mic: <><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" /></>,
    building: <><rect x="4" y="3" width="16" height="18" rx="1" /><path d="M8 7h2M14 7h2M8 11h2M14 11h2M10 21v-5h4v5" /></>,
    sprout: <><path d="M12 21v-9" /><path d="M12 13C4 13 3 8 3 5c5 0 9 2 9 8ZM12 10c0-5 4-7 9-7 0 4-2 9-9 9" /></>,
  };

  return <svg {...common}>{paths[name] || paths.layers}</svg>;
}

export default function CategoriesSection() {
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  const matchingCategories = useMemo(() => {
    const term = query.trim().toLowerCase();

    return categories.filter((item) =>
      `${item.name} ${item.roles}`.toLowerCase().includes(term)
    );
  }, [query]);

  const visibleCategories =
    query.trim() || showAll
      ? matchingCategories
      : matchingCategories.slice(0, INITIAL_CATEGORY_COUNT);

  const handleCategoryClick = () => {
    navigate("/login");
  };

  const hasMore =
    !query.trim() &&
    matchingCategories.length > INITIAL_CATEGORY_COUNT;

  return (
    <section
      className="categories-list-section"
      id="categories"
      aria-labelledby="categories-heading"
    >
      <div className="container categories-list-container">
        <header className="categories-list-header">
          <div className="categories-eyebrow">
            <span className="categories-eyebrow-mark">
              <CategoryIcon name="layers" />
            </span>
            CAREER DISCOVERY
          </div>

          <h2 id="categories-heading">
            Find your place to <span>thrive</span>
          </h2>

          <p>
            Explore opportunities across industries and discover the path that
            fits your ambition.
          </p>
        </header>

        <div className="categories-toolbar">
          <div className="categories-results">
            <strong>
              {query.trim() ? matchingCategories.length : categories.length} career areas
            </strong>
            <span> / Curated job categories</span>
          </div>

          <label className="category-search">
            <CategoryIcon name="chart" />

            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search categories or roles"
              aria-label="Search categories or roles"
            />

            {query && (
              <button
                className="category-clear"
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </label>
        </div>

        <div
          className="categories-bento"
          role="list"
          aria-label="Job categories"
          aria-live="polite"
        >
          {visibleCategories.map((category, index) => (
            <button
              type="button"
              role="listitem"
              key={category.name}
              className={`category-tile category-tone-${category.color}`}
              onClick={handleCategoryClick}
              style={{ "--tile-index": index }}
              aria-label={`Explore ${category.name}. Continue to login`}
            >
              <span className="category-tile-top">
                <span className="category-row-icon">
                  <CategoryIcon name={category.icon} />
                </span>

                <span className="category-tile-arrow" aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M7 17 17 7M8 7h9v9" />
                  </svg>
                </span>
              </span>

              <span className="category-row-copy">
                <span className="category-row-title">{category.name}</span>
                <span className="category-row-roles">{category.roles}</span>
              </span>

              <span className="category-tile-bottom">
                <span className="category-row-count">
                  <strong>{category.count}</strong>
                  <small>open roles</small>
                </span>

                <span className="category-tile-link">
                  Explore roles <span aria-hidden="true">→</span>
                </span>
              </span>

              <span className="category-tile-glow" aria-hidden="true" />
            </button>
          ))}

          {visibleCategories.length === 0 && (
            <div className="categories-empty">
              No categories match “{query}”. Try another keyword.
            </div>
          )}
        </div>

        {hasMore && (
          <div className="categories-more-wrap">
            <button
              className="categories-more-button"
              type="button"
              onClick={() => setShowAll((current) => !current)}
              aria-expanded={showAll}
            >
              {showAll
                ? "Show fewer categories"
                : `See more categories (${matchingCategories.length - INITIAL_CATEGORY_COUNT} more)`}

              <svg
                className={showAll ? "is-rotated" : ""}
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          </div>
        )}

        <p className="categories-note">
          Job counts are sample display values and can be connected to live job
          data when your API is ready.
        </p>
      </div>
    </section>
  );
}
