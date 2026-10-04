import { motion, useReducedMotion } from "framer-motion";
import { useLocation, useOutlet } from "react-router-dom";

export default function PageTransition() {
  const { pathname } = useLocation();
  const outlet = useOutlet();
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      key={pathname}
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0, transitionEnd: { transform: "none" } }}
      transition={{ duration: reduceMotion ? 0 : 0.65, ease: [0.4, 0, 0.2, 1] }}
    >
      {outlet}
    </motion.div>
  );
}
