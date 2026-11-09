import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import type {
  TransitionPresentation,
  TransitionPresentationComponentProps,
} from "@remotion/transitions";
import { linearTiming } from "@remotion/transitions";
import { ease, t } from "./brand";

/**
 * "O-iris": the incoming scene opens out of a rounded stadium — the same
 * soft-cornered geometry as the O in the wordmark.
 */
type IrisProps = Record<string, never>;

const IrisComponent: React.FC<TransitionPresentationComponentProps<IrisProps>> = ({
  children,
  presentationDirection,
  presentationProgress: p,
}) => {
  if (presentationDirection === "exiting") {
    return <AbsoluteFill>{children}</AbsoluteFill>;
  }
  const insetX = interpolate(p, [0, 1], [42, 0]);
  const insetY = interpolate(p, [0, 1], [44, 0]);
  const radius = interpolate(p, [0, 0.85, 1], [400, 120, 0]);
  return (
    <AbsoluteFill
      style={{
        clipPath: `inset(${insetY}% ${insetX}% round ${radius}px)`,
        scale: interpolate(p, [0, 1], [1.06, 1]),
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

export const oIris = (): TransitionPresentation<IrisProps> => ({
  component: IrisComponent,
  props: {} as IrisProps,
});

/** "Lift": the next scene rises like a panel, the outgoing scene sinks slightly. */
type LiftProps = Record<string, never>;

const LiftComponent: React.FC<TransitionPresentationComponentProps<LiftProps>> = ({
  children,
  presentationDirection,
  presentationProgress: p,
}) => {
  if (presentationDirection === "exiting") {
    return (
      <AbsoluteFill style={{ translate: `0 ${interpolate(p, [0, 1], [0, -12])}%` }}>
        {children}
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{ translate: `0 ${interpolate(p, [0, 1], [100, 0])}%` }}>
      {children}
    </AbsoluteFill>
  );
};

export const lift = (): TransitionPresentation<LiftProps> => ({
  component: LiftComponent,
  props: {} as LiftProps,
});

export const brandTiming = linearTiming({
  durationInFrames: t.transition,
  easing: ease.glide,
});
