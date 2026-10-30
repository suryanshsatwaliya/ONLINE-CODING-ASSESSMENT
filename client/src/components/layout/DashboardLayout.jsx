import PageTransition from "./PageTransition";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { useLocation } from "react-router-dom";
export default function DashboardLayout() {
  const location = useLocation();
  const isAssessmentSetup = location.pathname === "/teacher/assessments/new";
  return (
    <div className={`workspace${isAssessmentSetup ? " workspace-assessment-setup" : ""}`}>
      <Sidebar />
      <div className="workspace-main">
        <Header />
        <main className={`content${isAssessmentSetup ? " content-assessment-setup" : ""}`}>
          <PageTransition />
        </main>
      </div>
    </div>
  );
}
