export function updateAssessmentTiming(previous, key, value) {
  const next = { ...previous, [key]: value };
  if (key === "startTime" || key === "duration") {
    next.endTime = next.startTime && Number(next.duration) > 0
      ? new Date(new Date(next.startTime).getTime() + Number(next.duration) * 60000).toISOString()
      : null;
  }
  return next;
}
