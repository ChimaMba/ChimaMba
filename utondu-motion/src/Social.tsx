import React from "react";
import { TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { brandTiming, lift, oIris } from "./transitions";
import { LogoSting } from "./scenes/LogoSting";
import { Statement } from "./scenes/Statement";
import { Lifestyle } from "./scenes/Lifestyle";
import { Applications } from "./scenes/Applications";
import { EndCard } from "./scenes/EndCard";
import { t } from "./brand";

/** Social cutdown (9:16 Reels/TikTok, 1:1 feed) — 19s. Scenes re-flow by aspect ratio. */
export const SOCIAL_DURATION = 130 + 100 + 150 + 180 + 100 - 4 * t.transition;

export const Social: React.FC = () => (
  <TransitionSeries>
    <TransitionSeries.Sequence name="Sting" durationInFrames={130}>
      <LogoSting theme="light" />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={lift()} timing={brandTiming} />
    <TransitionSeries.Sequence name="Statement" durationInFrames={100}>
      <Statement />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={oIris()} timing={brandTiming} />
    <TransitionSeries.Sequence name="Lifestyle" durationInFrames={150}>
      <Lifestyle />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={lift()} timing={brandTiming} />
    <TransitionSeries.Sequence name="Applications" durationInFrames={180}>
      <Applications />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={fade()} timing={brandTiming} />
    <TransitionSeries.Sequence name="EndCard" durationInFrames={100}>
      <EndCard />
    </TransitionSeries.Sequence>
  </TransitionSeries>
);
