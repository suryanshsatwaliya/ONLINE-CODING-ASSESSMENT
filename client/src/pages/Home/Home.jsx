import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  GraduationCap,
  Presentation,
  ArrowUpRight,
  ShieldCheck,
  Code2,
  Activity,
} from "lucide-react";
import Navbar from "../../components/layout/Navbar";
export default function Home() {
  return (
    <div className="landing">
      <Navbar />
      <main>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="hero"
        >
          <span className="pill">
            <span className="dot" /> A focused space for every assessment
          </span>
          <h1>
            Quiz & Coding
            <br />
            <span>Assessment Portal</span>
          </h1>
          <p>Secure assessments for quizzes and programming tests.</p>
          <div className="portal-grid">
            {[
              [
                GraduationCap,
                "Student",
                "Your next challenge starts here. Sign in, join your assessment and show what you know.",
                "student",
              ],
              [
                Presentation,
                "Teacher",
                "Create meaningful assessments. Manage your students and follow progress in real time.",
                "teacher",
              ],
            ].map(([Icon, title, description, role]) => (
              <Link
                className={"portal-card " + role}
                key={role}
                to={"/login/" + role}
              >
                <div className="row between">
                  <span className="portal-icon">
                    <Icon size={30} />
                  </span>
                  <ArrowUpRight size={24} />
                </div>
                <span className="eyebrow">{title.toUpperCase()} PORTAL</span>
                <h2>{title}</h2>
                <p>{description}</p>
                <span className="portal-link">
                  {title} Login <span>→</span>
                </span>
              </Link>
            ))}
          </div>
          <div className="feature-strip">
            <span>
              <ShieldCheck /> Server-enforced assessment rules
            </span>
            <span>
              <Code2 /> Quizzes + coding challenges
            </span>
            <span>
              <Activity /> Live progress insights
            </span>
          </div>
        </motion.div>
      </main>
      <footer>
        Designed for learning. Built with integrity.
        <span>Observable browser monitoring • Isolated code execution</span>
      </footer>
    </div>
  );
}
