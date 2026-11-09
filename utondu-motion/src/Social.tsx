import React from "react";
import { TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { brandTiming, lift, oIris } from "./transitions";
import { LogoSting } from "./scenes/LogoSting";
import { Statement } from "./scenes/Statement";
import { Palette } from "./scenes/Palette";
import { Product } from "./scenes/Product";
import { EndCard } from "./scenes/EndCard";
import { t } from "./brand";

/** Social cutdown (9:16 Reels/TikTok, 1:1 feed) — 18s. Scenes re-flow by aspect ratio. */
export const SOCIAL_DURATION = 140 + 110 + 130 + 130 + 110 - 4 * t.transition;

export const Social: React.FC = () => (
  <TransitionSeries>
    <TransitionSeries.Sequence name="Sting" durationInFrames={140}>
      <LogoSting theme="light" />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={lift()} timing={brandTiming} />
    <TransitionSeries.Sequence name="Statement" durationInFrames={110}>
      <Statement />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={oIris()} timing={brandTiming} />
    <TransitionSeries.Sequence name="Palette" durationInFrames={130}>
      <Palette />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={lift()} timing={brandTiming} />
    <TransitionSeries.Sequence name="Product" durationInFrames={130}>
      <Product />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={fade()} timing={brandTiming} />
    <TransitionSeries.Sequence name="EndCard" durationInFrames={110}>
      <EndCard />
    </TransitionSeries.Sequence>
  </TransitionSeries>
);
