package com.euodoo.hire.service;

import com.euodoo.hire.exception.BusinessException;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.safety.Safelist;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.openhtmltopdf.extend.FSSupplier;
import com.openhtmltopdf.outputdevice.helper.BaseRendererBuilder.FontStyle;
import com.openhtmltopdf.pdfboxout.PdfBoxRenderer;
import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;

/**
 * Converts the rendered resume HTML (produced by the existing resume builder)
 * into a genuine PDF.
 *
 * Renderer: OpenHTMLtoPDF ({@code io.github.openhtmltopdf:openhtmltopdf-pdfbox}),
 * the actively maintained pure-Java fork of openhtmltopdf, which renders a
 * CSS 2.1 subset of XHTML directly onto Apache PDFBox — the same PDFBox major
 * version already used for resume validation. No headless browser involved.
 *
 * The on-screen resume stylesheet (static/css/resume.css) uses CSS Grid,
 * Flexbox and color-mix(), which a CSS 2.1 renderer cannot resolve, so the
 * equivalent paged stylesheet {@code pdf/resume-pdf.css} is substituted at
 * render time. It keeps the same page geometry (794 x 1123 px @ 96 dpi = A4),
 * colors, borders, radii and section rhythm; the two-column layouts are
 * expressed as HTML tables. The resume markup itself is not modified.
 *
 * Fonts: the templates reference web fonts (Inter, Merriweather, Nunito,
 * JetBrains Mono) that are not installed on a server, so metrically similar,
 * open-licensed Noto fonts are embedded from the classpath. This gives real,
 * extractable text (not images), which keeps resumes ATS-parsable.
 *
 * Client-supplied markup is never trusted: the fragment is parsed and
 * sanitised with a strict safelist (structure + classes only) before it can
 * reach the renderer.
 */
@Service
@Slf4j
public class ResumePdfService {

    /** Paged stylesheet derived from static/css/resume.css. */
    private static final String PDF_STYLESHEET = "pdf/resume-pdf.css";

    /**
     * Default accents per template id, matching templates.js (renderer only.
     * Used when neither the markup nor the stored record carries an accent).
     */
    private static final Map<String, String> TEMPLATE_ACCENTS = Map.of(
            "modern", "#2563eb",
            "classic", "#1e293b",
            "executive", "#0f3d3e",
            "creative", "#db2777",
            "minimal", "#111827",
            "tech", "#10b981",
            "elegant", "#7c3aed",
            "fresher", "#0891b2");

    private static final String DEFAULT_ACCENT = "#2563eb";

    /** Font family -> [classpath file, weight]. Fonts are embedded (ADD_SUBSET default). */
    private static final List<FontRegistration> FONT_REGISTRATIONS = List.of(
            new FontRegistration("fonts/NotoSans-Regular.ttf", "Inter", 400),
            new FontRegistration("fonts/NotoSans-Bold.ttf", "Inter", 700),
            new FontRegistration("fonts/NotoSans-Regular.ttf", "Nunito", 400),
            new FontRegistration("fonts/NotoSans-Bold.ttf", "Nunito", 700),
            // JetBrains Mono is not bundled; headings fall back to the sans face.
            new FontRegistration("fonts/NotoSans-Regular.ttf", "JetBrains Mono", 400),
            new FontRegistration("fonts/NotoSans-Bold.ttf", "JetBrains Mono", 700),
            new FontRegistration("fonts/NotoSans-Regular.ttf", "sans-serif", 400),
            new FontRegistration("fonts/NotoSans-Bold.ttf", "sans-serif", 700),
            new FontRegistration("fonts/NotoSerif-Regular.ttf", "Merriweather", 400),
            new FontRegistration("fonts/NotoSerif-Bold.ttf", "Merriweather", 700),
            new FontRegistration("fonts/NotoSerif-Regular.ttf", "serif", 400),
            new FontRegistration("fonts/NotoSerif-Bold.ttf", "serif", 700));

    /** The order of embedded text is decided by the resolved font, not the stack, so the fallbacks stay close. */

    private static final Pattern ACCENT_PATTERN =
            Pattern.compile("--accent\\s*:\\s*(#[0-9A-Fa-f]{3}|#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{8}|rgb[a]?\\([^)]*\\))");

    private String stylesheetTemplate;

    private record FontRegistration(String path, String family, int weight) {
    }

    @PostConstruct
    void loadStylesheet() {
        try (InputStream in = new ClassPathResource(PDF_STYLESHEET).getInputStream()) {
            stylesheetTemplate = new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException("Could not load bundled PDF stylesheet " + PDF_STYLESHEET, e);
        }
    }

    /**
     * Renders the builder's resume HTML fragment as a validated PDF.
     *
     * @param htmlFragment   the rendered resume markup (the {@code .resume} div)
     * @param templateId     template selected in the builder (accent fallback)
     * @param accentColor    accent stored on the resume record (fallback of last order)
     * @return genuine PDF bytes that start with the {@code %PDF-} signature and
     *         parse cleanly with PDFBox; never an HTML document.
     * @throws BusinessException when the content is empty or cannot be rendered.
     */
    public byte[] generateResumePdf(String htmlFragment, String templateId, String accentColor) {
        if (htmlFragment == null || htmlFragment.isBlank()) {
            throw new BusinessException("PDF_GENERATION_FAILED",
                    "The resume content is empty, so no PDF could be generated.");
        }

        try {
            String accent = resolveAccent(htmlFragment, templateId, accentColor);
            String sanitised = sanitiseFragment(htmlFragment);
            if (sanitised.isBlank()) {
                throw new BusinessException("PDF_GENERATION_FAILED",
                        "The resume content could not be processed, so no PDF could be generated.");
            }
            String css = stylesheetTemplate
                    .replace("@@ACCENT@@", accent)
                    .replace("@@ACCENT_TINT12@@", mixWithWhite(accent, 0.12))
                    .replace("@@ACCENT_A60@@", accentWithAlpha(accent, 0.60));

            String xhtml = "<!DOCTYPE html>\n<html xmlns=\"http://www.w3.org/1999/xhtml\">\n"
                    + "<head><meta charset=\"UTF-8\"/><title>Resume</title><style>" + css + "</style></head>\n"
                    + "<body>" + sanitised + "</body></html>";

            byte[] bytes = render(xhtml);
            validatePdfBytes(bytes);
            return bytes;
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("Resume PDF generation failed: {}", e.getMessage(), e);
            throw new BusinessException("PDF_GENERATION_FAILED",
                    "The resume could not be converted to PDF. Please try again.");
        }
    }

    // ─────────────────────────────────────────────────
    // Internals
    // ─────────────────────────────────────────────────

    private byte[] render(String xhtml) throws IOException {
        java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
        PdfRendererBuilder builder = new PdfRendererBuilder();
        builder.useFastMode();
        for (FontRegistration font : FONT_REGISTRATIONS) {
            final String path = font.path();
            builder.useFont((FSSupplier<InputStream>) () -> openFont(path),
                    font.family(), font.weight(), FontStyle.NORMAL, true);
        }
        builder.withHtmlContent(xhtml, "");
        builder.toStream(out);
        try (PdfBoxRenderer renderer = builder.buildPdfRenderer()) {
            // createPDF() writes the document and closes the stream it was given.
            renderer.createPDF();
        }
        return out.toByteArray();
    }

    private InputStream openFont(String path) {
        try {
            return new ClassPathResource(path).getInputStream();
        } catch (IOException e) {
            throw new IllegalStateException("Bundled font missing on classpath: " + path, e);
        }
    }

    /**
     * Structural safelist: only the markup the builder actually produces and
     * no scripting vectors; style attributes are dropped (the stylesheet
     * carries all colours) but class names are kept so themes survive.
     */
    private String sanitiseFragment(String htmlFragment) {
        Safelist safelist = new Safelist()
                .addTags("div", "aside", "main", "header", "p", "span", "strong", "small",
                        "h1", "h2", "h3", "h4", "ul", "ol", "li", "br", "em", "b", "i")
                .addAttributes(":all", "class");
        Document.OutputSettings xml = new Document.OutputSettings()
                .syntax(Document.OutputSettings.Syntax.xml)
                .charset(StandardCharsets.UTF_8)
                .prettyPrint(false);
        String cleaned = Jsoup.clean(htmlFragment, "", safelist, xml);
        Document reparsed = Jsoup.parseBodyFragment(cleaned);
        reparsed.outputSettings(xml);
        // Trim outer whitespace so no empty line box is emitted after the A4
        // page-height block (that would spill onto a blank second page).
        return reparsed.body().html().trim();
    }

    /**
     * Accent priority: the inline {@code --accent} custom property of the
     * supplied markup (reflects the live colour picker), then the accent
     * stored on the resume record, then the template default.
     */
    private String resolveAccent(String htmlFragment, String templateId, String accentColor) {
        Matcher matcher = ACCENT_PATTERN.matcher(htmlFragment);
        if (matcher.find()) {
            String fromMarkup = normaliseColor(matcher.group(1));
            if (fromMarkup != null) return fromMarkup;
        }
        String fromRecord = accentColor != null && !accentColor.isBlank()
                ? normaliseColor(accentColor.trim()) : null;
        if (fromRecord != null) return fromRecord;
        if (templateId != null && TEMPLATE_ACCENTS.containsKey(templateId.toLowerCase(Locale.ROOT))) {
            return TEMPLATE_ACCENTS.get(templateId.toLowerCase(Locale.ROOT));
        }
        return DEFAULT_ACCENT;
    }

    /** Accepts common web colour notations and returns a plain {@code #rrggbb} string, or null. */
    private String normaliseColor(String value) {
        if (value == null) return null;
        String v = value.trim().toLowerCase(Locale.ROOT);
        try {
            if (v.matches("#[0-9a-f]{4,8}")) {
                if (v.length() == 5 || v.length() == 9) {
                    // RGBA/RRGGBBAA notation: strip the alpha channel.
                    v = v.substring(0, v.length() - 1);
                }
                if (v.length() == 4) {
                    v = "#" + v.charAt(1) + v.charAt(1) + v.charAt(2) + v.charAt(2)
                            + v.charAt(3) + v.charAt(3);
                }
                return v;
            }
            if (v.startsWith("rgb")) {
                Matcher numbers = Pattern.compile("\\d+").matcher(v);
                int[] vals = new int[3];
                int i = 0;
                while (numbers.find() && i < 3) {
                    vals[i++] = Integer.parseUnsignedInt(numbers.group());
                }
                if (i == 3) {
                    return String.format("#%02x%02x%02x",
                            Math.min(255, vals[0]), Math.min(255, vals[1]), Math.min(255, vals[2]));
                }
            }
        } catch (NumberFormatException ignored) {
            // fall through
        }
        return null;
    }

    /** Mixes the accent with white: {@code ratio} of accent over white (0..1). */
    private String mixWithWhite(String accent, double ratio) {
        int[] rgb = parseHexRgb(accent);
        int r = (int) Math.round(rgb[0] * ratio + 255 * (1 - ratio));
        int g = (int) Math.round(rgb[1] * ratio + 255 * (1 - ratio));
        int b = (int) Math.round(rgb[2] * ratio + 255 * (1 - ratio));
        return String.format("#%02x%02x%02x", r, g, b);
    }

    private String accentWithAlpha(String accent, double alpha) {
        int[] rgb = parseHexRgb(accent);
        return String.format("rgba(%d,%d,%d,%.2f)", rgb[0], rgb[1], rgb[2], alpha);
    }

    private int[] parseHexRgb(String accent) {
        String v = accent.length() == 4 ? ("#" + accent.charAt(1) + accent.charAt(1)
                + accent.charAt(2) + accent.charAt(2) + accent.charAt(3) + accent.charAt(3)) : accent;
        return new int[]{
                Integer.parseUnsignedInt(v.substring(1, 3), 16),
                Integer.parseUnsignedInt(v.substring(3, 5), 16),
                Integer.parseUnsignedInt(v.substring(5, 7), 16)};
    }

    /**
     * Guards against ever storing a broken or mislabelled file: an honest
     * PDF signature first, then a full PDFBox parse (same check the upload
     * path uses) plus a minimum page count.
     */
    private void validatePdfBytes(byte[] bytes) {
        if (bytes == null || bytes.length == 0) {
            throw new BusinessException("PDF_GENERATION_FAILED",
                    "The PDF conversion produced no output. Please try again.");
        }
        if (bytes[0] != '%' || !startsWithPdfSignature(bytes)) {
            throw new BusinessException("PDF_GENERATION_FAILED",
                    "The PDF conversion produced an invalid document. Please try again.");
        }
        try (PDDocument doc = Loader.loadPDF(bytes)) {
            if (doc.getNumberOfPages() < 1) {
                throw new BusinessException("PDF_GENERATION_FAILED",
                        "The PDF conversion produced an empty document. Please try again.");
            }
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("Generated resume PDF failed validation: {}", e.getMessage());
            throw new BusinessException("PDF_GENERATION_FAILED",
                    "The PDF conversion produced an invalid document. Please try again.");
        }
    }

    private boolean startsWithPdfSignature(byte[] bytes) {
        byte[] magic = "%PDF-".getBytes(StandardCharsets.US_ASCII);
        if (bytes.length < magic.length) return false;
        for (int i = 0; i < magic.length; i++) {
            if (bytes[i] != magic[i]) return false;
        }
        return true;
    }
}
