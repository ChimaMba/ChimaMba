import React from "react";
import { TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { brandTiming, lift, oIris } from "./transitions";
import { LogoSting } from "./scenes/LogoSting";
import { Statement } from "./scenes/Statement";
import { Construction } from "./scenes/Construction";
import { Palette } from "./scenes/Palette";
import { Typography } from "./scenes/Typography";
import { Lifestyle } from "./scenes/Lifestyle";
import { Product } from "./scenes/Product";
import { Applications } from "./scenes/Applications";
import { EndCard } from "./scenes/EndCard";
import { t } from "./brand";

/**
 * 16:9 brand sizzle — 36s.
 * Act 1 (who we are): sting → statement.  Act 2 (the system): construction → colour → type.
 * Act 3 (the world): lifestyle → product → applications.  Close: end card.
 */
export const SIZZLE_DURATION = 150 + 120 + 150 + 130 + 120 + 150 + 120 + 180 + 120 - 8 * t.transition;

export const Sizzle: React.FC = () => (
  <TransitionSeries>
    <TransitionSeries.Sequence name="Sting" durationInFrames={150}>
      <LogoSting theme="light" />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={lift()} timing={brandTiming} />
    <TransitionSeries.Sequence name="Statement" durationInFrames={120}>
      <Statement />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={oIris()} timing={brandTiming} />
    <TransitionSeries.Sequence name="Construction" durationInFrames={150}>
      <Construction />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={lift()} timing={brandTiming} />
    <TransitionSeries.Sequence name="Palette" durationInFrames={130}>
      <Palette />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={oIris()} timing={brandTiming} />
    <TransitionSeries.Sequence name="Typography" durationInFrames={120}>
      <Typography />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={lift()} timing={brandTiming} />
    <TransitionSeries.Sequence name="Lifestyle" durationInFrames={150}>
      <Lifestyle />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={oIris()} timing={brandTiming} />
    <TransitionSeries.Sequence name="Product" durationInFrames={120}>
      <Product />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={lift()} timing={brandTiming} />
    <TransitionSeries.Sequence name="Applications" durationInFrames={180}>
      <Applications />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={fade()} timing={brandTiming} />
    <TransitionSeries.Sequence name="EndCard" durationInFrames={120}>
      <EndCard />
    </TransitionSeries.Sequence>
  </TransitionSeries>
);
