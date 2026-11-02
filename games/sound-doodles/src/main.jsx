import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/bricolage-grotesque";

import "./styles/tokens.css";
import "./styles/legacy.css";
import "./styles/motion.css";
import "./styles/awards.css";
import "./styles/guess.css";
import "./styles/reveal.css";
import "./styles/stage.css";
import "./styles/ui.css";
import "./styles/screens.css";
import "./styles/game.css";
import "./styles/themes-light.css";
import "./styles/styleguide.css";
import "./styles/words.css";
import { syncMusic } from "./ambience.js";
import { App } from "./App.jsx";

syncMusic();
const root = createRoot(document.getElementById("root"));
// Development only: /styleguide (or #/styleguide) shows every component in all four themes.
// In production builds this branch is dead code and is removed from the bundle.
if (
  import.meta.env.DEV &&
  (location.pathname === "/styleguide" || location.hash === "#/styleguide")
) {
  import("./screens/Styleguide.jsx").then(({ Styleguide }) =>
    root.render(<Styleguide />),
  );
} else {
  root.render(<App />);
}
