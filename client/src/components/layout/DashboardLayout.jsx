import PageTransition from "./PageTransition";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { useLocation } from "react-router-dom";
import { useState } from "react";
export default function DashboardLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();
  const isAssessmentSetup = location.pathname === "/teacher/assessments/new";
  const isQuestionTester = /\/teacher\/questions\/(?:sets\/[^/]+\/test\/\d+|[^/]+\/test)$/.test(location.pathname);
  return (
    <div className={`workspace${isAssessmentSetup ? " workspace-assessment-setup" : ""}${isQuestionTester ? " workspace-question-tester" : ""}`}>
      <Sidebar mobileOnly={isQuestionTester} isOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="workspace-main">
        <Header isNavOpen={mobileNavOpen} onOpenMenu={() => setMobileNavOpen(true)} />
        <main className={`content${isAssessmentSetup ? " content-assessment-setup" : ""}${isQuestionTester ? " content-question-tester" : ""}`}>
          <PageTransition />
        </main>
      </div>
    </div>
  );
}
