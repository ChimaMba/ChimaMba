import React from "react";
import { Audio } from "@remotion/media";
import { staticFile } from "remotion";
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
 * 16:9 brand sizzle — 38.7s. Every scene length is a whole number of beats (90 BPM = 20 frames), so every transition lands on the beat.
 * Act 1 (who we are): sting → statement.  Act 2 (the system): construction → colour → type.
 * Act 3 (the world): lifestyle → product → applications.  Close: end card.
 */
export const SIZZLE_DURATION =
  160 + 120 + 160 + 160 + 120 + 180 + 120 + 180 + 120 - 8 * t.transition;

export const Sizzle: React.FC = () => (
  <>
    {/* original score, composed against this edit — see scripts/score.py */}
    <Audio src={staticFile("audio/score-sizzle.wav")} />
    <TransitionSeries>
      <TransitionSeries.Sequence name="Sting" durationInFrames={160}>
        <LogoSting theme="light" />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={lift()} timing={brandTiming} />
      <TransitionSeries.Sequence name="Statement" durationInFrames={120}>
        <Statement />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={oIris()}
        timing={brandTiming}
      />
      <TransitionSeries.Sequence name="Construction" durationInFrames={160}>
        <Construction />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={lift()} timing={brandTiming} />
      <TransitionSeries.Sequence name="Palette" durationInFrames={160}>
        <Palette />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={oIris()}
        timing={brandTiming}
      />
      <TransitionSeries.Sequence name="Typography" durationInFrames={120}>
        <Typography />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={lift()} timing={brandTiming} />
      <TransitionSeries.Sequence name="Lifestyle" durationInFrames={180}>
        <Lifestyle />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={oIris()}
        timing={brandTiming}
      />
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
  </>
);
