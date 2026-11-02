import PageTransition from "./PageTransition";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { useLocation } from "react-router-dom";
export default function DashboardLayout() {
  const location = useLocation();
  const isAssessmentSetup = location.pathname === "/teacher/assessments/new";
  const isQuestionTester = /\/teacher\/questions\/(?:sets\/[^/]+\/test\/\d+|[^/]+\/test)$/.test(location.pathname);
  return (
    <div className={`workspace${isAssessmentSetup ? " workspace-assessment-setup" : ""}${isQuestionTester ? " workspace-question-tester" : ""}`}>
      {!isQuestionTester && <Sidebar />}
      <div className="workspace-main">
        <Header />
        <main className={`content${isAssessmentSetup ? " content-assessment-setup" : ""}${isQuestionTester ? " content-question-tester" : ""}`}>
          <PageTransition />
        </main>
      </div>
    </div>
  );
}
