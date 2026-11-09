import React from "react";
import { Audio } from "@remotion/media";
import { staticFile } from "remotion";
import { LogoSting, StingProps } from "./scenes/LogoSting";

/** Standalone 7s logo sting with its own score (scripts/score.py, "sting" edit). */
export const StingDeliverable: React.FC<StingProps> = ({ theme }) => (
  <>
    <Audio src={staticFile("audio/score-sting.wav")} />
    <LogoSting theme={theme} />
  </>
);
