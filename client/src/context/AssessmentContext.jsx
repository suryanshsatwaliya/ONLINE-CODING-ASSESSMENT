import { createContext, useContext } from "react";
export const AssessmentContext = createContext(null);
export const useAssessment = () => useContext(AssessmentContext);
