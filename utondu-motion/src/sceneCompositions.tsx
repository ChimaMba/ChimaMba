import React from "react";
import { FILM } from "./timeline";
import { renderScene } from "./Film";

export { FILM };
/** Each film scene on its own Studio timeline (no audio). */
export const renderSceneComposition: React.FC<{ index: number }> = ({ index }) => <>{renderScene(FILM[index])}</>;
