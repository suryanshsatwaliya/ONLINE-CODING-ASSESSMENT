import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  Code2,
  Github,
  GraduationCap,
  LockKeyhole,
  Eye,
  ClipboardCheck,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import Navbar from "../../components/layout/Navbar";
import ThemeToggle from "../../components/common/ThemeToggle";

const features = [
  {
    icon: Code2,
    title: "Coding assessments",
    description: "Pair quick knowledge checks with hands-on programming tasks in one assessment.",
  },
  {
    icon: GraduationCap,
    title: "Student practice",
    description: "A focused workspace helps students move through questions and keep their work saved.",
  },
  {
    icon: Activity,
    title: "Teacher analytics",
    description: "Review submissions and follow class progress from a clear, practical dashboard.",
  },
];

const safeguards = [
  {
    icon: LockKeyhole,
    title: "Teacher-controlled rules",
    description: "Choose fullscreen, clipboard, and browser-activity rules for each assessment.",
  },
  {
    icon: Eye,
    title: "Live class oversight",
    description: "See student progress, submissions, remaining time, and recorded assessment events.",
  },
  {
    icon: ClipboardCheck,
    title: "Clear, reviewable results",
    description: "Bring quiz answers and coding submissions together for a practical teacher review.",
  },
];

function SignInMenu() {
  return (
    <div className="landing-nav-actions">
      <details className="landing-signin">
        <summary className="landing-signin-trigger">
          Sign in <ChevronDown size={16} aria-hidden="true" />
        </summary>
        <div className="landing-signin-menu">
          <Link to="/login/student">
            <span className="landing-menu-icon"><GraduationCap size={18} /></span>
            <span><strong>Student Login</strong><small>Join an assessment</small></span>
            <ArrowUpRight size={16} />
          </Link>
          <Link to="/login/teacher">
            <span className="landing-menu-icon"><ShieldCheck size={18} /></span>
            <span><strong>Teacher Login</strong><small>Manage your classroom</small></span>
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </details>
      <ThemeToggle />
    </div>
  );
}

const landingCodeLines = [
  [{ text: "def", type: "b" }, { text: " solve_challenge(problem):" }],
  [{ text: "questions = problem.questions" }],
  [{ text: "for", type: "b" }, { text: " question " }, { text: "in", type: "em" }, { text: " questions:" }],
  [{ text: "solve(question)" }],
  [{ text: "return", type: "b" }, { text: " progress.track(problem)" }],
];
const landingCodeLength = landingCodeLines.flat().reduce((total, segment) => total + segment.text.length, 0);

function CodePreview() {
  const [visibleLetters, setVisibleLetters] = useState(0);
  useEffect(() => {
    let timer;
    let letter = 0;
    const typeNext = () => {
      letter += 1;
      setVisibleLetters(letter);
      if (letter < landingCodeLength) timer = window.setTimeout(typeNext, 35);
      else timer = window.setTimeout(() => {
        letter = 0;
        setVisibleLetters(0);
        timer = window.setTimeout(typeNext, 350);
      }, 4000);
    };
    timer = window.setTimeout(typeNext, 350);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <div className="landing-visual" aria-label="Animated coding workspace preview">
      <div className="landing-orbit landing-orbit-one"><span>&lt;/&gt;</span></div>
      <div className="landing-orbit landing-orbit-two"><span>{"{ }"}</span></div>
      <div className="landing-code-window">
        <div className="landing-code-topbar"><span className="landing-window-dots"><i /><i /><i /></span><span><Code2 size={15} /> solution.py</span><span className="landing-code-status"><span /> RUNNING</span></div>
        <div className="landing-code-body">
          {(() => { let offset = 0; return landingCodeLines.map((line, lineIndex) => <div key={lineIndex}><span>0{lineIndex + 1}</span><code className={lineIndex === 1 || lineIndex === 2 ? "indent" : lineIndex === 3 ? "indent-more" : ""}>{line.map((segment, segmentIndex) => {
            const start = offset;
            offset += segment.text.length;
            const chars = [...segment.text].map((character, characterIndex) => <span className={`landing-typing-char${start + characterIndex < visibleLetters ? " is-visible" : ""}`} key={characterIndex}>{character}</span>);
            return segment.type === "b" ? <b key={segmentIndex}>{chars}</b> : segment.type === "em" ? <em key={segmentIndex}>{chars}</em> : <span key={segmentIndex}>{chars}</span>;
          })}</code></div>); })()}
        </div>
        <div className="landing-code-footer"><span><CheckCircle2 size={14} /> All changes saved</span><span>Python 3</span></div>
      </div>
      <div className="landing-float-card landing-float-progress"><span className="landing-float-icon"><CheckCircle2 size={19} /></span><span><strong>Progress, made clear</strong><small>Every question in view</small></span></div>
      <div className="landing-float-card landing-float-score"><span className="landing-score-bars"><i /><i /><i /><i /></span><span><strong>Thoughtful practice</strong><small>Learn by doing</small></span></div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="landing landing-redesign">
      <Navbar actions={<SignInMenu />} />
      <main>
        <section className="landing-hero">
          <div className="landing-hero-grid">
            <div className="landing-copy">
              <span className="landing-kicker">QUIZ, CODING & CLASS PROGRESS</span>
              <h1>Create assessments. <span>See student progress.</span></h1>
              <p className="landing-intro">
                Build quiz and coding assessments, guide students through focused practice, and review class results in one place.
              </p>
              <div className="landing-hero-actions">
                <Link className="landing-primary-link" to="/login/teacher">Open teacher workspace <ArrowRight size={18} /></Link>
                <Link className="landing-secondary-link" to="/login/student">Join an assessment <ArrowUpRight size={17} /></Link>
              </div>
            </div>
            <CodePreview />
          </div>
          <div className="landing-background-code" aria-hidden="true">&lt;learn /&gt;　&#123; assess: true &#125;　0x01</div>
        </section>

        <section className="landing-features" id="features">
          <div className="landing-section-heading">
            <span className="landing-section-kicker">A CLEAR WORKFLOW FOR YOUR CLASS</span>
            <h2>From question creation to class results.</h2>
            <p>Purpose-built tools make assessments easier to create, take, and review.</p>
          </div>
          <div className="landing-feature-grid">
            {features.map(({ icon: Icon, title, description }) => (
              <article className="landing-feature-card" key={title}>
                <div className="landing-feature-icon"><Icon size={21} /></div>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-safeguards" id="security">
          <div className="landing-safeguards-heading">
            <span className="landing-section-kicker">CLASSROOM CONTROLS</span>
            <h2>Structure for teachers. Focus for students.</h2>
            <p>Set expectations before an assessment, then follow progress and review work in one place.</p>
          </div>
          <div className="landing-safeguards-grid">
            {safeguards.map(({ icon: Icon, title, description }) => (
              <article className="landing-safeguard-card" key={title}>
                <span className="landing-safeguard-icon"><Icon size={19} /></span>
                <div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
              </article>
            ))}
          </div>
          <p className="landing-safeguards-note">Browser monitoring only reports activity the browser can observe; it cannot reliably identify or block installed extensions.</p>
        </section>
      </main>
      <footer className="landing-footer-redesign">
        <div className="landing-footer-main">
          <div className="landing-footer-about">
            <Link to="/" className="landing-footer-brand"><span className="brand-icon"><ShieldCheck size={19} /></span> AStarCoders</Link>
            <p>One thoughtful workspace to create assessments, solve coding challenges, and understand student progress.</p>
          </div>
          <div className="landing-footer-links">
            <strong>Explore</strong>
            <a href="#features">Platform features</a>
            <a href="#security">Assessment safeguards</a>
            <Link to="/login/student">Student login</Link>
            <Link to="/login/teacher">Teacher workspace</Link>
          </div>
          <div className="landing-footer-developer">
            <span className="landing-developer-label">BUILT BY</span>
            <strong>Suryansh Satwaliya</strong>
            <a href="https://github.com/suryanshsatwaliya" target="_blank" rel="noopener noreferrer">
              <Github size={15} aria-hidden="true" /> View GitHub Profile <ArrowUpRight size={13} />
            </a>
          </div>
        </div>
        <div className="landing-footer-bottom"><span>Built to help classrooms learn with confidence.</span><span>© {new Date().getFullYear()} AStarCoders</span></div>
      </footer>
    </div>
  );
}
