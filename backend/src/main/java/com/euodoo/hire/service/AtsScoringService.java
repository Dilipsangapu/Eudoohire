package com.euodoo.hire.service;

import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Deterministic ATS resume-to-job scoring engine.
 *
 * Pure function of (resume text, job requirements): the same inputs always
 * produce the same score — no randomness, no hardcoded scores. The score is a
 * 0-100 weighted composite of five categories; when a category is not
 * applicable to a given job (e.g. the job states no minimum experience), its
 * weight is redistributed proportionally across the applicable categories so
 * the maximum remains 100.
 *
 * Baseline weighting (used whenever all categories are applicable):
 *   Required skills  40%
 *   Relevant experience  25%
 *   Preferred skills  15%
 *   Education  10%
 *   Certifications & relevant projects  10%
 *
 * Skill matching is normalization-based: case-insensitive, punctuation and
 * spacing variants collapse to canonical forms (e.g. "React.js" ≡ "reactjs" ≡
 * "react") and phrases are matched on word boundaries so "SQL" does not
 * falsely match "mysql".
 */
@Service
public class AtsScoringService {

    /** Structured requirements extracted from a real Job record or a pasted JD. */
    public record JobRequirements(
            String jobTitle,
            String jobDescription,
            List<String> requiredSkills,
            List<String> preferredSkills,
            Integer minExperienceYears,
            Integer maxExperienceYears,
            /** Education level demanded by the job; NONE when not stated. */
            EducationLevel requiredEducation) {
    }

    /** Immutable scoring output. */
    public record Result(int score,
                         Map<String, Object> breakdown,
                         List<String> matchedRequiredSkills,
                         List<String> missingRequiredSkills,
                         List<String> matchedPreferredSkills,
                         List<String> missingPreferredSkills) {
    }

    public enum EducationLevel { NONE, DIPLOMA, BACHELOR, MASTER, PHD }

    /** Per-plan candidate self-service ATS allowances (product rule for this feature). */
    public static final class AtsEntitlementPolicy {
        private AtsEntitlementPolicy() {}

        /** One-time allowance per plan tier, counted from persisted usage records. */
        public static int allowanceFor(String plan) {
            if (plan == null) return 2;
            return switch (plan) {
                case "FREE" -> 2;
                case "BASIC" -> 10;
                case "PREMIUM" -> 20;
                default -> 2;
            };
        }
    }

    private static final double W_REQUIRED = 0.40;
    private static final double W_EXPERIENCE = 0.25;
    private static final double W_PREFERRED = 0.15;
    private static final double W_EDUCATION = 0.10;
    private static final double W_CERTS_PROJECTS = 0.10;

    private static final String ANY_YEARS =
            "(\\d{1,2})\\s*\\+?\\s*(?:years|yrs|year)\\b";
    private static final Pattern YEARS_PATTERN =
            Pattern.compile(ANY_YEARS, Pattern.CASE_INSENSITIVE);
    private static final Pattern DATE_RANGE_PATTERN =
            Pattern.compile("(19|20)\\d{2}\\s*(?:-|–|to)\\s*((?:19|20)\\d{2}|present|current|now)",
                    Pattern.CASE_INSENSITIVE);
    private static final Pattern HTML_TAG_PATTERN = Pattern.compile("<[^>]+>");

    // ─────────────────────────────────────────────────
    // Public scoring entry point
    // ─────────────────────────────────────────────────

    public static void checkInputs(String resumeText, JobRequirements job) {
        if (resumeText == null || resumeText.isBlank()) {
            throw new IllegalArgumentException("RESUME_TEXT_EMPTY: no readable resume text to evaluate.");
        }
        if (job == null) {
            throw new IllegalArgumentException("JOB_REQUIREMENTS_MISSING: no job requirements to evaluate against.");
        }
    }

    public Result score(String resumeText, JobRequirements job) {
        checkInputs(resumeText, job);
        String spacedResume = normalize(resumeText);
        String joinedResume = spacedResume.replace(" ", "");
        String lowerJobDescription = job.jobDescription() == null ? ""
                : job.jobDescription().toLowerCase(Locale.ROOT);

        List<String> required = dedupe(job.requiredSkills());
        List<String> preferred = dedupe(job.preferredSkills());

        // 1. Required skills — fraction matched x 100
        List<String> matchedRequired = new ArrayList<>();
        List<String> missingRequired = new ArrayList<>();
        for (String skill : required) {
            (matchesSkill(spacedResume, joinedResume, skill) ? matchedRequired : missingRequired).add(skill);
        }
        double requiredScore = required.isEmpty() ? -1
                : 100.0 * matchedRequired.size() / required.size();

        // 2. Relevant experience — resume evidence vs the job's minimum
        int yearsFound = inferYearsOfExperience(resumeText.toLowerCase(Locale.ROOT));
        double experienceScore = -1;
        Integer minYears = job.minExperienceYears() != null && job.minExperienceYears() >= 0
                ? job.minExperienceYears() : null;
        if (minYears != null && minYears > 0) {
            // Proportional, full marks at the minimum; exceeding never lowers the score.
            experienceScore = Math.min(100.0, 100.0 * yearsFound / minYears);
        }

        // 3. Preferred skills — fraction matched x 100
        List<String> matchedPreferred = new ArrayList<>();
        List<String> missingPreferred = new ArrayList<>();
        for (String skill : preferred) {
            (matchesSkill(spacedResume, joinedResume, skill) ? matchedPreferred : missingPreferred).add(skill);
        }
        double preferredScore = preferred.isEmpty() ? -1
                : 100.0 * matchedPreferred.size() / preferred.size();

        // 4. Education — resume's highest evidenced level vs the job's stated requirement
        EducationLevel resumeLevel = inferEducationLevel(spacedResume);
        double educationScore = -1;
        String educationAssessment = "No education requirement stated in the job description.";
        if (job.requiredEducation() != null && job.requiredEducation() != EducationLevel.NONE) {
            educationScore = switch (compareLevel(resumeLevel, job.requiredEducation())) {
                case 1, 0 -> 100.0;  // meets or exceeds the requirement
                case -1 -> 50.0;     // evidenced a lower level — partial credit
                default -> 0.0;      // no degree-level education evidenced
            };
            educationAssessment = describeEducation(resumeLevel, job.requiredEducation());
        }

        // 5. Certifications & relevant projects — evidence-based on the resume
        boolean certEvidence = spacedResume.contains("certif");
        boolean projectEvidence = containsAny(spacedResume, "project", "portfolio");
        boolean linkEvidence = containsAny(spacedResume, "github.com", "gitlab.com", "linkedin.com");
        double certsScore = (certEvidence ? 50.0 : 0.0)
                + (projectEvidence ? 30.0 : 0.0)
                + (linkEvidence ? 20.0 : 0.0);
        String certsAssessment = (certEvidence ? "Certification keyword found; " : "No certifications mentioned; ")
                + (projectEvidence ? "projects/portfolio mentioned." : "no projects mentioned.")
                + (linkEvidence ? " Professional link found." : "");

        // Weighted total with inapplicable-category weight redistribution
        Map<String, Double> weights = new LinkedHashMap<>();
        if (requiredScore >= 0) weights.put("requiredSkills", W_REQUIRED);
        if (experienceScore >= 0) weights.put("experience", W_EXPERIENCE);
        if (preferredScore >= 0) weights.put("preferredSkills", W_PREFERRED);
        if (educationScore >= 0) weights.put("education", W_EDUCATION);
        weights.put("certificationsProjects", W_CERTS_PROJECTS); // always applicable (resume evidence)

        double applicableWeight = weights.values().stream().mapToDouble(Double::doubleValue).sum();
        double total = 0;
        total += cat(requiredScore, weights.get("requiredSkills"), applicableWeight);
        total += cat(experienceScore, weights.get("experience"), applicableWeight);
        total += cat(preferredScore, weights.get("preferredSkills"), applicableWeight);
        total += cat(educationScore, weights.get("education"), applicableWeight);
        total += cat(certsScore, weights.get("certificationsProjects"), applicableWeight);
        int score = (int) Math.round(Math.max(0, Math.min(100, total)));

        Map<String, Object> breakdown = new LinkedHashMap<>();
        breakdown.put("weights", effectiveWeights(weights, applicableWeight));
        breakdown.put("requiredSkills", category(requiredScore >= 0, Math.max(requiredScore, 0),
                required.isEmpty() ? "No required skills defined on the job."
                        : matchedRequired.size() + " of " + required.size() + " required skills matched."));
        Map<String, Object> exp = new LinkedHashMap<>();
        exp.put("applicable", experienceScore >= 0);
        exp.put("score", Math.max(experienceScore, 0));
        exp.put("yearsFound", yearsFound);
        exp.put("yearsRequired", minYears == null ? 0 : minYears);
        breakdown.put("experience", exp);
        breakdown.put("preferredSkills", category(preferredScore >= 0, Math.max(preferredScore, 0),
                preferred.isEmpty() ? "No preferred skills defined for this job."
                        : matchedPreferred.size() + " of " + preferred.size() + " preferred skills matched."));
        Map<String, Object> edu = new LinkedHashMap<>();
        edu.put("applicable", educationScore >= 0);
        edu.put("score", Math.max(educationScore, 0));
        edu.put("assessment", educationAssessment);
        breakdown.put("education", edu);
        Map<String, Object> cp = new LinkedHashMap<>();
        cp.put("applicable", true);
        cp.put("score", certsScore);
        cp.put("assessment", certsAssessment);
        breakdown.put("certificationsProjects", cp);

        return new Result(score, breakdown, matchedRequired, missingRequired, matchedPreferred, missingPreferred);
    }

    // ─────────────────────────────────────────────────
    // Requirement extraction helpers (deterministic)
    // ─────────────────────────────────────────────────

    /** Known skill terms used to recognize skills inside free-form job descriptions. */
    private static final List<String> SKILL_DICTIONARY = List.of(
            "Java", "JavaScript", "TypeScript", "Python", "Go", "Kotlin", "Swift", "PHP", "Ruby",
            "SQL", "MongoDB", "PostgreSQL", "MySQL", "Oracle", "Redis",
            "Spring", "Spring Boot", "Hibernate", "React", "Next.js", "Angular",
            "Vue", "Node.js", "Express", "Django", "Flask", "FastAPI",
            "HTML", "CSS", "Tailwind", "Bootstrap", "SASS", "Redux", "GraphQL", "REST", "Microservices",
            "Docker", "Kubernetes", "AWS", "Azure", "Google Cloud", "Terraform",
            "Jenkins", "CI/CD", "Git", "Jira", "Confluence", "Linux", "Bash",
            "Kafka", "RabbitMQ", "Elasticsearch", "Spark", "Hadoop", "Machine Learning", "TensorFlow",
            "PyTorch", "Pandas", "Excel", "Power BI", "Tableau", "Salesforce", "SAP",
            "Agile", "Scrum", "TDD", "Unit Testing", "Jest", "JUnit", "Selenium", "Playwright", "Cypress"
    );

    /**
     * Builds requirements for a pasted job description: required skills are
     * discovered strictly through the deterministic dictionary (free-form text
     * is never treated as a skill on its own), experience from "<n> years"
     * mentions and education from degree keywords.
     */
    public static JobRequirements fromJobDescription(String jobDescription) {
        String spaced = normalize(jobDescription);
        String joined = spaced.replace(" ", "");
        List<String> required = new ArrayList<>();
        for (String skill : SKILL_DICTIONARY) {
            if (matchesSkill(spaced, joined, skill)) {
                required.add(skill);
            }
        }
        Integer minYears = null;
        Matcher m = YEARS_PATTERN.matcher(jobDescription);
        while (m.find()) {
            int v = Integer.parseInt(m.group(1));
            if (v >= 0 && v <= 30) {
                minYears = minYears == null ? v : Math.max(minYears, v);
            }
        }
        return new JobRequirements(
                null,
                jobDescription,
                required,
                List.of(), // no separate preferred list is derivable from free text
                minYears,
                null,
                detectEducationRequirement(spaced));
    }

    public static EducationLevel detectEducationRequirement(String normalizedJobDescription) {
        if (containsAny(normalizedJobDescription, "phd", "doctorate", "ph d")) {
            return EducationLevel.PHD;
        }
        if (containsAny(normalizedJobDescription, "master", "msc", "m tech", "mba", "postgraduate")) {
            return EducationLevel.MASTER;
        }
        if (containsAny(normalizedJobDescription, "bachelor", "b tech", "btech", "b e", "bsc", "undergraduate")
                || normalizedJobDescription.contains("bachelor s")) {
            return EducationLevel.BACHELOR;
        }
        if (containsAny(normalizedJobDescription, "diploma", "vocational")) return EducationLevel.DIPLOMA;
        return EducationLevel.NONE;
    }

    // ─────────────────────────────────────────────────
    // Matching
    // ─────────────────────────────────────────────────

    /** Normalized form of the given text (public so other services share the rules). */
    public static String normalize(String text) {
        return HTML_TAG_PATTERN.matcher(text == null ? "" : text).replaceAll(" ")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[\\p{Punct}\\u2013\\u2014\\u2018\\u2019]", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    /**
     * Canonical key for a skill with common variants collapsed:
     * "react.js"/"reactjs" → "react", "node.js" → "nodejs", "spring boot" → "springboot".
     */
    private static String skillKey(String skill) {
        String s = skill.trim().toLowerCase(Locale.ROOT);
        s = s.replaceAll("react[\\s.]*js", "react");
        s = s.replaceAll("vue[\\s.]*js", "vue");
        s = s.replaceAll("node[\\s.]*js", "nodejs");
        s = s.replaceAll("next[\\s.]*js", "nextjs");
        s = s.replaceAll("express[\\s.]*js", "expressjs");
        s = s.replaceAll("[.\\s_\\-/#/+]+", "");
        return s;
    }

    /** Extra (non-canonical) search variants for skills whose resume spelling varies. */
    private static List<String> extraForms(String skill) {
        String lower = skill.trim().toLowerCase(Locale.ROOT);
        LinkedHashMap<String, Boolean> forms = new LinkedHashMap<>();
        if (lower.matches("react.*")) { forms.put("reactjs", true); }
        if (lower.matches("node.*")) { forms.put("node js", true); forms.put("node", true); }
        if (lower.matches("vue.*")) { forms.put("vuejs", true); }
        return new ArrayList<>(forms.keySet());
    }

    /** Skills recognized by the deterministic JD-extraction dictionary. */
    public static List<String> dictionarySkills() {
        return SKILL_DICTIONARY;
    }

    /** Public matching entry point used by other services (same rules as scoring). */
    public static boolean isSkillPresent(String spacedText, String joinedText, String skill) {
        return matchesSkill(spacedText, joinedText, skill);
    }

    private static boolean matchesSkill(String spacedHaystack, String joinedHaystack, String skill) {
        String canonical = skillKey(skill); // e.g. "springboot", "nodejs", "react"
        if (canonical.isEmpty()) return false;
        String spaced = normalize(skill);   // e.g. "spring boot", "node js"
        if (containsTokenOrPhrase(spacedHaystack, spaced)) return true;
        if (containsTokenOrPhrase(joinedHaystack, canonical)) return true;
        for (String form : extraForms(skill)) {
            if (containsTokenOrPhrase(spacedHaystack, form)) return true;
        }
        return false;
    }

    /**
     * Word-boundary match of a phrase (tokens joined by whitespace variations)
     * against already-normalized text. A trailing plural "s"/"es" is tolerated
     * so "RESTful APIs" matches the requirement "RESTful API".
     */
    private static boolean containsTokenOrPhrase(String normalizedHaystack, String phrase) {
        if (phrase == null || phrase.isBlank()) return false;
        String[] tokens = phrase.trim().split("\\s+");
        StringBuilder p = new StringBuilder("(?<![a-z0-9])");
        for (int i = 0; i < tokens.length; i++) {
            if (i > 0) p.append("[\\s_-]+");
            p.append(Pattern.quote(tokens[i]));
            boolean last = i == tokens.length - 1;
            boolean endsWithS = tokens[i].endsWith("s");
            if (last && !endsWithS) p.append("(?:s|es)?");
        }
        p.append("(?![a-z0-9])");
        return Pattern.compile(p.toString()).matcher(normalizedHaystack).find();
    }

    private static boolean containsAny(String text, String... needles) {
        for (String n : needles) {
            if (n != null && text.contains(n)) return true;
        }
        return false;
    }

    private static List<String> dedupe(List<String> skills) {
        if (skills == null) return List.of();
        List<String> out = new ArrayList<>();
        for (String s : skills) {
            if (s != null && !s.isBlank()) {
                String t = s.trim();
                if (!out.contains(t)) out.add(t);
            }
        }
        return out;
    }

    // ─────────────────────────────────────────────────
    // Experience inference (evidence-based, deterministic)
    // ─────────────────────────────────────────────────

    private static int inferYearsOfExperience(String lowerResume) {
        int max = 0;
        Matcher m = YEARS_PATTERN.matcher(lowerResume);
        while (m.find()) {
            int v;
            try {
                v = Integer.parseInt(m.group(1));
            } catch (NumberFormatException ex) {
                continue;
            }
            if (v >= 0 && v <= 40) max = Math.max(max, v);
        }
        int now = java.time.Year.now().getValue();
        Matcher dr = DATE_RANGE_PATTERN.matcher(lowerResume);
        while (dr.find()) {
            try {
                int start = Integer.parseInt(dr.group(0).substring(0, 4));
                String endPart = dr.group(2);
                int end = endPart.matches("\\d{4}") ? Integer.parseInt(endPart) : now;
                if (end >= start && (end - start) <= 45) {
                    max = Math.max(max, end - start);
                }
            } catch (RuntimeException ignored) {
                // unparsable range — skip
            }
        }
        return max;
    }

    // ─────────────────────────────────────────────────
    // Education
    // ─────────────────────────────────────────────────

    private static int compareLevel(EducationLevel resumeLevel, EducationLevel required) {
        if (resumeLevel == null || resumeLevel == EducationLevel.NONE) return -2;
        return Integer.compare(rank(resumeLevel), rank(required));
    }

    private static int rank(EducationLevel level) {
        return switch (level) {
            case NONE -> 0;
            case DIPLOMA -> 1;
            case BACHELOR -> 2;
            case MASTER -> 3;
            case PHD -> 4;
        };
    }

    private static String describeEducation(EducationLevel found, EducationLevel required) {
        String foundLabel = found == EducationLevel.NONE
                ? "no degree-level education evidenced in the resume"
                : "resume shows " + label(found) + "-level education";
        return "Job requires " + label(required) + "-level education; " + foundLabel + ".";
    }

    private static String label(EducationLevel level) {
        return switch (level) {
            case NONE -> "none";
            case DIPLOMA -> "diploma";
            case BACHELOR -> "bachelor";
            case MASTER -> "master";
            case PHD -> "doctorate";
        };
    }

    private static EducationLevel inferEducationLevel(String normalizedResume) {
        if (containsAny(normalizedResume, "phd", "ph d", "doctorate")) return EducationLevel.PHD;
        if (containsAny(normalizedResume, "master", "msc", "m tech", "mba", "postgraduate"))
            return EducationLevel.MASTER;
        if (containsAny(normalizedResume, "bachelor", "b tech", "btech", "b e", "bsc", "undergraduate"))
            return EducationLevel.BACHELOR;
        if (containsAny(normalizedResume, "diploma", "vocational")) return EducationLevel.DIPLOMA;
        return EducationLevel.NONE;
    }

    // ─────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────

    private static double cat(Double raw, Double weight, double applicableWeight) {
        if (raw == null || weight == null || raw < 0) return 0;
        return raw * (weight / applicableWeight);
    }

    private static Map<String, Object> category(boolean applicable, double score, String details) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("applicable", applicable);
        m.put("score", score);
        m.put("details", details);
        return m;
    }

    private static Map<String, Object> effectiveWeights(Map<String, Double> weights, double applicableWeight) {
        Map<String, Object> out = new LinkedHashMap<>();
        weights.forEach((k, v) -> out.put(k, Math.round((v / applicableWeight) * 1000.0) / 1000.0));
        return out;
    }
}
