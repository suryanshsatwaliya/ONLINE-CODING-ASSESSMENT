import PageTransition from "./PageTransition";
import Sidebar from "./Sidebar";
import Header from "./Header";
export default function DashboardLayout() {
  return (
    <div className="workspace">
      <Sidebar />
      <div className="workspace-main">
        <Header />
        <main className="content">
          <PageTransition />
        </main>
      </div>
    </div>
  );
}
