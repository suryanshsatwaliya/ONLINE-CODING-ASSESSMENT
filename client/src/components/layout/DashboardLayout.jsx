import PageTransition from "./PageTransition";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { useLocation } from "react-router-dom";
import { useCallback, useLayoutEffect, useState } from "react";
export default function DashboardLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();
  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);
  const openMobileNav = useCallback(() => setMobileNavOpen(true), []);
  const isAssessmentSetup = location.pathname === "/teacher/assessments/new";
  const isQuestionTester = /\/teacher\/questions\/(?:sets\/[^/]+\/test\/\d+|[^/]+\/test)$/.test(location.pathname);
  useLayoutEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia("(max-width: 750px)").matches) return undefined;
    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => {
      window.history.scrollRestoration = previousRestoration;
    };
  }, []);
  useLayoutEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia("(max-width: 750px)").matches) return undefined;
    const scrollToTop = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      document.querySelector(".workspace-main")?.scrollTo(0, 0);
      document.querySelector(".content")?.scrollTo(0, 0);
    };
    scrollToTop();
    const frame = window.requestAnimationFrame(scrollToTop);
    return () => window.cancelAnimationFrame(frame);
  }, [location.pathname]);
  return (
    <div className={`workspace${isAssessmentSetup ? " workspace-assessment-setup" : ""}${isQuestionTester ? " workspace-question-tester" : ""}`}>
      <Sidebar mobileOnly={isQuestionTester} isOpen={mobileNavOpen} onClose={closeMobileNav} />
      <div className="workspace-main">
        <Header isNavOpen={mobileNavOpen} onOpenMenu={openMobileNav} />
        <main className={`content${isAssessmentSetup ? " content-assessment-setup" : ""}${isQuestionTester ? " content-question-tester" : ""}`}>
          <PageTransition />
        </main>
      </div>
    </div>
  );
}
