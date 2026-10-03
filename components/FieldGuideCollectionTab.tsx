import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native";
import { SpeciesCard } from "@/components/SpeciesCard";
import { TabEmptyState } from "@/components/TabEmptyState";
import { HEADER_BOTTOM_RADIUS } from "@/components/CollapsibleHeader";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/hooks/useAuth";
import { useAppTourOptional } from "@/components/AppTourProvider";
import { APP_TOUR_STEPS } from "@/lib/appTourSteps";
import { buildTourDemoCard, TOUR_DEMO_CARD_ID } from "@/lib/appTourDemo";
import { getUserFacingMessage } from "@/lib/errors";
import {
  deleteSpeciesCard,
  listSpeciesCards,
  mergeSpeciesCardIntoList,
  subscribeSpeciesCollectionRefresh,
  takeSeededSpeciesCollectionCard,
} from "@/lib/speciesCards";
import type { SpeciesCard as SpeciesCardRow } from "@/types";

const GRID_PADDING = 16;
const GRID_GAP = 12;

interface FieldGuideCollectionTabProps {
  tabBarClearance: number;
}

export function FieldGuideCollectionTab({
  tabBarClearance,
}: FieldGuideCollectionTabProps) {
  const { width: screenWidth } = useWindowDimensions();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { isAdmin } = useAdmin(userId);
  const tour = useAppTourOptional();
  const showTourDemo =
    tour?.phase === "tour" &&
    (APP_TOUR_STEPS[tour.stepIndex]?.id === "guide" ||
      APP_TOUR_STEPS[tour.stepIndex]?.id === "guide-tabs");
  const [cards, setCards] = useState<SpeciesCardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SpeciesCardRow | null>(null);
  const loadIdRef = useRef(0);

  const cardWidth = Math.floor(
    (screenWidth - GRID_PADDING * 2 - GRID_GAP) / 2,
  );
  const detailWidth = Math.min(340, Math.round(screenWidth * 0.82));

  const confirmDeleteCard = useCallback((card: SpeciesCardRow) => {
    Alert.alert(
      "Delete card?",
      `${card.species} will be removed from the collection. It can be earned again with camera Photo ID.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await deleteSpeciesCard(card.id);
                setCards((prev) => prev.filter((row) => row.id !== card.id));
                setSelected((current) => (current?.id === card.id ? null : current));
              } catch (e) {
                Alert.alert("Could not delete card", getUserFacingMessage(e));
              }
            })();
          },
        },
      ],
    );
  }, []);

  const loadCards = useCallback(
    async (options?: { silent?: boolean; seed?: SpeciesCardRow | null }) => {
      if (!userId) {
        setCards([]);
        setLoading(false);
        return;
      }

      const loadId = ++loadIdRef.current;

      if (options?.seed) {
        setCards((prev) => mergeSpeciesCardIntoList(options.seed!, prev));
        setLoading(false);
      } else if (!options?.silent) {
        setLoading(true);
      }

      setError(null);
      try {
        const rows = await listSpeciesCards(userId);
        if (loadId !== loadIdRef.current) return;
        setCards(
          options?.seed ? mergeSpeciesCardIntoList(options.seed, rows) : rows,
        );
      } catch (e) {
        if (loadId !== loadIdRef.current) return;
        if (!options?.seed && !options?.silent) {
          setError(getUserFacingMessage(e));
        }
      } finally {
        if (loadId === loadIdRef.current) {
          setLoading(false);
        }
      }
    },
    [userId],
  );

  useEffect(() => {
    const seed = takeSeededSpeciesCollectionCard();
    void loadCards({ silent: Boolean(seed), seed });
    return subscribeSpeciesCollectionRefresh(() => {
      const next = takeSeededSpeciesCollectionCard();
      void loadCards({ silent: true, seed: next });
    });
  }, [loadCards]);

  const displayedCards = useMemo(() => {
    const withoutDemo = cards.filter((card) => card.id !== TOUR_DEMO_CARD_ID);
    if (!showTourDemo) return withoutDemo;
    return mergeSpeciesCardIntoList(buildTourDemoCard(), withoutDemo);
  }, [cards, showTourDemo]);

  if (loading) {
    return (
      <View className="flex-1">
        <TabEmptyState loading>{null}</TabEmptyState>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1">
        <TabEmptyState>{error}</TabEmptyState>
      </View>
    );
  }

  if (displayedCards.length === 0) {
    return (
      <View className="flex-1">
        <TabEmptyState>
          Photograph a bird with Photo ID in the camera to earn a card. Gallery
          uploads still count toward your life list.
        </TabEmptyState>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: GRID_PADDING,
          paddingTop: HEADER_BOTTOM_RADIUS + 12,
          paddingBottom: tabBarClearance + 16,
          flexDirection: "row",
          flexWrap: "wrap",
          gap: GRID_GAP,
        }}
        showsVerticalScrollIndicator={false}
      >
        {displayedCards.map((card) => (
          <SpeciesCard
            key={card.id}
            card={card}
            width={cardWidth}
            onPress={() => setSelected(card)}
            onLongPress={
              isAdmin && card.id !== TOUR_DEMO_CARD_ID
                ? () => confirmDeleteCard(card)
                : undefined
            }
          />
        ))}
      </ScrollView>

      <Modal
        visible={Boolean(selected)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}
      >
        <Pressable
          className="flex-1 items-center justify-center bg-black/80 px-5"
          onPress={() => setSelected(null)}
        >
          {selected ? (
            <Pressable
              onPress={() => {}}
              onLongPress={
                isAdmin && selected.id !== TOUR_DEMO_CARD_ID
                  ? () => confirmDeleteCard(selected)
                  : undefined
              }
              delayLongPress={450}
            >
              <SpeciesCard card={selected} width={detailWidth} variant="hero" />
            </Pressable>
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
}
