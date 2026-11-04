import React, { useEffect } from "react";

/*
 * TechnologyIcon — reusable technology/skill text chip + icon pill for the
 * React dashboards (paid & unpaid candidate).
 *
 * The actual artwork comes from the `tech-stack-icons` package
 * (node_modules/tech-stack-icons). Because that package ships every one of
 * its 690+ icons as one ~8.5MB bundle, the /js/tech-icons-data.js asset used
 * here is generated from the installed package's own SVG data by
 * `npm run tech-icons:generate` — the icons are verbatim package icons, only
 * the ones this app displays.
 *
 * js/tech-icons.js is the canonical shared module (also loaded by the
 * recruiter and client-admin Thymeleaf pages): it owns the technology-name
 * mapping/aliases, the plain-chip markup, the icon pill markup and the one
 * delegated tooltip (hover + keyboard focus + touch). React reuses it so
 * every dashboard looks and behaves identically, and the technology-to-icon
 * mapping is never duplicated.
 *
 * ICON POLICY (showIcons):
 *   SVG technology icons appear ONLY on the full job-description view.
 *   Everywhere else (job cards/listings, dashboards, resumes, portfolios,
 *   skill lists) the technology name renders as a plain text chip. Default:
 *   plain text. Pass showIcons explicitly on the job-description renderer.
 */
import "../../../backend/src/main/resources/static/js/tech-icons-data.js";
import "../../../backend/src/main/resources/static/js/tech-icons.js";

function shared() {
  return typeof window !== "undefined" ? window.TechIcons : null;
}

/**
 * String renderer for dashboards that build cards via innerHTML templates.
 * Renders a plain text chip by default. Only the full job-description view
 * should pass { showIcons: true } (or use techIconPillHTML directly).
 *
 *   techPillHTML("Java", "tech-tag-pill")                    -> plain text chip
 *   techPillHTML("Java", "tech-tag-pill", null, { showIcons: true }) -> icon pill
 */
export function techPillHTML(name, className, inlineStyle, options) {
  const TechIcons = shared();
  if (!TechIcons) return "";
  if (options && options.showIcons) {
    TechIcons.activate();
    return TechIcons.pillHTML(name, className, inlineStyle);
  }
  return TechIcons.plainHTML(name, className, inlineStyle);
}

/* Explicit icon-pill renderer for the full job-description view. Mounts the
 * shared tooltip so hovering an icon reveals the technology name. */
export function techIconPillHTML(name, className, inlineStyle) {
  const TechIcons = shared();
  if (!TechIcons) return "";
  TechIcons.activate();
  return TechIcons.pillHTML(name, className, inlineStyle);
}

/**
 * JSX usage anywhere in React:
 *
 *   <TechnologyIcon name="Java" />                       -> plain text chip
 *   <TechnologyIcon name="Spring Boot" className="tech-tag-pill" showIcons /> -> icon pill
 */
export default function TechnologyIcon({ name, className = "", showIcons = false }) {
  useEffect(() => {
    if (!showIcons) return undefined;
    const TechIcons = shared();
    if (TechIcons) TechIcons.activate();
    return undefined;
  }, [showIcons]);

  if (showIcons) {
    const html = techIconPillHTML(name, className, undefined);
    if (!html) return null;
    /* Built by TechIcons.pillHTML: names are attribute-escaped and the inner
       SVG markup is generated verbatim from the tech-stack-icons package. */
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  }

  if (!String(name == null ? "" : name).trim()) return null;
  return <span className={className}>{name}</span>;
}
