import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { teacherCodeLines, useTeacherCodeTyping } from "./teacherLoginCode";

export default function TeacherLoginStory() {
  const visibleCodeLetters = useTeacherCodeTyping();

  return <section className="teacher-login-story">
    <Link className="teacher-login-back portal-return-link" to="/"><ArrowLeft size={16} /> Back to portals</Link>
    <h1>Manage your assessments <span>in one place.</span></h1>
    <div className="teacher-login-code-stage" aria-hidden="true">
      <span className="teacher-login-floating-snippet teacher-login-floating-top">&#123; focus: true &#125;</span>
      <div className="teacher-login-code">
        <div className="teacher-login-code-top"><span className="teacher-login-code-dots"><i /><i /><i /></span><span>challenge.js</span><span className="teacher-login-code-status">● LIVE</span></div>
        <div className="teacher-login-code-body">
          {(() => { let offset = 0; return teacherCodeLines.map((line, lineIndex) => <span className={`code-line ${lineIndex === 1 || lineIndex === 2 ? "indent" : ""}`} key={lineIndex}><i>0{lineIndex + 1}</i>{line.map((segment, segmentIndex) => { const start = offset; offset += segment.text.length; return <span className={segment.className || ""} key={segmentIndex}>{[...segment.text].map((character, characterIndex) => <span className={`typing-char ${start + characterIndex < visibleCodeLetters ? "is-visible" : ""}`} key={characterIndex}>{character}</span>)}</span>; })}</span>); })()}
        </div>
        <div className="teacher-login-code-foot"><span><CheckCircle2 size={14} /> Ready to run</span><span>JavaScript · Assessment</span></div>
      </div>
      <span className="teacher-login-floating-snippet teacher-login-floating-bottom">solve();</span>
    </div>
    <p className="teacher-login-intro"><span className="teacher-login-intro-kicker">YOUR CLASSROOM, IN SYNC</span>From first question to final result, keep every part of the learning journey moving together.</p>
    <div className="teacher-login-points">
      <span><CheckCircle2 size={17} /><strong>Create with confidence</strong><small>Quizzes and coding challenges, one workspace.</small></span>
      <span><CheckCircle2 size={17} /><strong>See every breakthrough</strong><small>Student work and progress, all in sync.</small></span>
    </div>
  </section>;
}
