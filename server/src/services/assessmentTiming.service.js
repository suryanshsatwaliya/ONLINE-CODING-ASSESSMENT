export function assessmentDeadline(assessment) {
  const dates = [assessment.closesAt, assessment.endTime].filter(Boolean).map((date) => +new Date(date));
  if (assessment.startedAt && assessment.duration > 0)
    dates.push(+new Date(assessment.startedAt) + assessment.duration * 60000);
  return dates.length ? Math.min(...dates) : Infinity;
}

export function assessmentAdmissionDeadline(assessment) {
  const deadline = assessmentDeadline(assessment);
  return assessment.admissionClosesAt
    ? Math.min(deadline, +new Date(assessment.admissionClosesAt))
    : deadline;
}
