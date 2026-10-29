import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Braces,
  CheckCircle2,
  ChevronDown,
  Code2,
  Github,
  GraduationCap,
  ShieldCheck,
} from "lucide-react";
import Navbar from "../../components/layout/Navbar";
import ThemeToggle from "../../components/common/ThemeToggle";
import { useTypingReplay } from "../../hooks/useTypingReplay";

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

function CodePreview() {
  const typingReplayKey = useTypingReplay(7150);
  return (
    <div className="landing-visual" aria-label="Decorative coding workspace preview" role="img">
      <div className="landing-orbit landing-orbit-one"><span>{"{ }"}</span></div>
      <div className="landing-orbit landing-orbit-two"><span>&lt;/&gt;</span></div>
      <div className="landing-code-window">
        <div className="landing-code-topbar">
          <span className="landing-window-dots"><i /><i /><i /></span>
          <span><Braces size={15} /> solution.py</span>
          <span className="landing-code-status"><span /> Ready</span>
        </div>
        <div key={typingReplayKey} className="landing-code-body" aria-hidden="true">
          <div><span>01</span><code style={{ "--type-steps": 22, "--type-delay": "0.1s" }}><b>def</b> solve(challenge):</code></div>
          <div><span>02</span><code className="indent" style={{ "--type-steps": 31, "--type-delay": "0.75s" }}><b>questions</b> = challenge.questions</code></div>
          <div><span>03</span><code className="indent" style={{ "--type-steps": 29, "--type-delay": "1.45s" }}><b>for</b> question <b>in</b> questions:</code></div>
          <div><span>04</span><code className="indent-more" style={{ "--type-steps": 18, "--type-delay": "2.1s" }}>attempt(question)</code></div>
          <div><span>05</span><code style={{ "--type-steps": 16, "--type-delay": "2.55s" }}><em>return</em> progress</code></div>
          <div className="landing-code-cursor-line"><span>06</span><code className="landing-code-cursor">_</code></div>
        </div>
        <div className="landing-code-footer"><span><CheckCircle2 size={14} /> All changes saved</span><span>Python 3</span></div>
      </div>
      <div className="landing-float-card landing-float-progress">
        <span className="landing-float-icon"><CheckCircle2 size={17} /></span>
        <span><strong>Progress, made clear</strong><small>Every question in view</small></span>
      </div>
      <div className="landing-float-card landing-float-score">
        <span className="landing-score-bars"><i /><i /><i /><i /></span>
        <span><strong>Thoughtful practice</strong><small>Learn by doing</small></span>
      </div>
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
              <span className="landing-kicker"><span /> ASSESS. PRACTICE. PROGRESS.</span>
              <h1>Make every question a <span>step forward.</span></h1>
              <p className="landing-intro">
                A calmer, clearer way to create assessments, solve coding challenges, and see learning take shape.
              </p>
              <div className="landing-hero-actions">
                <Link className="landing-primary-link" to="/login/student">I’m a student <ArrowRight size={18} /></Link>
                <Link className="landing-secondary-link" to="/login/teacher">Teacher workspace <ArrowUpRight size={17} /></Link>
              </div>
              <div className="landing-proof-row">
                <span><CheckCircle2 size={16} /> Quiz and coding assessments</span>
                <span><CheckCircle2 size={16} /> Built for focused learning</span>
              </div>
            </div>
            <CodePreview />
          </div>
          <div className="landing-background-code" aria-hidden="true">&lt;learn /&gt;　&#123; assess: true &#125;　0x01</div>
        </section>

        <section className="landing-features" id="features">
          <div className="landing-section-heading">
            <span className="landing-section-kicker">ONE PORTAL, TWO SIDES OF LEARNING</span>
            <h2>Everything you need to teach and learn.</h2>
            <p>Purpose-built tools make assessments easier to create, take, and review.</p>
          </div>
          <div className="landing-feature-grid">
            {features.map(({ icon: Icon, title, description }, index) => (
              <article className="landing-feature-card" key={title}>
                <div className="landing-feature-icon"><Icon size={21} /></div>
                <span className="landing-feature-index">0{index + 1}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
      <footer className="landing-footer-redesign">
        <Link to="/" className="landing-footer-brand"><span className="brand-icon"><ShieldCheck size={18} /></span> Assess / Portal</Link>
        <span>Built to help classrooms learn with confidence.</span>
        <div className="landing-footer-developer">
          <span className="landing-developer-label">DEVELOPER</span>
          <strong>Suryansh Satwaliya</strong>
          <a href="https://github.com/suryanshsatwaliya" target="_blank" rel="noopener noreferrer">
            <Github size={14} aria-hidden="true" /> View GitHub Profile
          </a>
        </div>
        <Link to="/login/teacher">For teachers <ArrowUpRight size={15} /></Link>
      </footer>
    </div>
  );
}
