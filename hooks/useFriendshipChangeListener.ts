import { useEffect, useRef } from "react";
import {
  subscribeFriendshipChanges,
  type FriendshipChangeEvent,
} from "@/lib/friendshipEvents";

export function useFriendshipChangeListener(
  onChange: (event: FriendshipChangeEvent) => void,
): void {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    return subscribeFriendshipChanges((event) => {
      onChangeRef.current(event);
    });
  }, []);
}
