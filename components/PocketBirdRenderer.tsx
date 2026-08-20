import { memo, useMemo } from "react";
import { View } from "react-native";
import { SvgXml } from "react-native-svg";
import { resolvePocketBirdDisplaySize } from "@/lib/pocketBird/displaySize";
import { pixelsToSvg, type PocketBirdPixel } from "@/lib/pocketBird/render";

interface PocketBirdRendererProps {
  pixels: PocketBirdPixel[];
  size: number;
}

export const PocketBirdRenderer = memo(function PocketBirdRenderer({
  pixels,
  size,
}: PocketBirdRendererProps) {
  const { displaySize } = useMemo(
    () => resolvePocketBirdDisplaySize(size),
    [size],
  );
  const xml = useMemo(() => pixelsToSvg(pixels), [pixels]);

  return (
    <View style={{ width: displaySize, height: displaySize }}>
      <SvgXml xml={xml} width={displaySize} height={displaySize} />
    </View>
  );
});
