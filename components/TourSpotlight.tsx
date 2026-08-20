import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { useAppTourOptional } from "@/components/AppTourProvider";
import type { AppTourSpotlight } from "@/lib/appTourSteps";

export function TourSpotlight({
  target,
  children,
  style,
  magnify = 1,
  lift = 0,
}: {
  target: AppTourSpotlight;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  magnify?: number;
  lift?: number;
}) {
  const tour = useAppTourOptional();
  const spotlight = tour?.spotlight ?? null;
  const reportTarget = tour?.reportTarget;
  const stepIndex = tour?.stepIndex ?? 0;
  const active = spotlight === target;
  const ref = useRef<View>(null);
  const scale = active && magnify > 1 ? magnify : 1;
  const rise = active && scale > 1 ? lift : 0;

  const measure = useCallback(() => {
    if (!active || !reportTarget) return;
    ref.current?.measureInWindow((x, y, width, height) => {
      if (width <= 0 || height <= 0) return;
      const nextWidth = width * scale;
      const nextHeight = height * scale;
      reportTarget(target, {
        x: x - (nextWidth - width) / 2,
        y: y - (nextHeight - height) / 2 - rise,
        width: nextWidth,
        height: nextHeight,
      });
    });
  }, [active, reportTarget, rise, scale, target]);

  useEffect(() => {
    if (!active) return;
    measure();
    const t1 = setTimeout(measure, 60);
    const t2 = setTimeout(measure, 280);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [active, measure, stepIndex]);

  return (
    <View
      ref={ref}
      collapsable={false}
      onLayout={measure}
      style={[
        { overflow: "visible", borderWidth: 2, borderColor: "transparent", borderRadius: 18 },
        style,
      ]}
    >
      {children}
    </View>
  );
}
