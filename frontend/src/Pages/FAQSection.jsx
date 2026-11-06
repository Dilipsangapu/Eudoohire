import React, { useState, useRef } from "react";
import "./FAQSection.css";

const defaultFaqs = [
  {
    question: "How do I create a candidate profile?",
    answer: "Choose Register to create your account, complete your profile with your contact details, skills, education and experience, then save your information so employers can learn more about you."
  },
  {
    question: "How can I find jobs that match my skills?",
    answer: "Use the job search to enter a role, keyword or location. You can also browse the career categories and explore roles related to your interests and experience."
  },
  {
    question: "Is Euodoo Hire only for experienced professionals?",
    answer: "No. The platform can serve freshers, interns and experienced professionals. Browse entry-level opportunities as well as roles that require previous work experience."
  },
  {
    question: "How do recruiters use Euodoo Hire?",
    answer: "Recruiters can create a company profile, publish job openings and review relevant candidate profiles to support their hiring process."
  },
  {
    question: "Can I apply for more than one job?",
    answer: "You can explore multiple relevant openings and follow the application instructions shown for each job. Make sure your profile and resume are up to date before applying."
  },
  {
    question: "How do I get help if I have an issue?",
    answer: "Use the contact or support option provided on the portal to share your question. Include enough detail about the issue so the support team can assist you."
  },
];

function ChevronIcon({ expanded }) {
  return (
    <svg
      className={`faq-chevron${expanded ? " is-open" : ""}`}
      width="18"
      height="18"
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
  );
}

export default function FAQSection({ faqs: propFaqs = defaultFaqs }) {
  const faqs = Array.isArray(propFaqs) && propFaqs.length > 0 ? propFaqs : defaultFaqs;
  const [openIndex, setOpenIndex] = useState(0);
  const buttonRefs = useRef([]);

  const handleContactClick = (event) => {
    event.preventDefault();
    const footerElement = document.getElementById("footer") || document.querySelector("footer");
    if (footerElement) {
      footerElement.scrollIntoView({ behavior: "smooth" });
    } else {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    }
  };

  const handleKeyDown = (event, index) => {
    const total = faqs.length;
    let targetIndex = -1;

    switch (event.key) {
      case "ArrowDown":
        targetIndex = (index + 1) % total;
        break;
      case "ArrowUp":
        targetIndex = (index - 1 + total) % total;
        break;
      case "Home":
        targetIndex = 0;
        break;
      case "End":
        targetIndex = total - 1;
        break;
      default:
        return;
    }

    if (targetIndex >= 0 && buttonRefs.current[targetIndex]) {
      event.preventDefault();
      buttonRefs.current[targetIndex].focus();
    }
  };

  return (
    <section className="euodoo-faq-section" id="faq" aria-labelledby="faq-heading">
      <div className="container euodoo-faq-container">
        <div className="euodoo-faq-intro">
          <span className="euodoo-faq-eyebrow">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M9.6 9a2.5 2.5 0 1 1 4.2 1.8c-1.1 1-1.8 1.2-1.8 2.7M12 17h.01" />
            </svg>
            HELP CENTER
          </span>
          <h2 id="faq-heading">Questions? <span>We’re here to help.</span></h2>
          <p>Quick answers to help candidates and recruiters get started with Euodoo Hire.</p>
          <a className="euodoo-faq-contact" href="#footer" onClick={handleContactClick}>
            Still need help?
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M7 17 17 7M8 7h9v9" />
            </svg>
          </a>
        </div>

        <div className="euodoo-faq-list">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            const answerId = `faq-answer-${index}`;
            const questionId = `faq-question-${index}`;

            return (
              <article className={`euodoo-faq-item${isOpen ? " is-open" : ""}`} key={faq.question || index}>
                <h3 className="euodoo-faq-question-heading">
                  <button
                    ref={(el) => (buttonRefs.current[index] = el)}
                    className="euodoo-faq-question"
                    id={questionId}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={answerId}
                    onClick={() => setOpenIndex(isOpen ? -1 : index)}
                    onKeyDown={(event) => handleKeyDown(event, index)}
                  >
                    <span className="euodoo-faq-number">{String(index + 1).padStart(2, "0")}</span>
                    <span className="euodoo-faq-question-text">{faq.question}</span>
                    <span className="euodoo-faq-toggle"><ChevronIcon expanded={isOpen} /></span>
                  </button>
                </h3>
                <div
                  className="euodoo-faq-answer-wrap"
                  id={answerId}
                  role="region"
                  aria-labelledby={questionId}
                  hidden={!isOpen}
                >
                  <p className="euodoo-faq-answer">{faq.answer}</p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
