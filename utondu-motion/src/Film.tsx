import React from "react";
import { Audio } from "@remotion/media";
import { staticFile } from "remotion";
import { TransitionSeries } from "@remotion/transitions";
import type { TransitionPresentation } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { brandTiming, lift, oIris } from "./transitions";
import { FILM, SOCIAL, SceneSpec, durationOf } from "./timeline";
import { LogoSting } from "./scenes/LogoSting";
import { Cover } from "./scenes/Cover";
import { Construction } from "./scenes/Construction";
import { LogoVersions } from "./scenes/LogoVersions";
import { PageScene } from "./scenes/PageScene";
import { Palette } from "./scenes/Palette";
import { Lifestyle } from "./scenes/Lifestyle";
import { Statement } from "./scenes/Statement";
import { Applications } from "./scenes/Applications";
import { EndCard } from "./scenes/EndCard";

export const renderScene = (s: SceneSpec) => {
  switch (s.kind) {
    case "sting":
      return <LogoSting theme="light" />;
    case "cover":
      return <Cover dur={s.dur} />;
    case "construction":
      return <Construction />;
    case "versions":
      return <LogoVersions />;
    case "page":
      return <PageScene page={s.page!} dur={s.dur} {...(s.opts ?? {})} />;
    case "palette":
      return <Palette />;
    case "lifestyle":
      return <Lifestyle />;
    case "statement":
      return <Statement />;
    case "plates":
      return <Applications />;
    case "endcard":
      return <EndCard />;
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const presentation = (s: SceneSpec): TransitionPresentation<any> =>
  s.out === "iris" ? oIris() : s.out === "fade" ? fade() : lift();

/** Renders an edit from src/timeline.ts, with its score. */
export const Edit: React.FC<{ edit: SceneSpec[]; score: string }> = ({ edit, score }) => (
  <>
    {/* original score + motion sound design, composed against this edit (scripts/score.py) */}
    <Audio src={staticFile(score)} />
    <TransitionSeries>
      {edit.flatMap((s, i) => {
        const items = [
          <TransitionSeries.Sequence key={`s${i}`} name={s.label} durationInFrames={s.dur}>
            {renderScene(s)}
          </TransitionSeries.Sequence>,
        ];
        if (i < edit.length - 1 && s.out !== "cut") {
          items.push(<TransitionSeries.Transition key={`t${i}`} presentation={presentation(s)} timing={brandTiming} />);
        }
        return items;
      })}
    </TransitionSeries>
  </>
);

export const FILM_DURATION = durationOf(FILM);
export const SOCIAL_DURATION = durationOf(SOCIAL);
export const Film: React.FC = () => <Edit edit={FILM} score="audio/score-film.wav" />;
export const Social: React.FC = () => <Edit edit={SOCIAL} score="audio/score-social.wav" />;
