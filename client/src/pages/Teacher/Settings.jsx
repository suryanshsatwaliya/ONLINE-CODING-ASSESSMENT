import { useAuth } from "../../hooks/useAuth";
export default function Settings() {
  const { user } = useAuth();
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">WORKSPACE CONFIGURATION</span>
          <h1>Settings</h1>
        </div>
      </div>
      <section className="card">
        <h2>Teacher account</h2>
        <p>
          {user.name} · {user.email}
        </p>
        <p>
          Account provisioning is managed by the server administrator through
          the seed script.
        </p>
      </section>
      <section className="card">
        <h2>Assessment preferences</h2>
        <p>
          Configure warning policies, language availability, AI rubric and
          result visibility in each assessment. Live assessment settings are
          locked to preserve consistent rules for students.
        </p>
      </section>
      <section className="card">
        <h2>Service configuration</h2>
        <p>
          Database, code runner and AI credentials are configured on the server.
          No secret is available in this browser.
        </p>
        <p>See README.md and docs/DEPLOYMENT.md for setup instructions.</p>
      </section>
    </>
  );
}
