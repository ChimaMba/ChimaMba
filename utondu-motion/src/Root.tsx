import "./fonts";
import { Composition, Folder } from "remotion";
import { FPS } from "./brand";
import { LogoSting } from "./scenes/LogoSting";
import { Statement } from "./scenes/Statement";
import { Construction } from "./scenes/Construction";
import { Palette } from "./scenes/Palette";
import { Typography } from "./scenes/Typography";
import { Product } from "./scenes/Product";
import { EndCard } from "./scenes/EndCard";
import { Sizzle, SIZZLE_DURATION } from "./Sizzle";
import { Social, SOCIAL_DURATION } from "./Social";

const HD = { width: 1920, height: 1080, fps: FPS };

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Folder name="Deliverables">
        <Composition id="LogoSting" component={LogoSting} durationInFrames={210} {...HD} defaultProps={{ theme: "light" as const }} />
        <Composition id="LogoStingDark" component={LogoSting} durationInFrames={210} {...HD} defaultProps={{ theme: "dark" as const }} />
        <Composition id="Sizzle" component={Sizzle} durationInFrames={SIZZLE_DURATION} {...HD} />
        <Composition id="SocialVertical" component={Social} durationInFrames={SOCIAL_DURATION} width={1080} height={1920} fps={FPS} />
        <Composition id="SocialSquare" component={Social} durationInFrames={SOCIAL_DURATION} width={1080} height={1080} fps={FPS} />
      </Folder>
      <Folder name="Scenes">
        <Composition id="Statement" component={Statement} durationInFrames={120} {...HD} />
        <Composition id="Construction" component={Construction} durationInFrames={150} {...HD} />
        <Composition id="Palette" component={Palette} durationInFrames={150} {...HD} />
        <Composition id="Typography" component={Typography} durationInFrames={150} {...HD} />
        <Composition id="Product" component={Product} durationInFrames={150} {...HD} />
        <Composition id="EndCard" component={EndCard} durationInFrames={120} {...HD} />
      </Folder>
    </>
  );
};
