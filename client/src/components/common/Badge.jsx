export default function Badge({ children, className = "" }) {
  const statusClass = String(children).toLowerCase().replaceAll(/\s+/g, "-");
  return (
    <span className={`badge ${statusClass} ${className}`.trim()}>
      {children}
    </span>
  );
}
