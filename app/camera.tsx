import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { useRouter } from "expo-router";
import { Audio } from "expo-av";
import {
  CameraView,
  useCameraPermissions,
  type CameraType,
  type FlashMode,
} from "expo-camera";
import {
  Check,
  Grid3x3,
  Images,
  Mic,
  RotateCcw,
  Scan,
  SwitchCamera,
  Trash2,
  X,
  Zap,
  ZapOff,
} from "lucide-react-native";
import { identifySession, identificationFromLivePhoto } from "@/lib/identifySession";
import {
  PHOTO_AUTHENTICITY_ENABLED,
  validatePhotoAuthenticity,
} from "@/lib/photoAuthenticity";
import {
  isPhotoValidationError,
  validationFailureMessage,
} from "@/lib/photoValidation";
import {
  setPendingCapture,
  type SessionPhoto,
  type PendingCapture,
} from "@/lib/pendingCapture";
import { enrichPrediction } from "@/lib/predictionLabels";
import { soundConfirmsPhoto } from "@/lib/speciesMatch";
import { getUserFacingMessage } from "@/lib/errors";
import { canReuseLivePhotoDetection } from "@/lib/livePhotoSession";
import { LocationAccuracyBanner } from "@/components/LocationAccuracyBanner";
import { LivePhotoOverlay } from "@/components/LivePhotoOverlay";
import { LiveSoundConfirmationOverlay } from "@/components/LiveSoundConfirmationOverlay";
import { CameraZoomIndicator } from "@/components/CameraZoomIndicator";
import { useIdentificationLocation } from "@/hooks/useIdentificationLocation";
import { useLivePhotoId } from "@/hooks/useLivePhotoId";
import { useLiveSoundConfirmation } from "@/hooks/useLiveSoundConfirmation";
import { useCameraZoom } from "@/hooks/useCameraZoom";
import {
  IDENTIFY_FINISH_SLOW_HINT,
  IDENTIFY_FINISH_SLOW_HINT_MS,
  useSlowRequestHint,
} from "@/hooks/useSlowRequestHint";

function newPhotoId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function CameraScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const [facing, setFacing] = useState<CameraType>("back");
  const [flash, setFlash] = useState<FlashMode>("off");
  const [grid, setGrid] = useState(false);
  const [session, setSession] = useState<SessionPhoto[]>([]);
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const {
    permission: locationPermission,
    refresh: refreshLocation,
    openSettings: openLocationSettings,
  } = useIdentificationLocation({
    enabled: Boolean(permission?.granted),
  });

  const livePhoto = useLivePhotoId(cameraRef, {
    active: Boolean(permission?.granted),
    paused: busy || finishing,
  });

  const liveSound = useLiveSoundConfirmation();

  const cameraZoom = useCameraZoom(cameraRef, { facing });

  const showFinishSlowHint = useSlowRequestHint(
    finishing,
    IDENTIFY_FINISH_SLOW_HINT_MS,
  );

  const flashAnim = useRef(new Animated.Value(0)).current;

  if (!permission) {
    return <View className="flex-1 bg-black" />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background px-8">
        <View className="h-14 w-14 items-center justify-center rounded-2xl bg-primary">
          <SwitchCamera size={26} color="#f0ead6" />
        </View>
        <Text className="mt-4 text-center font-serif-semibold text-lg text-foreground">
          Camera access needed
        </Text>
        <Text className="mt-2 text-center font-sans text-sm leading-relaxed text-muted-foreground">
          Burd uses the camera so you can capture the birds you spot.
        </Text>
        <Pressable
          onPress={requestPermission}
          className="mt-5 rounded-xl bg-primary px-5 py-3"
        >
          <Text className="font-sans-medium text-sm text-primary-foreground">
            Grant access
          </Text>
        </Pressable>
        <Pressable onPress={() => router.back()} className="mt-3 px-5 py-2">
          <Text className="font-sans text-sm text-muted-foreground">Not now</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  function triggerFlashAnim() {
    flashAnim.setValue(1);
    Animated.timing(flashAnim, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }

  function primaryIndex(): number {
    if (session.length === 0) return 0;
    const idx = session.findIndex((p) => p.id === primaryId);
    return idx >= 0 ? idx : 0;
  }

  async function toggleLiveSound() {
    if (finishing) return;

    if (!liveSound.enabled) {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Microphone access needed",
          "Allow microphone access so Burd can listen for bird calls while you photograph.",
        );
        return;
      }
    }

    await liveSound.toggle();
  }

  async function capture() {
    if (busy || finishing) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current?.takePictureAsync({
        quality: 0.7,
        base64: true,
      });
      triggerFlashAnim();
      if (photo?.uri) {
        const entry: SessionPhoto = {
          id: newPhotoId(),
          uri: photo.uri,
          base64: photo.base64 ?? null,
          capturedAt: new Date().toISOString(),
        };
        setSession((prev) => [...prev, entry]);
        setPrimaryId((current) => current ?? entry.id);
      }
    } finally {
      setBusy(false);
    }
  }

  function removePhoto(id: string) {
    setSession((prev) => {
      const next = prev.filter((p) => p.id !== id);
      setPrimaryId((current) => {
        if (current !== id) return current;
        return next[0]?.id ?? null;
      });
      if (next.length === 0) setLibraryOpen(false);
      return next;
    });
  }

  const canFinish = session.length > 0;

  function confirmClose() {
    if (!canFinish) {
      if (liveSound.enabled) {
        void liveSound.stop();
      }
      router.back();
      return;
    }
    Alert.alert(
      "Discard session?",
      "Your session photos will be lost if you leave now.",
      [
        { text: "Keep shooting", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            void liveSound.stop();
            router.back();
          },
        },
      ],
    );
  }

  async function finishSession() {
    if (finishing) return;

    if (session.length === 0) {
      Alert.alert("Nothing to save", "Take a photo before finishing.");
      return;
    }

    setFinishing(true);
    try {
      const soundSnapshot = liveSound.enabled
        ? await liveSound.settle()
        : { primary: null, predictions: [] };

      const idx = primaryIndex();
      const primary = session[idx];

      if (PHOTO_AUTHENTICITY_ENABLED) {
        try {
          await validatePhotoAuthenticity(primary.uri, primary.base64);
        } catch (e) {
          Alert.alert(
            "Photo not accepted",
            isPhotoValidationError(e)
              ? validationFailureMessage(e.validation) || e.message
              : getUserFacingMessage(e),
          );
          return;
        }
      }

      const observedAt = new Date().toISOString();
      const coords = await refreshLocation();
      const geo = coords
        ? {
            lat: coords.latitude,
            lng: coords.longitude,
            observedAt,
          }
        : undefined;

      let result: Awaited<ReturnType<typeof identifySession>> | null = null;
      const livePrimary = livePhoto.primaryDetection;
      if (canReuseLivePhotoDetection(livePrimary)) {
        result = identificationFromLivePhoto(
          livePrimary,
          livePhoto.displayRows,
        );
      } else {
        try {
          result = await identifySession({
            photoUri: primary.uri,
            skipPhotoAuthenticity: true,
            photoBase64: primary.base64,
            geo,
          });
        } catch (e) {
          if (isPhotoValidationError(e)) {
            Alert.alert(
              "Photo not accepted",
              validationFailureMessage(e.validation) || e.message,
            );
            return;
          }
        }
      }

      const soundTop = soundSnapshot.primary
        ? enrichPrediction({
            ...soundSnapshot.primary.prediction,
            confidence: soundSnapshot.primary.peakConfidence,
          })
        : null;
      const agreed = soundConfirmsPhoto(result?.top ?? null, soundTop);

      const top = result?.top;
      const pending: PendingCapture = {
        photos: session,
        primaryIndex: idx,
        count: result?.count ?? 1,
        analysis: result
          ? {
              detectedBy: "image",
              top,
              agreed,
              imagePredictions: result.imagePredictions,
              audioPredictions: soundSnapshot.predictions,
              heardSpecies: soundSnapshot.predictions,
              count: result.count,
            }
          : undefined,
      };
      setPendingCapture(pending);

      router.replace({
        pathname: "/new-sighting",
        params: {
          source: "image",
          species: top?.species ?? "",
          scientific_name: top?.scientific_name ?? "",
          confidence: top ? String(top.confidence) : "",
          count: String(result?.count ?? 1),
          audio_agreed: agreed ? "1" : "0",
        },
      });
    } catch (e) {
      Alert.alert("Something went wrong", getUserFacingMessage(e));
    } finally {
      setFinishing(false);
    }
  }

  const cycleFlash = () =>
    setFlash((f) => (f === "off" ? "on" : f === "on" ? "auto" : "off"));

  const topPad = insets.top + 12;
  const bottomPad = insets.bottom + 20;
  const liveBannerTop = topPad + 52;
  const locationBannerTop = topPad + 56;
  // Keep Live ID reticle corners above shutter row and below top controls.
  const reticleTop = topPad + 44 + 16;
  const reticleBottom = bottomPad + 108 + 48 + 16;
  const photoBannerBlock =
    livePhoto.isScanning && livePhoto.primaryDetection
      ? 80
      : livePhoto.isScanning && livePhoto.isProcessing
        ? 36
        : 0;
  const soundBannerTop = liveBannerTop + (photoBannerBlock > 0 ? photoBannerBlock + 8 : 0);
  const soundBannerBlock =
    liveSound.enabled && liveSound.primaryDetection
      ? 72
      : liveSound.enabled && (liveSound.isProcessing || liveSound.chunkWarning)
        ? 36
        : 0;
  const locationTop =
    photoBannerBlock || soundBannerBlock
      ? liveBannerTop +
        (photoBannerBlock > 0 ? photoBannerBlock + 8 : 0) +
        (soundBannerBlock > 0 ? soundBannerBlock + 8 : 0)
      : locationBannerTop;
  const latestPhoto = session[session.length - 1];

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <View className="flex-1 bg-black">
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        flash={flash}
        zoom={cameraZoom.zoom}
        onCameraReady={cameraZoom.onCameraReady}
      />

      {grid && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View className="absolute left-1/3 top-0 bottom-0 w-px bg-white/25" />
          <View className="absolute left-2/3 top-0 bottom-0 w-px bg-white/25" />
          <View className="absolute top-1/3 left-0 right-0 h-px bg-white/25" />
          <View className="absolute top-2/3 left-0 right-0 h-px bg-white/25" />
        </View>
      )}

      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { opacity: flashAnim }]}
        className="bg-white"
      />

      {finishing && (
        <View className="absolute inset-0 z-20 items-center justify-center bg-black/60 px-8">
          <ActivityIndicator size="large" color="#5f9470" />
          <Text className="mt-3 text-center font-sans text-sm text-foreground/80">
            Identifying from photo...
          </Text>
          {showFinishSlowHint ? (
            <Text className="mt-2 text-center font-sans text-xs leading-relaxed text-amber-100/90">
              {IDENTIFY_FINISH_SLOW_HINT}
            </Text>
          ) : null}
        </View>
      )}

      <LivePhotoOverlay
        enabled={livePhoto.isScanning}
        isProcessing={livePhoto.isProcessing}
        primaryDetection={livePhoto.primaryDetection}
        spottedInFrame={livePhoto.spottedInFrame}
        statusMessage={livePhoto.statusMessage}
        coachMessage={livePhoto.coachMessage}
        bannerTop={liveBannerTop}
        reticleTop={reticleTop}
        reticleBottom={reticleBottom}
      />

      <LiveSoundConfirmationOverlay
        enabled={liveSound.enabled}
        isProcessing={liveSound.isProcessing}
        chunkWarning={liveSound.chunkWarning}
        soundDetection={liveSound.primaryDetection}
        photoDetection={livePhoto.primaryDetection}
        bannerTop={soundBannerTop}
      />

      <View
        className="absolute inset-x-4"
        style={{ top: locationTop }}
        pointerEvents="box-none"
      >
        <LocationAccuracyBanner
          permission={locationPermission}
          onEnablePress={() => {
            if (locationPermission === "denied") {
              openLocationSettings();
              return;
            }
            void refreshLocation();
          }}
        />
      </View>

      {/* Pinch-to-zoom sits above the preview but below controls. */}
      <GestureDetector gesture={cameraZoom.pinchGesture}>
        <View collapsable={false} style={[StyleSheet.absoluteFill, { zIndex: 5 }]} />
      </GestureDetector>

      {/* Top controls */}
      <View
        className="absolute inset-x-0 z-20 flex-row items-center justify-between px-4"
        style={{ top: topPad }}
      >
        <Pressable
          onPress={confirmClose}
          className="h-11 w-11 items-center justify-center rounded-full bg-background/60"
        >
          <X size={20} color="#eee8d4" />
        </Pressable>

        <View className="flex-row items-center gap-2">
          {canFinish ? (
            <Pressable
              onPress={finishSession}
              disabled={finishing}
              className="flex-row items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 active:opacity-90"
            >
              <Check size={16} color="#f0ead6" />
              <Text className="font-sans-medium text-sm text-primary-foreground">
                Done
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={cycleFlash}
            className={`h-11 w-11 items-center justify-center rounded-full ${
              flash === "off" ? "bg-background/60" : "bg-accent"
            }`}
          >
            {flash === "off" ? (
              <ZapOff size={18} color="#eee8d4" />
            ) : flash === "on" ? (
              <Zap size={18} color="#181e16" />
            ) : (
              <View className="flex-row items-center">
                <Zap size={15} color="#181e16" />
                <Text className="font-mono text-[9px] text-[#181e16]">A</Text>
              </View>
            )}
          </Pressable>

          <Pressable
            onPress={() => setGrid((g) => !g)}
            className={`h-11 w-11 items-center justify-center rounded-full ${
              grid ? "bg-accent" : "bg-background/60"
            }`}
          >
            <Grid3x3 size={18} color={grid ? "#181e16" : "#eee8d4"} />
          </Pressable>

          <Pressable
            onPress={() => livePhoto.setEnabled(!livePhoto.enabled)}
            disabled={finishing}
            className={`h-11 items-center justify-center rounded-full px-3 ${
              livePhoto.enabled ? "bg-accent" : "bg-background/60"
            }`}
          >
            <View className="flex-row items-center gap-1.5">
              <Scan size={16} color={livePhoto.enabled ? "#181e16" : "#eee8d4"} />
              <Text
                className={`font-sans-medium text-xs ${
                  livePhoto.enabled ? "text-[#181e16]" : "text-foreground"
                }`}
              >
                Live ID
              </Text>
            </View>
          </Pressable>
        </View>
      </View>

      {/* Bottom controls */}
      <View className="absolute inset-x-0 z-20" style={{ bottom: bottomPad }}>
        <View className="flex-row items-end px-8">
          <View className="w-16 items-center">
            <View className="-mt-4 mb-5 items-center">
              <Pressable
                onPress={toggleLiveSound}
                disabled={finishing}
                className={`relative h-12 w-12 items-center justify-center rounded-full border active:opacity-80 ${
                  liveSound.enabled
                    ? "border-primary bg-primary/25"
                    : "border-white/20 bg-background/60"
                }`}
              >
                <Mic
                  size={20}
                  color={liveSound.enabled ? "#5f9470" : "#eee8d4"}
                />
                {liveSound.isProcessing ? (
                  <View className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-accent" />
                ) : null}
              </Pressable>
            </View>

            <Pressable
              onPress={() => setLibraryOpen(true)}
              className="relative h-14 w-14 items-center justify-center rounded-xl border border-white/20 bg-background/50 active:opacity-80"
            >
              {latestPhoto ? (
                <Image
                  source={{ uri: latestPhoto.uri }}
                  className="h-full w-full rounded-xl"
                  resizeMode="cover"
                />
              ) : (
                <Images size={22} color="#eee8d4" />
              )}
              {session.length > 0 ? (
                <View className="absolute -right-1.5 -top-1.5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 py-0.5">
                  <Text className="font-mono text-[10px] text-primary-foreground">
                    {session.length}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          </View>

          <View className="flex-1 items-center">
            <CameraZoomIndicator
              zoomLabel={cameraZoom.zoomLabel}
              visible={cameraZoom.isPinching}
            />
            <Pressable
              onPress={capture}
              disabled={busy || finishing}
              className="h-[78px] w-[78px] items-center justify-center rounded-full border-4 border-primary bg-background/40 active:opacity-80"
            >
              <View className="h-[58px] w-[58px] rounded-full bg-foreground" />
            </Pressable>
          </View>

          <View className="w-16 items-center">
            <Pressable
              onPress={() => setFacing((f) => (f === "back" ? "front" : "back"))}
              className="h-14 w-14 items-center justify-center rounded-full bg-background/60"
            >
              <SwitchCamera size={22} color="#eee8d4" />
            </Pressable>
          </View>
        </View>
      </View>

      {/* Session library */}
      <Modal
        visible={libraryOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setLibraryOpen(false)}
      >
        <SafeAreaView className="flex-1 bg-background">
          <View className="flex-row items-center justify-between border-b border-border px-4 pb-3 pt-2">
            <Pressable onPress={() => setLibraryOpen(false)} className="p-1">
              <X size={22} color="#8a9e82" />
            </Pressable>
            <Text className="font-serif-semibold text-lg text-foreground">
              Session photos
            </Text>
            <Pressable
              onPress={() => {
                setLibraryOpen(false);
                finishSession();
              }}
              disabled={!canFinish || finishing}
              className="rounded-full px-3 py-1.5 active:opacity-80"
            >
              <Text
                className={`font-sans-medium text-sm ${
                  canFinish ? "text-primary" : "text-muted-foreground/40"
                }`}
              >
                Log
              </Text>
            </Pressable>
          </View>

          {session.length === 0 ? (
            <View className="flex-1 items-center justify-center px-8">
              <Images size={32} color="#8a9e82" />
              <Text className="mt-3 text-center font-sans text-sm text-muted-foreground">
                Photos you take will appear here for this session.
              </Text>
            </View>
          ) : (
            <ScrollView contentContainerClassName="flex-row flex-wrap p-3">
              {session.map((photo) => {
                const selected = photo.id === (primaryId ?? session[0]?.id);
                return (
                  <View key={photo.id} className="w-1/3 p-1.5">
                    <Pressable
                      onPress={() => setPrimaryId(photo.id)}
                      className={`overflow-hidden rounded-xl ${
                        selected ? "border-2 border-primary" : "border border-border"
                      }`}
                    >
                      <Image
                        source={{ uri: photo.uri }}
                        className="aspect-square w-full bg-muted"
                        resizeMode="cover"
                      />
                    </Pressable>
                    <View className="mt-1 flex-row items-center justify-between px-0.5">
                      {selected ? (
                        <Text className="font-mono text-[9px] text-primary">Primary</Text>
                      ) : (
                        <View />
                      )}
                      <Pressable
                        onPress={() => removePhoto(photo.id)}
                        className="p-1"
                        hitSlop={8}
                      >
                        <Trash2 size={12} color="#8a9e82" />
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}

          {session.length > 0 ? (
            <View className="border-t border-border px-4 py-3">
              <Text className="mb-3 text-center font-sans text-xs text-muted-foreground">
                Tap a photo to use it for identification when you log.
              </Text>
              <Pressable
                onPress={() => {
                  setSession([]);
                  setPrimaryId(null);
                  setLibraryOpen(false);
                }}
                className="flex-row items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 active:opacity-80"
              >
                <RotateCcw size={14} color="#8a9e82" />
                <Text className="font-sans-medium text-sm text-muted-foreground">
                  Clear session
                </Text>
              </Pressable>
            </View>
          ) : null}
        </SafeAreaView>
      </Modal>
    </View>
    </GestureHandlerRootView>
  );
}
