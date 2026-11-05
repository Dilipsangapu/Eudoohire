import React from "react";
import FeaturedJobs from "./FeaturedJobs";
import CategoriesSection from "./CategoriesSection";
import FAQSection from "./FAQSection";
import { useNavigate } from "react-router-dom";

/** Main HR & Job Hiring Portal UI. Shared application shell is in App.jsx. */
export default function Portal() {
  const navigate = useNavigate();
  return (
    <>
<header className="navbar" role="banner">
      <div className="container">
        
    
<a href="#hero" className="nav-logo" aria-label="Euodoo Hire Home">
  <span className="nav-logo-icon" aria-hidden="true">
    <svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="2"
        y="2"
        width="16"
        height="16"
        rx="5"
        fill="#3B82F6"
      />
      <rect
        x="10"
        y="10"
        width="16"
        height="16"
        rx="5"
        stroke="#1D4ED8"
        strokeWidth="2.6"
        fill="none"
      />
    </svg>
  </span>

  <span className="nav-logo-text">Euodoo Hire</span>
</a>


        
        <nav className="nav-center" role="navigation" aria-label="Main navigation">
          
          <div className="nav-view-switcher" role="tablist" aria-label="Portal Mode">
            <button
              className="nav-view-btn active"
              id="nav-btn-candidate"
              role="tab"
              aria-selected="true"
              data-view="candidate"
            >
              Candidate
            </button>
            <button
              className="nav-view-btn"
              id="nav-btn-recruiter"
              role="tab"
              aria-selected="false"
              data-view="recruiter"
            >
              Recruiter
            </button>
          </div>

          <a href="#process-section" className="nav-link" data-scroll="process-section">How It Works</a>
                    <a href="#companies" className="nav-link" data-scroll="companies">Companies</a>

          <a href="#featured-jobs" className="nav-link" data-scroll="featured-jobs">Jobs</a>
        </nav>

        
       <div className="nav-actions">
  <button
    className="btn-nav-login"
    aria-label="Log in"
    onClick={() => navigate("/login")}
  >
    Login
  </button>

  <button
    className="btn-nav-register"
    aria-label="Register"
    onClick={() => navigate("/register")}
  >
    Register
  </button>

  <button
    type="button"
    className="btn-nav-recruiter-login"
    aria-label="Recruiter Login"
    onClick={() => navigate("/recruiter-login")}
  >
    Recruiter Login
  </button>
</div>

        
        <button
          className="nav-hamburger"
          aria-label="Toggle mobile menu"
          aria-expanded="false"
        >
          <span></span><span></span><span></span>
        </button>
      </div>
    </header>

    
    <nav className="mobile-nav" aria-label="Mobile navigation">
      <div className="mobile-nav-inner">
        <div className="mobile-nav-section">
          <div className="mobile-nav-title">Portal Mode</div>
          <div className="mobile-view-switcher">
            <button className="mobile-view-btn active" id="mobile-btn-candidate" data-view="candidate">
              Candidate
            </button>
            <button className="mobile-view-btn" id="mobile-btn-recruiter" data-view="recruiter">
              Recruiter
            </button>
          </div>
        </div>
        <div className="mobile-nav-section">
          <div className="mobile-nav-title">Menu</div>
          <button className="mobile-nav-link" data-scroll="process-section">How It Works</button>
          <button className="mobile-nav-link" data-scroll="featured-jobs">Browse Jobs</button>
          <button className="mobile-nav-link" data-scroll="categories">Job Categories</button>
          <button className="mobile-nav-link" data-scroll="companies">Top Companies</button>
        </div>
        <div className="mobile-nav-actions">
          <button
  className="btn-nav-login btn-nav-login-m btn btn-outline"
  onClick={() => navigate("/login")}
>
  Login
</button>

<button
  className="btn-nav-register btn-nav-register-m btn btn-white"
  onClick={() => navigate("/register")}
>
  Register
</button>

<button
  type="button"
  className="btn-nav-recruiter-login btn-nav-recruiter-login-m btn btn-outline"
  aria-label="Recruiter Login"
  onClick={() => navigate("/recruiter-login")}
>
  Recruiter Login
</button>
        </div>
      </div>
    </nav>

    
    <section className="hero" id="hero" aria-labelledby="hero-heading">
      
      <canvas id="hero-canvas" className="hero-canvas" aria-hidden="true"></canvas>
      <div className="container">
        <div className="hero-inner">
          
          <div className="hero-left">
            <div className="hero-badge" id="hero-badge" aria-label="Platform tagline">
              <span className="dot" aria-hidden="true"></span>
              <span id="hero-badge-text">Find your next opportunity</span>
            </div>
            <h1 className="hero-heading" id="hero-heading">
              Find work you <span>love</span>, hire people who
              <span> thrive</span>
            </h1>
            {/* <p className="hero-desc" id="hero-desc">
              Discover roles perfectly matched to your skills, or connect with
              India's top companies looking for talent like you. 
            </p> */}

            
            <div className="hero-actions-row" id="hero-actions-row">
            <button
  className="btn-pill-blue"
  id="hero-btn-primary"
  aria-label="Get Started as Candidate"
  onClick={() => navigate("/register")}
>
  <span id="hero-btn-primary-text">Get Started as Candidate</span>
  <span className="btn-arrow" aria-hidden="true">→</span>
</button>
              <button className="btn-pill-white" id="hero-btn-secondary" aria-label="I'm a recruiter">
                <span id="hero-btn-secondary-text">I’m a recruiter</span>
              </button>
            </div>

            
            <form
              className="search-box"
              id="search-form"
              role="search"
              aria-label="Job search"
            >
              <div className="search-field">
                <span className="field-icon" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                </span>
                <input
                  type="text"
                  id="search-keyword"
                  name="keyword"
                  placeholder="Job title, keyword, or company"
                  aria-label="Job title or keyword"
                  autoComplete="off"
                />
              </div>
              <div className="search-divider" aria-hidden="true"></div>
              <div className="search-field">
                <span className="field-icon" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                </span>
                <input
                  type="text"
                  id="search-location"
                  name="location"
                  placeholder="City or location"
                  aria-label="Location"
                  autoComplete="off"
                />
              </div>
              <div className="search-divider" aria-hidden="true"></div>
              <div className="search-field">
                <span className="field-icon" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                </span>
                <select id="search-type" name="type" aria-label="Job type">
                  <option value="">Job Type</option>
                  <option value="fulltime">Full-time</option>
                  <option value="parttime">Part-time</option>
                  <option value="remote">Remote</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="internship">Internship</option>
                  <option value="contract">Contract</option>
                </select>
              </div>
              <button type="submit" className="search-btn" aria-label="Search jobs">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                Search Jobs
              </button>
            </form>

            
            <div
              className="popular-tags"
              role="group"
              aria-label="Popular search tags"
            >
              <span className="popular-label">Popular:</span>
              <button className="tag" data-value="Remote">Remote</button>
              <button className="tag" data-value="Full-time">Full-time</button>
              <button className="tag" data-value="Software Developer">
                Software Dev
              </button>
              <button className="tag" data-value="UI/UX Designer">
                UI/UX Designer
              </button>
              <button className="tag" data-value="Marketing">Marketing</button>
            </div>
          </div>

          
          <div className="hero-right">
            
            <div
              className="profile-card"
              id="hero-profile-candidate"
              role="complementary"
              aria-label="Candidate profile preview"
            >
              
              <div className="card-badge-float badge-match" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
                <span>94% Match Found</span>
              </div>

              <div className="profile-card-top">
                <div className="profile-avatar" aria-hidden="true">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
                <div className="profile-info">
                  <div className="profile-name">Priya Sharma</div>
                  <div className="profile-role">Senior HR Manager</div>
                  <span className="status-badge">Open to Work</span>
                </div>
              </div>

              <div className="profile-progress-section">
                <div className="progress-header">
                  <span className="progress-label">Profile Completion</span>
                  <span className="progress-pct" aria-live="polite">68%</span>
                </div>
                <div
                  className="progress-bar"
                  role="progressbar"
                  aria-valuenow="68"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-label="Profile completion progress"
                >
                  <div className="progress-fill"></div>
                </div>
              </div>

              <div className="profile-stats" aria-label="Profile statistics">
                <div className="profile-stat">
                  <div className="profile-stat-num">24</div>
                  <div className="profile-stat-lbl">Applications</div>
                </div>
                <div className="profile-stat">
                  <div className="profile-stat-num">8</div>
                  <div className="profile-stat-lbl">Interviews</div>
                </div>
                <div className="profile-stat">
                  <div className="profile-stat-num">3</div>
                  <div className="profile-stat-lbl">Offers</div>
                </div>
              </div>

              <button
                className="btn btn-primary btn-complete-profile"
                aria-label="Complete your profile"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"/></svg>
                Create your Profile...
              </button>

              
              <div className="card-badge-float badge-hired" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                <span>2 new interview requests!</span>
              </div>
            </div>

            
            <div
              className="profile-card profile-card-recruiter"
              id="hero-profile-recruiter"
              role="complementary"
              aria-label="Recruiter dashboard preview"
              style={{display: "none"}}
            >
              
              <div className="card-badge-float badge-match" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
                <span>98% Matching Rate</span>
              </div>

              <div className="profile-card-top">
                <div className="profile-avatar recruiter-avatar" aria-hidden="true">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="9" y1="22" x2="9" y2="18"/><line x1="15" y1="22" x2="15" y2="18"/><line x1="8" y1="6" x2="10" y2="6"/><line x1="14" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="16" y2="10"/></svg>
                </div>
                <div className="profile-info">
                  <div className="profile-name">Apex Innovations</div>
                  <div className="profile-role">Arun Verma · Lead Partner</div>
                  <span className="status-badge recruiter-badge">Hiring Active</span>
                </div>
              </div>

              <div className="profile-progress-section">
                <div className="progress-header">
                  <span className="progress-label">Hiring Pipeline</span>
                  <span className="progress-pct" aria-live="polite">85% Filled</span>
                </div>
                <div
                  className="progress-bar"
                  role="progressbar"
                  aria-valuenow="85"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-label="Hiring pipeline progress"
                >
                  <div className="progress-fill" style={{width: "85%"}}></div>
                </div>
              </div>

              <div className="profile-stats" aria-label="Recruiter statistics">
                <div className="profile-stat">
                  <div className="profile-stat-num">12</div>
                  <div className="profile-stat-lbl">Active Jobs</div>
                </div>
                <div className="profile-stat">
                  <div className="profile-stat-num">148</div>
                  <div className="profile-stat-lbl">Screened</div>
                </div>
                <div className="profile-stat">
                  <div className="profile-stat-num">18</div>
                  <div className="profile-stat-lbl">Interviews</div>
                </div>
              </div>

              <button
                className="btn btn-primary btn-post-job"
                aria-label="Post a new job"
                onClick={(event) => { event.preventDefault(); event.stopPropagation(); event.nativeEvent.stopImmediatePropagation?.(); navigate("/login"); }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Post New Job
              </button>

              
              <div className="card-badge-float badge-hired" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                <span>5 top candidates ready!</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    
    <section className="process-section" id="process-section" aria-labelledby="process-heading">
      <div className="container">
        
        <div className="process-toggle-container">
          <div className="process-toggle" role="tablist" aria-label="Workflow role toggle">
            <button
              className="process-toggle-btn active"
              id="process-toggle-candidates"
              role="tab"
              aria-selected="true"
              data-target="candidates"
            >
              Candidates
            </button>
            <button
              className="process-toggle-btn"
              id="process-toggle-recruiters"
              role="tab"
              aria-selected="false"
              data-target="recruiters"
            >
              Recruiters
            </button>
          </div>
        </div>

        
        <div className="process-cards-grid" id="process-cards-candidates">
          
          <div className="process-card">
            <div className="process-card-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="3" ry="3"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            </div>
            <div className="process-card-step">Step 1</div>
            <h3 className="process-card-title">Register &amp; pay</h3>
            <button className="process-card-details" data-process-step="candidate-1" aria-label="Details for Register and pay">
              <span className="plus-circle" aria-hidden="true">+</span>
              <span>Details</span>
            </button>
          </div>

          
          <div className="process-card">
            <div className="process-card-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <div className="process-card-step">Step 2</div>
            <h3 className="process-card-title">Personal details</h3>
            <button className="process-card-details" data-process-step="candidate-2" aria-label="Details for Personal details">
              <span className="plus-circle" aria-hidden="true">+</span>
              <span>Details</span>
            </button>
          </div>

          
          <div className="process-card">
            <div className="process-card-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
            </div>
            <div className="process-card-step">Step 3</div>
            <h3 className="process-card-title">Education</h3>
            <button className="process-card-details" data-process-step="candidate-3" aria-label="Details for Education">
              <span className="plus-circle" aria-hidden="true">+</span>
              <span>Details</span>
            </button>
          </div>

          
          <div className="process-card">
            <div className="process-card-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
            </div>
            <div className="process-card-step">Step 4</div>
            <h3 className="process-card-title">Experience</h3>
            <button className="process-card-details" data-process-step="candidate-4" aria-label="Details for Experience">
              <span className="plus-circle" aria-hidden="true">+</span>
              <span>Details</span>
            </button>
          </div>

          
          <div className="process-card process-card-final">
            <div className="process-card-icon icon-final">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
            </div>
            <div className="process-card-step step-final">Final · Euodoo</div>
            <h3 className="process-card-title title-final">Euodoo releases you</h3>
            <button className="process-card-details details-final" data-process-step="candidate-final" aria-label="Details for Final Euodoo release">
              <span className="plus-circle" aria-hidden="true">+</span>
              <span>Details</span>
            </button>
          </div>
        </div>

        
        <div className="process-cards-grid" id="process-cards-recruiters" style={{display: "none"}}>
          
          <div className="process-card">
            <div className="process-card-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="9" y1="22" x2="9" y2="18"/><line x1="15" y1="22" x2="15" y2="18"/><line x1="8" y1="6" x2="10" y2="6"/><line x1="14" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="16" y2="10"/></svg>
            </div>
            <div className="process-card-step">Step 1</div>
            <h3 className="process-card-title">Company profile</h3>
            <button className="process-card-details" data-process-step="recruiter-1" aria-label="Details for Company profile">
              <span className="plus-circle" aria-hidden="true">+</span>
              <span>Details</span>
            </button>
          </div>

          
          <div className="process-card">
            <div className="process-card-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </div>
            <div className="process-card-step">Step 2</div>
            <h3 className="process-card-title">Post job opening</h3>
            <button className="process-card-details" data-process-step="recruiter-2" aria-label="Details for Post job opening">
              <span className="plus-circle" aria-hidden="true">+</span>
              <span>Details</span>
            </button>
          </div>

          
          <div className="process-card">
            <div className="process-card-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
            </div>
            <div className="process-card-step">Step 3</div>
            <h3 className="process-card-title">AI applicant match</h3>
            <button className="process-card-details" data-process-step="recruiter-3" aria-label="Details for AI applicant match">
              <span className="plus-circle" aria-hidden="true">+</span>
              <span>Details</span>
            </button>
          </div>

          
          <div className="process-card">
            <div className="process-card-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <div className="process-card-step">Step 4</div>
            <h3 className="process-card-title">Interview &amp; shortlist</h3>
            <button className="process-card-details" data-process-step="recruiter-4" aria-label="Details for Interview and shortlist">
              <span className="plus-circle" aria-hidden="true">+</span>
              <span>Details</span>
            </button>
          </div>

          
          <div className="process-card process-card-final">
            <div className="process-card-icon icon-final">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"/></svg>
            </div>
            <div className="process-card-step step-final">Final · Euodoo</div>
            <h3 className="process-card-title title-final">Hire top talent</h3>
            <button className="process-card-details details-final" data-process-step="recruiter-final" aria-label="Details for Hire top talent">
              <span className="plus-circle" aria-hidden="true">+</span>
              <span>Details</span>
            </button>
          </div>
        </div>
      </div>
    </section>

    
    <section className="stats-section" id="stats" aria-labelledby="stats-heading">
      <div className="container">
        <div className="stats-inner" role="list" aria-label="Platform statistics">
          <div className="stat-item" role="listitem">
            <div className="stat-number" id="stat-jobs" aria-label="Jobs available">
              0
            </div>
            <div className="stat-label">Jobs Available</div>
          </div>

          <div className="stat-item" role="listitem">
            <div
              className="stat-number"
              id="stat-companies"
              aria-label="Verified companies"
            >
              0
            </div>
            <div className="stat-label">Verified Companies</div>
          </div>

          <div className="stat-item" role="listitem">
            <div
              className="stat-number"
              id="stat-candidates"
              aria-label="Registered candidates"
            >
              0
            </div>
            <div className="stat-label">Registered Candidates</div>
          </div>

          <div className="stat-item" role="listitem">
            <div
              className="stat-number"
              id="stat-rate"
              aria-label="Satisfaction rate"
            >
              0
            </div>
            <div className="stat-label">Satisfaction Rate</div>
          </div>
        </div>
      </div>
    </section>

    
    <section
      className="companies-section"
      id="companies"
      aria-labelledby="companies-heading"
    >
      <div className="container">
        <div className="section-header-row reveal">
          <div className="left">
            <div className="section-tag" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="9" y1="22" x2="9" y2="18"/><line x1="15" y1="22" x2="15" y2="18"/><line x1="8" y1="6" x2="10" y2="6"/><line x1="14" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="14" y1="14" x2="16" y2="14"/></svg>
              Companies
            </div>
            <h2 id="companies-heading">Top companies hiring</h2>
            <p>Explore exciting opportunities from leading companies.</p>
          </div>
         <button
  className="view-all-link"
  aria-label="View all companies"
  onClick={() => navigate("/login")}
>
  View all companies
</button>
        </div>

        <div
          className="companies-grid"
          role="list"
          aria-label="Top hiring companies"
          onClickCapture={(event) => {
            // Stop the legacy demo script from opening the company-preview modal.
            // View Jobs should go straight to the Login page.
            const viewJobsButton = event.target.closest(".btn-view-jobs");

            if (viewJobsButton) {
              event.preventDefault();
              event.stopPropagation();
              navigate("/login");
            }
          }}
        >
          
          <article
            className="company-card reveal"
            role="listitem"
            data-company="TechNova"
          >
            <div className="company-card-top">
              <div
                className="company-logo"
                style={{background: "#eff6ff"}}
                aria-hidden="true"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4.5c1.62-1.62 4.5-2 4.5-2"/><path d="M12 15v5s3.03-.55 4.5-2c1.62-1.62 2-4.5 2-4.5"/></svg>
              </div>
              <div className="company-meta">
                <div className="company-name">TechNova</div>
                <div className="company-industry">Software &amp; Technology</div>
              </div>
              <span className="company-jobs-count" aria-label="18 open positions"
                >18 jobs</span
              >
            </div>
            <div className="company-divider" aria-hidden="true"></div>
            <div className="company-card-footer">
              <div className="company-tags">
                <span className="company-tag">Engineering</span>
                <span className="company-tag">Product</span>
              </div>
             
<button
  type="button"
  className="btn-view-jobs"
  data-company="TechNova"
  aria-label="View TechNova jobs"
  onClick={() => navigate("/login")}
>
  View Jobs
</button>

            </div>
          </article>

          
          <article
            className="company-card reveal"
            role="listitem"
            data-company="CloudCore"
          >
            <div className="company-card-top">
              <div
                className="company-logo"
                style={{background: "#f0fdf4"}}
                aria-hidden="true"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>
              </div>
              <div className="company-meta">
                <div className="company-name">CloudCore</div>
                <div className="company-industry">Cloud Infrastructure</div>
              </div>
              <span className="company-jobs-count" aria-label="12 open positions"
                >12 jobs</span
              >
            </div>
            <div className="company-divider" aria-hidden="true"></div>
            <div className="company-card-footer">
              <div className="company-tags">
                <span className="company-tag">DevOps</span>
                <span className="company-tag">Cloud</span>
              </div>
              <button
                type="button"
                className="btn-view-jobs"
                data-company="CloudCore"
                aria-label="View CloudCore jobs"
                onClick={() => navigate("/login")}
              >
                View Jobs
              </button>
            </div>
          </article>

          
          <article
            className="company-card reveal"
            role="listitem"
            data-company="NexaSoft"
          >
            <div className="company-card-top">
              <div
                className="company-logo"
                style={{background: "#fff7ed"}}
                aria-hidden="true"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EA580C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              </div>
              <div className="company-meta">
                <div className="company-name">NexaSoft</div>
                <div className="company-industry">Enterprise Software</div>
              </div>
              <span className="company-jobs-count" aria-label="9 open positions"
                >9 jobs</span
              >
            </div>
            <div className="company-divider" aria-hidden="true"></div>
            <div className="company-card-footer">
              <div className="company-tags">
                <span className="company-tag">Sales</span>
                <span className="company-tag">Data</span>
              </div>
              <button
                type="button"
                className="btn-view-jobs"
                data-company="NexaSoft"
                aria-label="View NexaSoft jobs"
                onClick={() => navigate("/login")}
              >
                View Jobs
              </button>
            </div>
          </article>

          
          <article
            className="company-card reveal"
            role="listitem"
            data-company="PixelWorks"
          >
            <div className="company-card-top">
              <div
                className="company-logo"
                style={{background: "#fdf4ff"}}
                aria-hidden="true"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9333EA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>
              </div>
              <div className="company-meta">
                <div className="company-name">PixelWorks</div>
                <div className="company-industry">Design &amp; Creative Studio</div>
              </div>
              <span className="company-jobs-count" aria-label="7 open positions"
                >7 jobs</span
              >
            </div>
            <div className="company-divider" aria-hidden="true"></div>
            <div className="company-card-footer">
              <div className="company-tags">
                <span className="company-tag">Design</span>
                <span className="company-tag">UX</span>
              </div>
              <button
                type="button"
                className="btn-view-jobs"
                data-company="PixelWorks"
                aria-label="View PixelWorks jobs"
                onClick={() => navigate("/login")}
              >
                View Jobs
              </button>
            </div>
          </article>

          
          <article
            className="company-card reveal"
            role="listitem"
            data-company="DataBridge"
          >
            <div className="company-card-top">
              <div
                className="company-logo"
                style={{background: "#ecfdf5"}}
                aria-hidden="true"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
              </div>
              <div className="company-meta">
                <div className="company-name">DataBridge</div>
                <div className="company-industry">Data &amp; Analytics</div>
              </div>
              <span className="company-jobs-count" aria-label="11 open positions"
                >11 jobs</span
              >
            </div>
            <div className="company-divider" aria-hidden="true"></div>
            <div className="company-card-footer">
              <div className="company-tags">
                <span className="company-tag">Analytics</span>
                <span className="company-tag">ML</span>
              </div>
              <button
                type="button"
                className="btn-view-jobs"
                data-company="DataBridge"
                aria-label="View DataBridge jobs"
                onClick={() => navigate("/login")}
              >
                View Jobs
              </button>
            </div>
          </article>

          
          <article
            className="company-card reveal"
            role="listitem"
            data-company="BrightLabs"
          >
            <div className="company-card-top">
              <div
                className="company-logo"
                style={{background: "#fff1f2"}}
                aria-hidden="true"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E11D48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5.76.76 1.23 1.52 1.41 2.5h6.18z"/></svg>
              </div>
              <div className="company-meta">
                <div className="company-name">BrightLabs</div>
                <div className="company-industry">HR Tech &amp; People Ops</div>
              </div>
              <span className="company-jobs-count" aria-label="14 open positions"
                >14 jobs</span
              >
            </div>
            <div className="company-divider" aria-hidden="true"></div>
            <div className="company-card-footer">
              <div className="company-tags">
                <span className="company-tag">HR</span>
                <span className="company-tag">Operations</span>
              </div>
              <button
                type="button"
                className="btn-view-jobs"
                data-company="BrightLabs"
                aria-label="View BrightLabs jobs"
                onClick={() => navigate("/login")}
              >
                View Jobs
              </button>
            </div>
          </article>
        </div>
      </div>
    </section>

    
  <CategoriesSection />

    
    {/* Featured jobs are rendered by the reusable component below. */}

    
    <FeaturedJobs />
    

    
    <section className="cta-section" id="post-job" aria-labelledby="cta-heading">
      <div className="container">
        <div className="cta-banner reveal">
          <div className="cta-content">
            <div className="cta-tag" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4.5c1.62-1.62 4.5-2 4.5-2"/><path d="M12 15v5s3.03-.55 4.5-2c1.62-1.62 2-4.5 2-4.5"/></svg>
              For Employers
            </div>
            <h2 className="cta-heading" id="cta-heading">
              Hiring? Post a job in minutes
            </h2>
            <p className="cta-desc">
              Reach talented candidates, streamline your recruitment, and build
              your dream team. Start posting today and find the perfect hire.
            </p>
          </div>
          <div className="cta-actions">
            <button
              className="btn btn-white btn-lg btn-post-job"
              aria-label="Post a job"
              onClick={(event) => { event.preventDefault(); event.stopPropagation(); event.nativeEvent.stopImmediatePropagation?.(); navigate("/login"); }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Post a Job
            </button>
            <button
              className="btn btn-outline btn-lg btn-talk-sales"
              aria-label="Talk to sales team"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              Talk to Sales
            </button>
          </div>
        </div>
      </div>
    </section>
<FAQSection />
    
    <footer className="footer" id="footer" role="contentinfo">
      <div className="container">
        <div className="footer-grid">
          
          <div className="footer-brand">
            <div className="footer-logo">
              <div className="footer-logo-icon" aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="2" y="2" width="16" height="16" rx="5" fill="#3B82F6"/>
                  <rect x="10" y="10" width="16" height="16" rx="5" stroke="#1D4ED8" strokeWidth="2.6" fill="none"/>
                </svg>
              </div>
              <span className="footer-logo-text">Euodoo Hire</span>
            </div>
            <p className="footer-desc">
              India's most trusted hiring platform connecting talented
              professionals with top employers across every industry.
            </p>
            <div className="footer-socials" aria-label="Social media links">
              <button className="social-btn" aria-label="LinkedIn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
              </button>
              <button className="social-btn" aria-label="Twitter / X">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </button>
              <button className="social-btn" aria-label="Facebook">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
              </button>
              <button className="social-btn" aria-label="Instagram">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
              </button>
            </div>
          </div>

          
          <div>
            <div className="footer-col-title">For Candidates</div>
            <ul className="footer-links">
              <li>
                <button className="footer-link" data-scroll="featured-jobs">
                  Browse Jobs
                </button>
              </li>
              <li><button className="footer-link">Career Advice</button></li>
              <li><button className="footer-link">Saved Jobs</button></li>
              <li><button className="footer-link">Resume Builder</button></li>
              <li>
                <button className="footer-link" data-scroll="categories">
                  Job Categories
                </button>
              </li>
            </ul>
          </div>

          
          <div>
            <div className="footer-col-title">For Recruiters</div>
            <ul className="footer-links">
              <li>
                <button className="footer-link btn-post-job" onClick={(event) => { event.preventDefault(); event.stopPropagation(); event.nativeEvent.stopImmediatePropagation?.(); navigate("/login"); }}>Post a Job</button>
              </li>
              <li>
                <button className="footer-link" data-scroll="featured-jobs">
                  Find Candidates
                </button>
              </li>
              <li><button className="footer-link">Pricing Plans</button></li>
              <li><button className="footer-link">Recruiter Dashboard</button></li>
            </ul>
          </div>

          
          <div>
            <div className="footer-col-title">Resources</div>
            <ul className="footer-links">
              <li><button className="footer-link">Help Center</button></li>
              <li><button className="footer-link">Hiring Guide</button></li>
              <li><button className="footer-link">FAQs</button></li>
              <li><button className="footer-link">Blog</button></li>
            </ul>
          </div>

          
          <div>
            <div className="footer-col-title">Company</div>
            <ul className="footer-links">
              <li><button className="footer-link">About Us</button></li>
              <li><button className="footer-link">Contact</button></li>
              <li><button className="footer-link">Privacy Policy</button></li>
              <li><button className="footer-link">Terms of Service</button></li>
            </ul>
          </div>
        </div>

        
        <div className="footer-bottom">
          <p className="footer-copy">
            © 2026 Euodoo Hire Portal. All rights reserved. Built for demo
            purposes.
          </p>
          <div className="footer-bottom-links">
            <button className="footer-bottom-link">Privacy</button>
            <button className="footer-bottom-link">Terms</button>
            <button className="footer-bottom-link">Cookies</button>
            <button className="footer-bottom-link">Sitemap</button>
          </div>
        </div>
      </div>
    </footer>

    
    <div
      className="modal-overlay"
      id="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      aria-describedby="modal-body"
    >
      <div className="modal">
        <button
          className="modal-close"
          id="modal-close-btn"
          aria-label="Close modal"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <div className="modal-icon" id="modal-icon" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4.5c1.62-1.62 4.5-2 4.5-2"/><path d="M12 15v5s3.03-.55 4.5-2c1.62-1.62 2-4.5 2-4.5"/></svg>
        </div>
        <h3 id="modal-title">Demo Feature</h3>
        <p id="modal-body">This feature is available in the demo portal.</p>
        <div className="modal-actions">
          <button
            className="btn btn-ghost"
            id="modal-cancel-btn"
            aria-label="Cancel"
          >
            Cancel
          </button>
          <button className="btn btn-primary" id="modal-ok-btn" aria-label="Got it">
            Got it!
          </button>
        </div>
      </div>
    </div>

    
    <div
      className="toast-container"
      id="toast-container"
      role="region"
      aria-live="polite"
      aria-label="Notifications"
    ></div>

    
    </>
    );
}
