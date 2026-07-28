import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { Camera, Mic, Minus, Plus, Sparkles, Volume2, X } from "lucide-react-native";
import { AudioPlayer } from "@/components/AudioPlayer";
import { SoundLibraryPicker } from "@/components/SoundLibraryPicker";
import { PostSendOffOverlay } from "@/components/PostSendOffOverlay";
import { KeyboardScreen } from "@/components/KeyboardScreen";
import { RarityBadge } from "@/components/RarityBadge";
import { useAuth } from "@/hooks/useAuth";
import { usePostSendOff } from "@/hooks/usePostSendOff";
import { identifyImage, isPhotoValidationError, PhotoValidationError } from "@/lib/identify";
import {
  checkPhotoAuthenticity,
  PHOTO_AUTHENTICITY_ENABLED,
  type PhotoAuthStatus,
  validatePhotoAuthenticity,
} from "@/lib/photoAuthenticity";
import { validationFailureMessage } from "@/lib/photoValidation";
import { createSighting, uploadSightingPhoto } from "@/lib/sightings";
import { linkSoundToSighting, getSoundLibraryEntry, uploadSoundClip } from "@/lib/soundLibrary";
import {
  displayScientificName,
  displaySpeciesName,
  enrichPrediction,
} from "@/lib/predictionLabels";
import { maybeGenerateSpeciesProfileAfterSighting } from "@/lib/speciesProfileLoad";
import { lookupRegionalRarity } from "@/lib/rarity";
import { applyGeocodeFields } from "@/lib/geocode";
import { photoTakenAt } from "@/lib/photoMetadata";
import { getUserFacingMessage } from "@/lib/errors";
import { detectionSourceLabel } from "@/lib/fusePredictions";
import { soundReportSpecies } from "@/lib/heardSpecies";
import { claimPendingCaptureForSighting, clearPendingCapture, type PendingCapture, type SessionPhoto } from "@/lib/pendingCapture";
import {
  deleteCaptureDraft,
  getCaptureDraft,
  readPhotoBase64,
} from "@/lib/captureDrafts";
import type { DetectedBy, Prediction, Rarity, SoundLibraryEntry } from "@/types";

function parseCount(value: string | undefined): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(Math.round(n), 99);
}

function normalizeSightingPhotoUri(
  uri: string | null | undefined,
  base64: string | null | undefined,
): string | null {
  if (uri?.trim()) {
    const trimmed = uri.trim();
    if (
      trimmed.startsWith("file://") ||
      trimmed.startsWith("http://") ||
      trimmed.startsWith("https://") ||
      trimmed.startsWith("data:") ||
      trimmed.startsWith("blob:")
    ) {
      return trimmed;
    }
    if (trimmed.startsWith("/")) {
      return `file://${trimmed}`;
    }
    return trimmed;
  }
  if (base64?.trim()) {
    return `data:image/jpeg;base64,${base64.trim()}`;
  }
  return null;
}

function speciesFromParams(
  species: string | undefined,
  scientificName: string | undefined,
): string {
  const label = species?.trim() || scientificName?.trim() || "";
  if (!label) return "";
  return displaySpeciesName({
    species: label,
    scientific_name: scientificName?.trim() || null,
    confidence: 0,
  });
}

function scientificFromParams(
  species: string | undefined,
  scientificName: string | undefined,
): string {
  const label = species?.trim() || scientificName?.trim() || "";
  if (!label) return "";
  return (
    displayScientificName({
      species: label,
      scientific_name: scientificName?.trim() || null,
      confidence: 0,
    }) ??
    scientificName?.trim() ??
    ""
  );
}

type SightingParams = {
  source?: string;
  species?: string;
  scientific_name?: string;
  confidence?: string;
  count?: string;
  audio_agreed?: string;
  sound_library_id?: string;
  audio_only?: string;
  draftId?: string;
};

interface SightingBootstrap {
  capture: PendingCapture | null;
  draftId: string | null;
  species: string;
  scientific: string;
  count: number;
  countFromPhoto: boolean;
  photoUri: string | null;
  photoBase64: string | null;
  sessionPhotos: SessionPhoto[];
  primaryPhotoId: string | null;
  sessionAudio: PendingCapture["audio"];
  heardSpecies: Prediction[];
  detectedBy: DetectedBy;
  confidence: number | null;
  photoSoundAgreed: boolean;
  observedAt: Date;
}

function buildSightingBootstrap(params: SightingParams): SightingBootstrap {
  const capture = claimPendingCaptureForSighting();
  const primary = capture
    ? (capture.photos[capture.primaryIndex] ?? capture.photos[0] ?? null)
    : null;
  const analysisTop = capture?.analysis?.top
    ? enrichPrediction(capture.analysis.top)
    : null;
  const paramSpecies = speciesFromParams(params.species, params.scientific_name);
  const paramScientific = scientificFromParams(params.species, params.scientific_name);

  const species = analysisTop?.species || paramSpecies;
  const scientific = analysisTop?.scientific_name ?? paramScientific;

  const detectedBy: DetectedBy =
    capture?.analysis?.detectedBy ??
    (params.source === "image" ||
    params.source === "audio" ||
    params.source === "both"
      ? params.source
      : "manual");

  const confidence =
    analysisTop?.confidence ??
    (params.confidence ? Number(params.confidence) : null);

  const countFromParams = Boolean(params.count);
  const count = capture?.count ?? parseCount(params.count);
  const draftId = params.draftId?.trim() || null;

  return {
    capture,
    draftId,
    species,
    scientific,
    count,
    countFromPhoto: capture?.count != null || countFromParams,
    photoUri: primary?.uri ?? null,
    photoBase64: primary?.base64 ?? null,
    sessionPhotos: capture?.photos ?? [],
    primaryPhotoId: primary?.id ?? null,
    sessionAudio: capture?.audio ?? null,
    heardSpecies: capture?.analysis
      ? soundReportSpecies(capture.analysis)
      : [],
    detectedBy,
    confidence: Number.isFinite(confidence) ? confidence : null,
    photoSoundAgreed:
      capture?.analysis?.agreed ?? params.audio_agreed === "1",
    observedAt: primary?.capturedAt
      ? new Date(primary.capturedAt)
      : new Date(),
  };
}

export default function NewSightingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { sendOffKey, playSendOff, onSendOffComplete } = usePostSendOff();

  const params = useLocalSearchParams<SightingParams>();

  const [bootstrap] = useState(() => buildSightingBootstrap(params));
  const draftId = bootstrap.draftId;

  const [species, setSpecies] = useState(bootstrap.species);
  const [scientific, setScientific] = useState(bootstrap.scientific);
  const [rarity, setRarity] = useState<Rarity>("common");
  const [rarityLoading, setRarityLoading] = useState(false);
  const [count, setCount] = useState(bootstrap.count);
  const [countFromPhoto, setCountFromPhoto] = useState(bootstrap.countFromPhoto);
  const [countLoading, setCountLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [locationName, setLocationName] = useState("");
  const [locationCity, setLocationCity] = useState("");
  const [locationAddress, setLocationAddress] = useState("");
  const [observedAt, setObservedAt] = useState<Date>(bootstrap.observedAt);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(bootstrap.photoUri);
  const [photoBase64, setPhotoBase64] = useState<string | null>(bootstrap.photoBase64);
  const [photoDisplayUri, setPhotoDisplayUri] = useState<string | null>(() =>
    normalizeSightingPhotoUri(bootstrap.photoUri, bootstrap.photoBase64),
  );
  const [sessionPhotos, setSessionPhotos] = useState<SessionPhoto[]>(bootstrap.sessionPhotos);
  const [primaryPhotoId, setPrimaryPhotoId] = useState<string | null>(bootstrap.primaryPhotoId);
  const [sessionAudio, setSessionAudio] = useState<PendingCapture["audio"]>(bootstrap.sessionAudio);
  const [heardSpecies, setHeardSpecies] = useState<Prediction[]>(bootstrap.heardSpecies);
  const [soundLibraryId, setSoundLibraryId] = useState<string | null>(
    bootstrap.capture?.soundLibraryId ??
      params.sound_library_id?.trim() ??
      null,
  );
  const [libraryEntry, setLibraryEntry] = useState<SoundLibraryEntry | null>(null);
  const [libraryPickerOpen, setLibraryPickerOpen] = useState(false);
  const [publishToProfile, setPublishToProfile] = useState(false);

  const audioOnly = params.audio_only === "1";

  const [submitting, setSubmitting] = useState(false);
  const [photoAuthStatus, setPhotoAuthStatus] = useState<PhotoAuthStatus>("idle");
  const [photoAuthMessage, setPhotoAuthMessage] = useState<string | null>(null);

  const [detectedBy, setDetectedBy] = useState<DetectedBy>(bootstrap.detectedBy);
  const [confidence, setConfidence] = useState<number | null>(bootstrap.confidence);
  const photoSoundAgreed = bootstrap.photoSoundAgreed;

  useEffect(() => {
    setPhotoDisplayUri(normalizeSightingPhotoUri(photoUri, photoBase64));
  }, [photoUri, photoBase64]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (bootstrap.capture) return;

      if (!draftId) return;
      const draft = await getCaptureDraft(draftId);
      if (cancelled || !draft) return;

      setSessionPhotos(draft.photos);
      const primary = draft.photos[draft.primaryIndex] ?? draft.photos[0];
      if (primary) {
        setPrimaryPhotoId(primary.id);
        setPhotoUri(primary.uri);
        setPhotoBase64(primary.base64);
        if (primary.capturedAt) {
          setObservedAt(new Date(primary.capturedAt));
        }
      }
      if (draft.geo) {
        setCoords({
          latitude: draft.geo.lat,
          longitude: draft.geo.lng,
        });
        setObservedAt(new Date(draft.geo.observedAt));
      }

      // Retry identify when resuming a draft without species params
      if (!params.species?.trim() && primary?.uri) {
        try {
          const identified = await identifyImage(primary.uri, {
            skipAuthenticity: true,
            base64: primary.base64,
            geo: draft.geo
              ? {
                  lat: draft.geo.lat,
                  lng: draft.geo.lng,
                  observedAt: draft.geo.observedAt,
                }
              : undefined,
          });
          if (cancelled) return;
          const top = identified.predictions[0]
            ? enrichPrediction(identified.predictions[0])
            : null;
          if (top) {
            setSpecies(top.species);
            setScientific(top.scientific_name ?? "");
            setDetectedBy("image");
            setConfidence(top.confidence);
          }
          if (identified.count) {
            setCount(identified.count);
            setCountFromPhoto(true);
          }
        } catch {
          // User can enter species manually
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bootstrap.capture, draftId, params.species]);

  useEffect(() => {
    const id = soundLibraryId ?? params.sound_library_id?.trim();
    if (!id) return;

    let cancelled = false;
    (async () => {
      const entry = await getSoundLibraryEntry(id);
      if (cancelled || !entry) return;
      setLibraryEntry(entry);
      setSoundLibraryId(entry.id);
      if (!params.species && entry.predictions[0]) {
        const top = enrichPrediction(entry.predictions[0]);
        setSpecies(top.species);
        setScientific(top.scientific_name ?? "");
      }
      if (entry.predictions.length > 0) {
        setHeardSpecies(entry.predictions);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [soundLibraryId, params.sound_library_id, params.species]);

  useEffect(() => {
    if (!photoUri) {
      setPhotoAuthStatus("idle");
      setPhotoAuthMessage(null);
      return;
    }

    if (!PHOTO_AUTHENTICITY_ENABLED) {
      setPhotoAuthStatus("passed");
      setPhotoAuthMessage(null);
      return;
    }

    let cancelled = false;
    setPhotoAuthStatus("checking");
    setPhotoAuthMessage(null);

    (async () => {
      const result = await checkPhotoAuthenticity(photoUri, photoBase64);
      if (cancelled) return;

      if (result.status === "passed") {
        setPhotoAuthStatus("passed");
        setPhotoAuthMessage(null);
        return;
      }

      const message =
        (result.validation && validationFailureMessage(result.validation)) ||
        result.message ||
        "This photo did not pass validation.";

      setPhotoAuthStatus("failed");
      setPhotoAuthMessage(message);
      Alert.alert("Photo not accepted", message, [
        { text: "OK", onPress: () => router.back() },
      ]);
    })();

    return () => {
      cancelled = true;
    };
  }, [photoUri, photoBase64, router]);

  const hasAudio = Boolean(libraryEntry?.audio_url || sessionAudio || soundLibraryId);
  const libraryLoading = Boolean(soundLibraryId && !libraryEntry);
  const canSubmit =
    !submitting &&
    !libraryLoading &&
    species.trim().length > 0 &&
    (hasAudio || photoUri) &&
    (!photoUri || !PHOTO_AUTHENTICITY_ENABLED || photoAuthStatus === "passed");

  function selectSessionPhoto(photo: SessionPhoto) {
    setPrimaryPhotoId(photo.id);
    setPhotoUri(photo.uri);
    setPhotoBase64(photo.base64);
    setPhotoDisplayUri(normalizeSightingPhotoUri(photo.uri, photo.base64));
    setPhotoAuthStatus("checking");
    setPhotoAuthMessage(null);
    if (photo.capturedAt) {
      setObservedAt(new Date(photo.capturedAt));
    }
    analyzePhoto(photo.uri, photo.base64);
  }

  async function resolveLocation(
    latitude: number,
    longitude: number,
  ): Promise<void> {
    setCoords({ latitude, longitude });
    try {
      const geo = await Location.reverseGeocodeAsync({ latitude, longitude });
      const place = geo[0];
      if (place) {
        const { city, address, label } = applyGeocodeFields(place);
        setLocationCity(city);
        setLocationAddress(address);
        setLocationName((prev) => prev || label || city);
      }
    } catch {
      // geocode is optional
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        await resolveLocation(pos.coords.latitude, pos.coords.longitude);
      } catch {
        // location is optional
      }
    })();
  }, []);

  useEffect(() => {
    if (!species.trim()) return;

    setRarityLoading(true);
    const next = lookupRegionalRarity({
      species,
      scientificName: scientific.trim() || null,
      lat: coords?.latitude ?? null,
      lng: coords?.longitude ?? null,
      observedAt: observedAt.toISOString(),
    });
    setRarity(next);
    setRarityLoading(false);
  }, [species, scientific, coords, observedAt]);

  async function analyzePhoto(uri: string, base64?: string | null) {
    setCountLoading(true);
    try {
      const identified = await identifyImage(uri, {
        base64,
        geo: coords
          ? {
              lat: coords.latitude,
              lng: coords.longitude,
              observedAt: observedAt.toISOString(),
            }
          : undefined,
      });
      const top = identified.predictions[0]
        ? enrichPrediction(identified.predictions[0])
        : null;
      if (top) {
        setSpecies(top.species);
        setScientific(top.scientific_name ?? "");
        setDetectedBy("image");
        setConfidence(top.confidence);
      }
      if (identified.count) {
        setCount(identified.count);
        setCountFromPhoto(true);
      }
    } catch (e) {
      if (e instanceof PhotoValidationError || isPhotoValidationError(e)) {
        Alert.alert(
          "Photo not accepted",
          validationFailureMessage(e.validation) || e.message,
        );
        setPhotoUri(null);
        setPhotoBase64(null);
        setSessionPhotos([]);
        setPrimaryPhotoId(null);
        setCountFromPhoto(false);
        setDetectedBy("manual");
        setConfidence(null);
      }
      // keep the current count if analysis fails for other reasons
    } finally {
      setCountLoading(false);
    }
  }

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.6,
      base64: true,
      exif: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setSessionPhotos([]);
      setPrimaryPhotoId(null);
      setPhotoUri(asset.uri);
      setPhotoBase64(asset.base64 ?? null);
      setPhotoDisplayUri(
        normalizeSightingPhotoUri(asset.uri, asset.base64 ?? null),
      );
      setPhotoAuthStatus("checking");
      setPhotoAuthMessage(null);
      setSpecies("");
      setScientific("");
      setDetectedBy("manual");
      setConfidence(null);
      setCountFromPhoto(false);
      const takenAt = await photoTakenAt(asset);
      if (takenAt) setObservedAt(takenAt);
      await analyzePhoto(asset.uri, asset.base64 ?? null);
    }
  }

  function attachLibraryEntry(entry: SoundLibraryEntry) {
    setLibraryEntry(entry);
    setSoundLibraryId(entry.id);
    setHeardSpecies(entry.predictions);
    if (!species.trim() && entry.predictions[0]) {
      setSpecies(entry.predictions[0].species);
      setScientific(entry.predictions[0].scientific_name ?? "");
    }
  }

  function detachLibraryAudio() {
    setLibraryEntry(null);
    setSoundLibraryId(null);
    if (!sessionAudio) {
      setHeardSpecies([]);
    }
  }

  async function handleSubmit() {
    if (!userId) return;
    if (!species.trim()) {
      Alert.alert("Species required", "Please enter the species you spotted.");
      return;
    }
    if (photoUri && PHOTO_AUTHENTICITY_ENABLED && photoAuthStatus !== "passed") {
      Alert.alert(
        "Photo not accepted",
        photoAuthMessage ?? "Please wait for photo validation to finish.",
      );
      return;
    }

    setSubmitting(true);
    try {
      if (photoUri && PHOTO_AUTHENTICITY_ENABLED && !(audioOnly || detectedBy === "audio")) {
        await validatePhotoAuthenticity(photoUri, photoBase64);
      }

      let photoUrl: string | null = null;
      if (!(audioOnly || detectedBy === "audio")) {
        let base64 = photoBase64;
        if (!base64 && photoUri) {
          base64 = await readPhotoBase64(photoUri);
        }
        if (base64) {
          photoUrl = await uploadSightingPhoto(userId, base64);
        }
      }

      let audioUrl: string | null = libraryEntry?.audio_url ?? null;
      let audioPredictions: Prediction[] | null =
        libraryEntry?.predictions ??
        (heardSpecies.length > 0 ? heardSpecies : null);

      if (!audioUrl && sessionAudio) {
        audioUrl = await uploadSoundClip(userId, sessionAudio.uri);
      }

      const sightingId = await createSighting(userId, {
        species: species.trim(),
        scientific_name: scientific.trim() || null,
        location_name: locationName.trim() || null,
        location_city: locationCity.trim() || null,
        location_address: locationAddress.trim() || null,
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
        observed_at: observedAt.toISOString(),
        rarity,
        count,
        notes: notes.trim() || null,
        photo_url: photoUrl,
        audio_url: audioUrl,
        audio_predictions: audioPredictions,
        confidence,
        detected_by: detectedBy,
        publish: publishToProfile,
      });

      if (soundLibraryId) {
        await linkSoundToSighting(soundLibraryId, sightingId);
      }
      if (draftId) {
        await deleteCaptureDraft(draftId);
      }
      clearPendingCapture();
      void maybeGenerateSpeciesProfileAfterSighting(
        species.trim(),
        scientific.trim() || null,
        photoUrl,
      );
      if (publishToProfile) {
        await playSendOff();
      }
      router.back();
    } catch (e) {
      if (e instanceof PhotoValidationError || isPhotoValidationError(e)) {
        Alert.alert(
          "Photo not accepted",
          validationFailureMessage(e.validation) || e.message,
        );
        return;
      }
      Alert.alert("Could not save", getUserFacingMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center justify-between border-b border-border px-4 pb-3 pt-2">
        <Pressable onPress={() => router.back()} className="p-1">
          <X size={22} color="#8a9e82" />
        </Pressable>
        <Text className="font-serif-semibold text-lg text-foreground">
          {audioOnly ? "Log sound sighting" : "Log a Sighting"}
        </Text>
        <View className="w-7" />
      </View>

      <KeyboardScreen
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-4 pb-12 pt-4 gap-5"
      >
        <View className="gap-3">
          <Pressable
            onPress={audioOnly ? undefined : pickPhoto}
            disabled={audioOnly}
            className="overflow-hidden rounded-2xl border border-border bg-muted/40"
          >
            {photoDisplayUri && !audioOnly ? (
              <Image
                source={{ uri: photoDisplayUri }}
                style={{ width: "100%", aspectRatio: 4 / 3 }}
                contentFit="contain"
                transition={200}
                onError={() => {
                  const fallback = normalizeSightingPhotoUri(null, photoBase64);
                  if (fallback && fallback !== photoDisplayUri) {
                    setPhotoDisplayUri(fallback);
                  }
                }}
              />
            ) : audioOnly ? (
              <View className="aspect-[4/3] items-center justify-center gap-2 px-6">
                <Mic size={28} color="#5f9470" />
                <Text className="text-center font-sans text-sm text-muted-foreground">
                  Sound-only sighting
                </Text>
              </View>
            ) : (
              <View className="aspect-[4/3] items-center justify-center gap-2">
                <Camera size={26} color="#8a9e82" />
                <Text className="font-sans text-sm text-muted-foreground">
                  Tap to add a photo
                </Text>
              </View>
            )}
          </Pressable>

          {sessionPhotos.length > 1 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="gap-2"
            >
              {sessionPhotos.map((photo) => {
                const selected = photo.id === primaryPhotoId;
                return (
                  <Pressable
                    key={photo.id}
                    onPress={() => selectSessionPhoto(photo)}
                    className={`overflow-hidden rounded-lg ${
                      selected ? "border-2 border-primary" : "border border-border"
                    }`}
                  >
                    <Image
                      source={{
                        uri:
                          normalizeSightingPhotoUri(photo.uri, photo.base64) ??
                          photo.uri,
                      }}
                      style={{ width: 64, height: 64 }}
                      contentFit="cover"
                    />
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
        </View>

        {(detectedBy !== "manual" && confidence !== null) || countLoading ? (
          <View className="gap-3 rounded-2xl border border-border bg-card p-4">
            {detectedBy !== "manual" && confidence !== null ? (
              <View className="flex-row items-center gap-2 rounded-xl bg-primary/10 px-3 py-2.5">
                <Sparkles size={15} color="#5f9470" />
                <Text className="flex-1 font-sans text-xs text-foreground/80">
                  Identified by {detectionSourceLabel(detectedBy)} ·{" "}
                  {Math.round(confidence * 100)}% match
                  {photoSoundAgreed ? " · photo and sound agree" : ""}. Edit
                  anything that looks off.
                </Text>
              </View>
            ) : null}

            <View>
              <Text className="mb-1 font-sans-medium text-sm text-foreground/80">
                Species
              </Text>
              {countLoading && !species.trim() ? (
                <View className="flex-row items-center gap-2 rounded-xl border border-border bg-background px-4 py-3">
                  <ActivityIndicator size="small" color="#5f9470" />
                  <Text className="font-sans text-sm text-muted-foreground">
                    Identifying species from photo…
                  </Text>
                </View>
              ) : (
                <TextInput
                  value={species}
                  onChangeText={setSpecies}
                  placeholder="e.g. Cedar Waxwing"
                  placeholderTextColor="#8a9e82"
                  className="rounded-xl border border-border bg-background px-4 py-3 font-sans text-base text-foreground"
                />
              )}
            </View>

            <View>
              <Text className="mb-1 font-sans-medium text-sm text-foreground/80">
                Scientific name (optional)
              </Text>
              <TextInput
                value={scientific}
                onChangeText={setScientific}
                placeholder="e.g. Bombycilla cedrorum"
                placeholderTextColor="#8a9e82"
                autoCapitalize="none"
                className="rounded-xl border border-border bg-background px-4 py-3 font-serif-italic text-base text-foreground"
              />
            </View>
          </View>
        ) : (
          <>
            <View>
              <Text className="mb-1 font-sans-medium text-sm text-foreground/80">
                Species
              </Text>
              <TextInput
                value={species}
                onChangeText={setSpecies}
                placeholder="e.g. Cedar Waxwing"
                placeholderTextColor="#8a9e82"
                className="rounded-xl border border-border bg-card px-4 py-3 font-sans text-base text-foreground"
              />
            </View>

            <View>
              <Text className="mb-1 font-sans-medium text-sm text-foreground/80">
                Scientific name (optional)
              </Text>
              <TextInput
                value={scientific}
                onChangeText={setScientific}
                placeholder="e.g. Bombycilla cedrorum"
                placeholderTextColor="#8a9e82"
                autoCapitalize="none"
                className="rounded-xl border border-border bg-card px-4 py-3 font-serif-italic text-base text-foreground"
              />
            </View>
          </>
        )}

        {sessionAudio || libraryEntry ? (
          <View className="gap-2 rounded-xl border border-border bg-card px-3 py-3">
            <View className="flex-row items-center justify-between gap-2">
              <View className="flex-row items-center gap-2">
                <Mic size={14} color="#5f9470" />
                <Text className="font-sans-medium text-sm text-foreground">
                  Bird call attached
                </Text>
              </View>
              {libraryEntry && !sessionAudio ? (
                <Pressable
                  onPress={detachLibraryAudio}
                  className="rounded-full px-2 py-1 active:opacity-70"
                >
                  <Text className="font-sans text-xs text-muted-foreground">
                    Remove
                  </Text>
                </Pressable>
              ) : null}
            </View>
            {libraryEntry ? (
              <AudioPlayer
                uri={libraryEntry.audio_url}
                durationMs={libraryEntry.duration_ms}
              />
            ) : sessionAudio ? (
              <>
                <AudioPlayer
                  uri={sessionAudio.uri}
                  durationMs={sessionAudio.durationMs}
                />
                <Text className="font-sans text-xs text-muted-foreground">
                  Audio uploads when you log this sighting.
                </Text>
              </>
            ) : null}
            {heardSpecies.length > 0 ? (
              <View className="mt-1 gap-1">
                <Text className="font-sans text-xs text-muted-foreground">
                  Perch heard:
                </Text>
                {heardSpecies.slice(0, 4).map((prediction, index) => (
                  <Text key={`${prediction.species}-${index}`} className="font-sans text-xs text-foreground/80">
                    · {displaySpeciesName(prediction)}
                    {displayScientificName(prediction)
                      ? ` (${displayScientificName(prediction)})`
                      : ""}{" "}
                    · {Math.round(prediction.confidence * 100)}%
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        ) : !sessionAudio ? (
          <Pressable
            onPress={() => setLibraryPickerOpen(true)}
            className="flex-row items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-3 active:opacity-90"
          >
            <Volume2 size={16} color="#5f9470" />
            <Text className="font-sans-medium text-sm text-foreground">
              Attach bird call from library
            </Text>
          </Pressable>
        ) : null}

        <View>
          <Text className="mb-1.5 font-sans-medium text-sm text-foreground/80">Rarity</Text>
          <View className="flex-row items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
            {rarityLoading ? (
              <ActivityIndicator size="small" color="#5f9470" />
            ) : (
              <RarityBadge rarity={rarity} />
            )}
            <Text className="flex-1 font-sans text-xs leading-relaxed text-muted-foreground">
              {coords
                ? "Based on species rarity and recent sightings near you."
                : "Waiting for location to estimate regional rarity."}
            </Text>
          </View>
        </View>

        <View>
          <Text className="mb-1.5 font-sans-medium text-sm text-foreground/80">Count</Text>
          <View className="flex-row items-center gap-4">
            <Pressable
              onPress={() => {
                setCountFromPhoto(false);
                setCount((c) => Math.max(1, c - 1));
              }}
              className="h-10 w-10 items-center justify-center rounded-xl border border-border bg-card"
            >
              <Minus size={16} color="#eee8d4" />
            </Pressable>
            {countLoading ? (
              <ActivityIndicator color="#5f9470" />
            ) : (
              <Text className="font-serif-semibold text-xl text-foreground">{count}</Text>
            )}
            <Pressable
              onPress={() => {
                setCountFromPhoto(false);
                setCount((c) => Math.min(99, c + 1));
              }}
              className="h-10 w-10 items-center justify-center rounded-xl border border-border bg-card"
            >
              <Plus size={16} color="#eee8d4" />
            </Pressable>
          </View>
          <Text className="mt-1.5 font-sans text-xs text-muted-foreground">
            {countLoading
              ? "Identifying birds in your photo..."
              : countFromPhoto
                ? "From your photo · adjust if needed."
                : photoUri
                  ? "Adjust the count if the photo estimate looks off."
                  : "Add a photo to auto-estimate count, or set manually."}
          </Text>
        </View>

        <View>
          <Text className="mb-1 font-sans-medium text-sm text-foreground/80">Location</Text>
          <TextInput
            value={locationName}
            onChangeText={setLocationName}
            placeholder="Where did you spot it?"
            placeholderTextColor="#8a9e82"
            className="rounded-xl border border-border bg-card px-4 py-3 font-sans text-base text-foreground"
          />
          <Text className="mt-1 font-mono text-[10px] text-muted-foreground/60">
            {coords
              ? `GPS attached · ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`
              : "Location not attached"}
          </Text>
        </View>

        <View>
          <Text className="mb-1 font-sans-medium text-sm text-foreground/80">
            Notes (optional)
          </Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Behavior, plumage, habitat..."
            placeholderTextColor="#8a9e82"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            className="min-h-24 rounded-xl border border-border bg-card px-4 py-3 font-sans text-base text-foreground"
          />
        </View>

        <View className="flex-row items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
          <View className="min-w-0 flex-1 pr-3">
            <Text className="font-sans-medium text-sm text-foreground">
              Share on profile
            </Text>
            <Text className="mt-1 font-sans text-xs leading-relaxed text-muted-foreground">
              Off saves to your journal only. Turn on to post to your profile and
              the public feed.
            </Text>
          </View>
          <Switch
            value={publishToProfile}
            onValueChange={setPublishToProfile}
            trackColor={{ false: "#3a4e35", true: "#5f9470" }}
            thumbColor="#f0ead6"
          />
        </View>

        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit}
          className={`mt-2 items-center rounded-xl py-3.5 ${
            canSubmit ? "bg-primary active:opacity-90" : "bg-primary/40"
          }`}
        >
          {submitting ? (
            <ActivityIndicator color="#f0ead6" />
          ) : PHOTO_AUTHENTICITY_ENABLED && photoAuthStatus === "checking" ? (
            <View className="flex-row items-center gap-2">
              <ActivityIndicator color="#f0ead6" size="small" />
              <Text className="font-sans-bold text-base text-primary-foreground">
                Checking photo…
              </Text>
            </View>
          ) : (
            <Text className="font-sans-bold text-base text-primary-foreground">
              {publishToProfile ? "Save & post" : "Save to journal"}
            </Text>
          )}
        </Pressable>
        {PHOTO_AUTHENTICITY_ENABLED && photoAuthStatus === "failed" && photoAuthMessage ? (
          <Text className="text-center font-sans text-xs text-red-400/90">
            {photoAuthMessage}
          </Text>
        ) : null}
      </KeyboardScreen>

      <SoundLibraryPicker
        visible={libraryPickerOpen}
        userId={userId}
        onClose={() => setLibraryPickerOpen(false)}
        onSelect={attachLibraryEntry}
      />

      <PostSendOffOverlay sendOffKey={sendOffKey} onComplete={onSendOffComplete} />
    </SafeAreaView>
  );
}
