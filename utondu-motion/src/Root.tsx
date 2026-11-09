import "./fonts";
import { Composition, Folder } from "remotion";
import { FPS } from "./brand";
import { StingDeliverable } from "./StingDeliverable";
import { Film, FILM_DURATION, Instagram, INSTAGRAM_DURATION, Social, SOCIAL_DURATION } from "./Film";
import { FILM, renderSceneComposition } from "./sceneCompositions";

const HD = { width: 1920, height: 1080, fps: FPS };

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Folder name="Deliverables">
        <Composition id="BrandFilm" component={Film} durationInFrames={FILM_DURATION} {...HD} />
        <Composition id="LogoSting" component={StingDeliverable} durationInFrames={210} {...HD} defaultProps={{ theme: "light" as const }} />
        <Composition id="LogoStingDark" component={StingDeliverable} durationInFrames={210} {...HD} defaultProps={{ theme: "dark" as const }} />
        <Composition id="InstagramReels" component={Social} durationInFrames={SOCIAL_DURATION} width={1080} height={1920} fps={FPS} />
        <Composition id="InstagramFeed" component={Instagram} durationInFrames={INSTAGRAM_DURATION} width={1080} height={1350} fps={FPS} />
        <Composition id="LinkedInSquare" component={Social} durationInFrames={SOCIAL_DURATION} width={1080} height={1080} fps={FPS} />
      </Folder>
      <Folder name="Scenes">
        {FILM.map((s, i) => (
          <Composition
            key={i}
            id={`S${String(i + 1).padStart(2, "0")}-${s.label.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "")}`}
            component={renderSceneComposition}
            durationInFrames={s.dur}
            {...HD}
            defaultProps={{ index: i }}
          />
        ))}
      </Folder>
    </>
  );
};
