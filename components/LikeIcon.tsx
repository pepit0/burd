import { Bird, Heart, Leaf, ThumbsUp } from "lucide-react-native";
import Svg, { G, Path, Rect } from "react-native-svg";
import {
  DEFAULT_LIKE_ICON_STYLE,
  INACTIVE_ICON_COLOR,
  LIKED_ICON_COLOR,
  type LikeIconStyle,
} from "@/lib/likeIconStyle";

interface LikeIconProps {
  liked: boolean;
  size?: number;
  style?: LikeIconStyle;
  inactiveColor?: string;
  activeColor?: string;
}

function BurdLogoIcon({
  size,
  liked,
  inactiveColor,
  activeColor,
}: {
  size: number;
  liked: boolean;
  inactiveColor: string;
  activeColor: string;
}) {
  const bg = liked ? activeColor : "#5f9470";
  const stroke = liked ? "#f0ead6" : inactiveColor === INACTIVE_ICON_COLOR ? "#f0ead6" : inactiveColor;

  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <Rect width={28} height={28} rx={8} fill={bg} />
      <G
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        transform="translate(7 7) scale(0.5833333)"
      >
        <Path d="M12.67 19a2 2 0 0 0 1.416-.588l6.154-6.172a6 6 0 0 0-8.49-8.49L5.586 9.914A2 2 0 0 0 5 11.328V18a1 1 0 0 0 1 1z" />
        <Path d="M16 8 2 22" />
        <Path d="M17.5 15H9" />
      </G>
    </Svg>
  );
}

export function LikeIcon({
  liked,
  size = 22,
  style = DEFAULT_LIKE_ICON_STYLE,
  inactiveColor = INACTIVE_ICON_COLOR,
  activeColor = LIKED_ICON_COLOR,
}: LikeIconProps) {
  const color = liked ? activeColor : inactiveColor;
  const fill = liked ? activeColor : "transparent";

  switch (style) {
    case "thumbs_up":
      return <ThumbsUp size={size} color={color} fill={fill} />;
    case "bird":
      return <Bird size={size} color={color} fill={liked ? activeColor : "transparent"} />;
    case "leaf":
      return <Leaf size={size} color={color} fill={fill} />;
    case "burd":
      return (
        <BurdLogoIcon
          size={size}
          liked={liked}
          inactiveColor={inactiveColor}
          activeColor={activeColor}
        />
      );
    case "heart":
    default:
      return <Heart size={size} color={color} fill={fill} />;
  }
}
