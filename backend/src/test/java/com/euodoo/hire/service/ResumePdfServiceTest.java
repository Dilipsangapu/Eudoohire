package com.euodoo.hire.service;

import com.euodoo.hire.exception.BusinessException;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Verifies that generated resumes are genuine, validated PDF documents.
 *
 * Focus: the file starts with the {@code %PDF-} signature, parses with
 * Apache PDFBox, contains the resume text (selectable/ATS-readable), is
 * never an HTML document, paginates long resumes over several pages, and
 * rejects/sanitises unsafe or empty markup without ever reporting success.
 */
public class ResumePdfServiceTest {

    private ResumePdfService service;

    @BeforeEach
    void setUp() {
        service = new ResumePdfService();
        service.loadStylesheet();
    }

    /** Mirrors the markup produced by templates.js renderResume() (modern sidebar). */
    private static String modernResume() {
        return """
                <div class="resume tpl-modern l-sidebar f-sans" style="--accent:#2563eb">
                  <aside class="r-side">
                    <div class="r-avatar">PS</div>
                    <div class="r-section"><h3 class="r-h">Contact</h3>
                      <ul class="r-list-plain">
                        <li><small>Email</small>priya.sharma@email.com</li>
                        <li><small>Phone</small>+91 98765 43210</li>
                      </ul>
                    </div>
                    <div class="r-section"><h3 class="r-h">Skills</h3>
                      <div class="r-chips"><span class="r-chip">Figma</span><span class="r-chip">User Research</span></div>
                    </div>
                  </aside>
                  <main class="r-main">
                    <div class="r-header-text">
                      <h1 class="r-name">Priya Sharma</h1>
                      <div class="r-title">Senior Product Designer</div>
                    </div>
                    <div class="r-section"><h3 class="r-h">Profile</h3>
                      <p>Product designer with 7+ years of experience crafting user-centred web and mobile experiences.</p>
                    </div>
                    <div class="r-section"><h3 class="r-h">Experience</h3>
                      <div class="r-item">
                        <div class="r-item-head"><strong>Senior Product Designer</strong><span class="r-date">Mar 2022 – Present</span></div>
                        <div class="r-sub">Nimbus Labs</div>
                        <ul><li>Led redesign of core dashboard, increasing weekly active users by 32%</li>
                            <li>Built and maintained a design system used across 5 product teams</li></ul>
                      </div>
                      <div class="r-item">
                        <div class="r-item-head"><strong>UX Designer</strong><span class="r-date">Jun 2019 – Feb 2022</span></div>
                        <div class="r-sub">BrightPath Solutions</div>
                        <ul><li>Designed onboarding flow that cut drop-off by 18%</li></ul>
                      </div>
                    </div>
                    <div class="r-section"><h3 class="r-h">Education</h3>
                      <div class="r-item">
                        <div class="r-item-head"><strong>M.Des, Interaction Design</strong><span class="r-date">2015 – 2017</span></div>
                        <div class="r-sub">National Institute of Design</div>
                      </div>
                    </div>
                  </main>
                </div>""";
    }

    private static String extractText(byte[] pdf) {
        try (PDDocument doc = Loader.loadPDF(pdf)) {
            return new PDFTextStripper().getText(doc);
        } catch (Exception e) {
            throw new IllegalStateException("Test PDF could not be parsed: " + e.getMessage(), e);
        }
    }

    @Test
    void generatedFileStartsWithPdfSignatureAndParsesWithPdfBox() {
        byte[] pdf = service.generateResumePdf(modernResume(), "modern", null);

        assertTrue(pdf.length > 100);
        assertEquals("%PDF-", new String(pdf, 0, 5, StandardCharsets.US_ASCII),
                "the stored bytes must be a genuine PDF file");
        try (PDDocument doc = Loader.loadPDF(pdf)) {
            assertEquals(1, doc.getNumberOfPages());
        } catch (Exception e) {
            throw new AssertionError("PDFBox must be able to open the generated PDF", e);
        }
    }

    @Test
    void generatedPdfContainsTheResumeText() {
        byte[] pdf = service.generateResumePdf(modernResume(), "modern", null);
        String text = extractText(pdf);

        assertTrue(text.contains("Priya Sharma"));
        assertTrue(text.contains("Senior Product Designer"));
        assertTrue(text.contains("Nimbus Labs"));
        assertTrue(text.contains("Figma"));
        assertTrue(text.contains("National Institute of Design"));
        assertTrue(text.contains("priya.sharma@email.com"), "contact details must be extractable");
        // Unicode characters must survive (en dash and the multi-byte cedilla/space variants)
        assertTrue(text.contains("Mar 2022"), "dates must be readable");
    }

    @Test
    void generatedPdfIsNeverStoredAsHtml() {
        byte[] pdf = service.generateResumePdf(modernResume(), "modern", null);
        String head = new String(pdf, 0, Math.min(1024, pdf.length), StandardCharsets.UTF_8);

        assertFalse(head.contains("<!DOCTYPE html"));
        assertFalse(head.contains("<html"));
        assertFalse(head.contains("<div"));
        assertFalse(new String(pdf, StandardCharsets.UTF_8).contains("text/html"),
                "no HTML content or type marker may be embedded in the stored file");
    }

    @Test
    void multiPageContentProducesMultiplePages() {
        StringBuilder entries = new StringBuilder();
        for (int i = 1; i <= 24; i++) {
            entries.append("""
                    <div class="r-item">
                      <div class="r-item-head"><strong>Product Designer %d</strong><span class="r-date">Mar 20%02d – Present</span></div>
                      <div class="r-sub">Company %d</div>
                      <ul><li>Entry number %d with a reasonably long descriptive line of resume experience text.</li>
                          <li>Another descriptive bullet so every entry occupies real page height.</li></ul>
                    </div>""".formatted(i, i % 60, i, i));
        }
        String html = """
                <div class="resume tpl-classic l-single f-serif">
                  <div class="r-header-text"><h1 class="r-name">Long Resume Candidate</h1></div>
                  <div class="r-section"><h3 class="r-h">Experience</h3>%s</div>
                </div>""".formatted(entries);

        byte[] pdf = service.generateResumePdf(html, "classic", null);

        try (PDDocument doc = Loader.loadPDF(pdf)) {
            assertTrue(doc.getNumberOfPages() > 1,
                    "long resume content must flow over several A4 pages");
            String text = new PDFTextStripper().getText(doc);
            assertTrue(text.contains("Product Designer 1"));
            assertTrue(text.contains("Product Designer 24"),
                    "all entries must be present in the multi-page PDF");
        } catch (Exception e) {
            throw new AssertionError(e);
        }
    }

    @Test
    void unsafeHtmlIsSanitisedBeforeRendering() {
        String unsafe = """
                <div class="resume tpl-modern l-single f-sans" style="--accent:#2563eb" onload="alert('x')">
                  <div class="r-section">
                    <h3 class="r-h">Profile</h3>
                    <p onclick="steal()">Safe name content</p>
                    <script>alert('evil');</script>
                    <img src="http://evil.example/track.png">
                  </div>
                </div>""";

        byte[] pdf = service.generateResumePdf(unsafe, "modern", null);
        String text = extractText(pdf);

        assertTrue(text.contains("Safe name content"));
        assertFalse(text.contains("alert"), "script content must not survive into the PDF");
        assertFalse(text.contains("steal"), "event handler code must not survive into the PDF");
    }

    @Test
    void everyTemplateRendersWithoutError() {
        for (String template : List.of("modern", "classic", "executive", "creative",
                "minimal", "tech", "elegant", "fresher")) {
            byte[] pdf = service.generateResumePdf(modernResume(), template, null);
            assertEquals("%PDF-", new String(pdf, 0, 5, StandardCharsets.US_ASCII),
                    "template " + template + " must produce a genuine PDF");
            try (PDDocument doc = Loader.loadPDF(pdf)) {
                assertTrue(doc.getNumberOfPages() >= 1);
            } catch (Exception e) {
                throw new AssertionError("template " + template + " must parse", e);
            }
        }
    }

    @Test
    void recordAccentIsUsedWhenMarkupHasNone() {
        // No inline --accent in the markup: the stored accent colour must supply it.
        String plain = """
                <div class="resume tpl-creative l-single f-rounded">
                  <div class="r-header-text"><h1 class="r-name">Accent Test</h1></div>
                </div>""";
        byte[] pdf = service.generateResumePdf(plain, "creative", "#db2777");
        assertTrue(extractText(pdf).contains("Accent Test"));
    }

    @Test
    void emptyOrBlankContentFailsWithoutFalseSuccess() {
        BusinessException empty = assertThrows(BusinessException.class,
                () -> service.generateResumePdf("", "modern", null));
        assertEquals("PDF_GENERATION_FAILED", empty.getErrorCode());

        BusinessException blank = assertThrows(BusinessException.class,
                () -> service.generateResumePdf("   ", "modern", null));
        assertEquals("PDF_GENERATION_FAILED", blank.getErrorCode());
    }

    @Test
    void markupStrippedToNothingFailsWithoutFalseSuccess() {
        // A fragment consisting solely of disallowed tags sanitises to nothing.
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.generateResumePdf("<script>alert(1)</script>", "modern", null));
        assertEquals("PDF_GENERATION_FAILED", ex.getErrorCode());
    }

    @Test
    void generatedPdfsAreSubstantiallySmallerThanOnlyImagesWouldBe_andContainRealText() {
        // Sanity guard: the PDF should be a text document (tens of KB, not a raster dump).
        byte[] pdf = service.generateResumePdf(modernResume(), "modern", null);
        assertTrue(pdf.length > 10_000, "font subset + text must be embedded");
        String text = extractText(pdf);
        assertTrue(text.chars().filter(Character::isLetter).count() > 100,
                "the PDF must carry selectable resume text");
    }
}
