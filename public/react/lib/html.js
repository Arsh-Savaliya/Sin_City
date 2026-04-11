import * as React from "react";
import htm from "htm";

const html = htm.bind(React.createElement);
const ignoredMotionProps = new Set([
  "initial",
  "animate",
  "exit",
  "transition",
  "layout",
  "layoutId",
  "whileHover",
  "whileTap",
  "variants"
]);

const motion = new Proxy(
  {},
  {
    get(_target, tagName) {
      return React.forwardRef(function MotionPrimitive(props, ref) {
        const cleanProps = { ref };

        Object.entries(props || {}).forEach(([key, value]) => {
          if (!ignoredMotionProps.has(key)) {
            cleanProps[key] = value;
          }
        });

        return React.createElement(tagName, cleanProps, props?.children);
      });
    }
  }
);

function AnimatePresence({ children }) {
  return children;
}

export { React, html, motion, AnimatePresence };
