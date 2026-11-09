import React from "react";
import { FILM } from "./timeline";
import { renderScene } from "./Film";

export { FILM };
/** Each film scene on its own Studio timeline (no audio). `qa` stops the camera push so a
 * settled frame can be compared with the PDF pixel for pixel (scripts/check_fidelity.py). */
export const renderSceneComposition: React.FC<{ index: number; qa?: boolean }> = ({ index, qa }) => <>{renderScene(FILM[index], qa)}</>;
