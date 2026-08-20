import Svg, { G, Path, Rect } from "react-native-svg";

interface BurdLogoMarkProps {
  size?: number;
}

/** App mark from assets/logo-mark.svg — green tile with cream feather. */
export function BurdLogoMark({ size = 22 }: BurdLogoMarkProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" accessibilityElementsHidden>
      <Rect width={28} height={28} rx={8} fill="#5f9470" />
      <G
        stroke="#f0ead6"
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
