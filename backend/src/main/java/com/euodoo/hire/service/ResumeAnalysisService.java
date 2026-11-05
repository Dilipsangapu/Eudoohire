package com.euodoo.hire.service;

import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.regex.Pattern;

@Service
@Slf4j
public class ResumeAnalysisService {

    private static final List<String> COMMON_TECH_SKILLS = List.of(
            "Java", "Spring", "Spring Boot", "React", "JavaScript", "TypeScript",
            "Node.js", "Python", "SQL", "MongoDB", "PostgreSQL", "Docker",
            "Kubernetes", "AWS", "Git", "REST", "RESTful", "GraphQL", "HTML",
            "CSS", "Tailwind", "Redux", "CI/CD", "Next.js", "Microservices",
            "Agile", "Scrum", "Jira", "Unit Testing", "Jest", "JUnit"
    );

    private static final Pattern EMAIL_PATTERN = Pattern.compile("[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}");
    private static final Pattern PHONE_PATTERN = Pattern.compile("(\\+?\\d{1,3}[-.\\s]?)?\\(?\\d{3}\\)?[-.\\s]?\\d{3}[-.s]?\\d{4}|\\d{10}");
    private static final Pattern METRICS_PATTERN = Pattern.compile("\\b(\\d+%)|(\\$\\d+)|(\\d+\\+?\\s*(users|clients|projects|million|lakh|crore|years))\\b", Pattern.CASE_INSENSITIVE);

    public Map<String, Object> analyze(MultipartFile file, String textInput) {
        String extractedText = "";

        if (file != null && !file.isEmpty()) {
            extractedText = extractTextFromFile(file);
        } else if (textInput != null && !textInput.isBlank()) {
            extractedText = textInput;
        }

        if (extractedText.isBlank()) {
            return Map.of(
                    "score", 0,
                    "summary", "No resume content detected. Please provide a PDF, Word document, or resume text.",
                    "improvements", List.of("Attach a valid PDF or DOCX file with readable text."),
                    "detectedSkills", List.of(),
                    "keywords", List.of()
            );
        }

        return evaluateResumeText(extractedText);
    }

    private String extractTextFromFile(MultipartFile file) {
        String filename = file.getOriginalFilename() != null ? file.getOriginalFilename().toLowerCase() : "";
        try {
            return extractText(file.getBytes(), file.getOriginalFilename(), file.getContentType());
        } catch (Exception e) {
            log.warn("Failed to extract text from file {}: {}", filename, e.getMessage());
            return "";
        }
    }

    /**
     * Extracts plain text from resume bytes. Shared by the standalone analyzer
     * and the job-aware ATS engine. Supports PDF (PDFBox), DOCX (POI) and
     * UTF-8/simply-decoded text.
     */
    public String extractText(byte[] bytes, String filename, String mimeType) {
        String name = filename != null ? filename.toLowerCase() : "";
        String mime = mimeType != null ? mimeType.toLowerCase() : "";
        if (name.endsWith(".pdf") || "application/pdf".equals(mime)) {
            try (PDDocument doc = Loader.loadPDF(bytes)) {
                PDFTextStripper stripper = new PDFTextStripper();
                return stripper.getText(doc);
            } catch (Exception e) {
                log.warn("Failed to extract text from PDF {}: {}", name, e.getMessage());
                return "";
            }
        }
        if (name.endsWith(".docx")
                || "application/vnd.openxmlformats-officedocument.wordprocessingml.document".equals(mime)) {
            try (InputStream is = new java.io.ByteArrayInputStream(bytes);
                 XWPFDocument doc = new XWPFDocument(is);
                 XWPFWordExtractor extractor = new XWPFWordExtractor(doc)) {
                return extractor.getText();
            } catch (Exception e) {
                log.warn("Failed to extract text from DOCX {}: {}", name, e.getMessage());
                return "";
            }
        }
        return new String(bytes, StandardCharsets.UTF_8);
    }

    private Map<String, Object> evaluateResumeText(String text) {
        String lower = text.toLowerCase();
        int score = 0;
        List<String> improvements = new ArrayList<>();
        List<String> detectedSkills = new ArrayList<>();
        Map<String, Integer> sectionScores = new HashMap<>();

        // 1. Contact Info check (max 20 pts)
        int contactScore = 0;
        if (EMAIL_PATTERN.matcher(text).find()) contactScore += 10;
        if (PHONE_PATTERN.matcher(text).find()) contactScore += 10;
        if (contactScore < 20) {
            improvements.add("Ensure both email address and contact phone number are clearly visible at the top.");
        }
        sectionScores.put("contact", contactScore);
        score += contactScore;

        // 2. Sections check (max 25 pts)
        int structureScore = 0;
        boolean hasExperience = lower.contains("experience") || lower.contains("employment") || lower.contains("work history");
        boolean hasEducation = lower.contains("education") || lower.contains("academic") || lower.contains("degree") || lower.contains("university") || lower.contains("college");
        boolean hasSkills = lower.contains("skills") || lower.contains("technologies") || lower.contains("competencies");
        boolean hasSummary = lower.contains("summary") || lower.contains("profile") || lower.contains("objective");

        if (hasExperience) structureScore += 10; else improvements.add("Add a clearly titled 'Experience' or 'Work History' section.");
        if (hasEducation) structureScore += 5; else improvements.add("Include an 'Education' section with your degree and graduation details.");
        if (hasSkills) structureScore += 5; else improvements.add("Add a dedicated 'Skills' section with categorized competencies.");
        if (hasSummary) structureScore += 5; else improvements.add("Include a professional summary outlining your key strengths and experience.");
        sectionScores.put("structure", structureScore);
        score += structureScore;

        // 3. Technical Skills check (max 25 pts)
        for (String skill : COMMON_TECH_SKILLS) {
            if (Pattern.compile("\\b" + Pattern.quote(skill.toLowerCase()) + "\\b").matcher(lower).find()) {
                detectedSkills.add(skill);
            }
        }
        int skillsScore = Math.min(25, detectedSkills.size() * 3);
        if (detectedSkills.size() < 5) {
            improvements.add("Incorporate more industry keywords and technical skills relevant to your target role.");
        }
        sectionScores.put("skills", skillsScore);
        score += skillsScore;

        // 4. Measurable metrics & action verbs (max 15 pts)
        int metricsScore = 0;
        if (METRICS_PATTERN.matcher(text).find()) {
            metricsScore += 10;
        } else {
            improvements.add("Add quantifiable achievements (e.g. 'improved performance by 30%', 'managed team of 5').");
        }
        if (lower.contains("engineered") || lower.contains("developed") || lower.contains("led") ||
                lower.contains("designed") || lower.contains("implemented") || lower.contains("delivered")) {
            metricsScore += 5;
        } else {
            improvements.add("Start bullet points with strong action verbs (e.g. Engineered, Spearheaded, Optimized).");
        }
        sectionScores.put("impact", metricsScore);
        score += metricsScore;

        // 5. Length & Formatting (max 15 pts)
        int lengthScore = 0;
        int wordCount = text.split("\\s+").length;
        if (wordCount >= 200 && wordCount <= 1200) {
            lengthScore = 15;
        } else if (wordCount < 200) {
            lengthScore = 5;
            improvements.add("Resume appears too brief. Expand on your project accomplishments and responsibilities.");
        } else {
            lengthScore = 10;
            improvements.add("Resume is quite lengthy. Consider condensing it to 1-2 pages focused on relevant experience.");
        }
        sectionScores.put("formatting", lengthScore);
        score += lengthScore;

        String summary;
        if (score >= 85) {
            summary = "Excellent ATS readiness! Your resume has clear structure, relevant skills, and quantifiable impact.";
        } else if (score >= 70) {
            summary = "Good ATS profile. Addressing the highlighted improvement suggestions will make your application stand out even more.";
        } else {
            summary = "Resume needs optimization for applicant tracking systems. Follow the suggestions below to increase visibility.";
        }

        Map<String, Object> result = new HashMap<>();
        result.put("score", Math.min(100, Math.max(score, 10)));
        result.put("summary", summary);
        result.put("improvements", improvements);
        result.put("detectedSkills", detectedSkills);
        result.put("keywords", detectedSkills);
        result.put("sectionScores", sectionScores);
        return result;
    }
}
