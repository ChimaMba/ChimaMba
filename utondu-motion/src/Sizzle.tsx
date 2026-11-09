import React from "react";
import { TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { brandTiming, lift, oIris } from "./transitions";
import { LogoSting } from "./scenes/LogoSting";
import { Statement } from "./scenes/Statement";
import { Construction } from "./scenes/Construction";
import { Palette } from "./scenes/Palette";
import { Typography } from "./scenes/Typography";
import { Product } from "./scenes/Product";
import { EndCard } from "./scenes/EndCard";
import { t } from "./brand";

/** 16:9 brand sizzle — 29s. Edit scene lengths inline below. */
export const SIZZLE_DURATION = 150 + 120 + 150 + 150 + 150 + 150 + 120 - 6 * t.transition;

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
    <TransitionSeries.Sequence name="Palette" durationInFrames={150}>
      <Palette />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={oIris()} timing={brandTiming} />
    <TransitionSeries.Sequence name="Typography" durationInFrames={150}>
      <Typography />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={lift()} timing={brandTiming} />
    <TransitionSeries.Sequence name="Product" durationInFrames={150}>
      <Product />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={fade()} timing={brandTiming} />
    <TransitionSeries.Sequence name="EndCard" durationInFrames={120}>
      <EndCard />
    </TransitionSeries.Sequence>
  </TransitionSeries>
);
