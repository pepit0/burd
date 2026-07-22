import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { Camera, Mic, Minus, Plus, Sparkles, Volume2, X } from "lucide-react-native";
import { AudioPlayer } from "@/components/AudioPlayer";
import { SoundLibraryPicker } from "@/components/SoundLibraryPicker";
import { KeyboardScreen } from "@/components/KeyboardScreen";
import { RarityBadge } from "@/components/RarityBadge";
import { useAuth } from "@/hooks/useAuth";
import { identifyImage, isPhotoValidationError, PhotoValidationError } from "@/lib/identify";
import {
  checkPhotoAuthenticity,
  PHOTO_AUTHENTICITY_ENABLED,
  type PhotoAuthStatus,
  validatePhotoAuthenticity,
} from "@/lib/photoAuthenticity";
import { validationFailureMessage } from "@/lib/photoValidation";
import { createSighting, getMyProfile, uploadSightingPhoto } from "@/lib/sightings";
import { linkSoundToSighting, getSoundLibraryEntry, uploadSoundClip } from "@/lib/soundLibrary";
import {
  displayScientificName,
  displaySpeciesName,
  enrichPrediction,
} from "@/lib/predictionLabels";
import { maybeGenerateSpeciesProfileAfterSighting } from "@/lib/speciesProfileLoad";
import { inferRegionalRarity } from "@/lib/rarity";
import { applyGeocodeFields } from "@/lib/geocode";
import { photoTakenAt } from "@/lib/photoMetadata";
import { getUserFacingMessage } from "@/lib/errors";
import { detectionSourceLabel } from "@/lib/fusePredictions";
import { soundReportSpecies } from "@/lib/heardSpecies";
import { takePendingCapture, type PendingCapture, type SessionPhoto } from "@/lib/pendingCapture";
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

function speciesFromParams(
  species: string | undefined,
  scientificName: string | undefined,
): string {
  if (!species?.trim()) return "";
  return displaySpeciesName({
    species,
    scientific_name: scientificName?.trim() || null,
    confidence: 0,
  });
}

function scientificFromParams(
  species: string | undefined,
  scientificName: string | undefined,
): string {
  return (
    displayScientificName({
      species: species ?? "",
      scientific_name: scientificName?.trim() || null,
      confidence: 0,
    }) ??
    scientificName?.trim() ??
    ""
  );
}

export default function NewSightingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const params = useLocalSearchParams<{
    source?: string;
    species?: string;
    scientific_name?: string;
    confidence?: string;
    count?: string;
    audio_agreed?: string;
    sound_library_id?: string;
    audio_only?: string;
    draftId?: string;
  }>();

  const draftId = params.draftId?.trim() || null;

  const [species, setSpecies] = useState(() =>
    speciesFromParams(params.species, params.scientific_name),
  );
  const [scientific, setScientific] = useState(() =>
    scientificFromParams(params.species, params.scientific_name),
  );
  const [rarity, setRarity] = useState<Rarity>("common");
  const [rarityLoading, setRarityLoading] = useState(false);
  const [count, setCount] = useState(parseCount(params.count));
  const [countFromPhoto, setCountFromPhoto] = useState(Boolean(params.count));
  const [countLoading, setCountLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [locationName, setLocationName] = useState("");
  const [locationCity, setLocationCity] = useState("");
  const [locationAddress, setLocationAddress] = useState("");
  const [observedAt, setObservedAt] = useState<Date>(() => new Date());
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [sessionPhotos, setSessionPhotos] = useState<SessionPhoto[]>([]);
  const [primaryPhotoId, setPrimaryPhotoId] = useState<string | null>(null);
  const [sessionAudio, setSessionAudio] = useState<PendingCapture["audio"]>(null);
  const [heardSpecies, setHeardSpecies] = useState<Prediction[]>([]);
  const [soundLibraryId, setSoundLibraryId] = useState<string | null>(
    params.sound_library_id?.trim() || null,
  );
  const [libraryEntry, setLibraryEntry] = useState<SoundLibraryEntry | null>(null);
  const [libraryPickerOpen, setLibraryPickerOpen] = useState(false);
  const [publishToProfile, setPublishToProfile] = useState(false);

  const audioOnly = params.audio_only === "1";

  const [submitting, setSubmitting] = useState(false);
  const [photoAuthStatus, setPhotoAuthStatus] = useState<PhotoAuthStatus>("idle");
  const [photoAuthMessage, setPhotoAuthMessage] = useState<string | null>(null);

  const [detectedBy, setDetectedBy] = useState<DetectedBy>(() =>
    params.source === "image" ||
    params.source === "audio" ||
    params.source === "both"
      ? params.source
      : "manual",
  );
  const [confidence, setConfidence] = useState<number | null>(() =>
    params.confidence ? Number(params.confidence) : null,
  );
  const photoSoundAgreed = params.audio_agreed === "1";

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const capture = takePendingCapture();
      if (capture) {
        if (cancelled) return;
        setSessionPhotos(capture.photos);
        const primary = capture.photos[capture.primaryIndex] ?? capture.photos[0];
        if (primary) {
          setPrimaryPhotoId(primary.id);
          setPhotoUri(primary.uri);
          setPhotoBase64(primary.base64);
          if (primary.capturedAt) {
            setObservedAt(new Date(primary.capturedAt));
          }
        }
        if (capture.count != null) {
          setCount(capture.count);
          setCountFromPhoto(true);
        }
        setSessionAudio(capture.audio ?? null);
        setHeardSpecies(soundReportSpecies(capture.analysis));
        if (capture.soundLibraryId) {
          setSoundLibraryId(capture.soundLibraryId);
        }
        return;
      }

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
  }, [draftId, params.species]);

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

    let cancelled = false;
    setRarityLoading(true);

    (async () => {
      try {
        const profile = userId ? await getMyProfile(userId) : null;
        const radiusKm = profile?.search_radius_km ?? 25;
        const next = await inferRegionalRarity(
          species,
          scientific.trim() || null,
          coords?.latitude ?? null,
          coords?.longitude ?? null,
          radiusKm,
          observedAt.toISOString(),
        );
        if (!cancelled) setRarity(next);
      } catch {
        if (!cancelled) setRarity("common");
      } finally {
        if (!cancelled) setRarityLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [species, scientific, coords, userId, observedAt]);

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
      void maybeGenerateSpeciesProfileAfterSighting(
        species.trim(),
        scientific.trim() || null,
        photoUrl,
      );
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
        contentContainerClassName="px-4 pb-12 pt-4 gap-4"
      >
        <Pressable
          onPress={audioOnly ? undefined : pickPhoto}
          disabled={audioOnly}
          className="h-44 items-center justify-center overflow-hidden rounded-2xl border border-border bg-card"
        >
          {photoUri && !audioOnly ? (
            <Image source={{ uri: photoUri }} className="h-full w-full" resizeMode="cover" />
          ) : audioOnly ? (
            <View className="items-center gap-2 px-6">
              <Mic size={28} color="#5f9470" />
              <Text className="text-center font-sans text-sm text-muted-foreground">
                Sound-only sighting
              </Text>
            </View>
          ) : (
            <View className="items-center gap-2">
              <Camera size={26} color="#8a9e82" />
              <Text className="font-sans text-sm text-muted-foreground">Add a photo</Text>
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
                    source={{ uri: photo.uri }}
                    className="h-16 w-16 bg-muted"
                    resizeMode="cover"
                  />
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {detectedBy !== "manual" && confidence !== null ? (
          <View className="flex-row items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2.5">
            <Sparkles size={15} color="#5f9470" />
            <Text className="flex-1 font-sans text-xs text-foreground/80">
              Identified by {detectionSourceLabel(detectedBy)} ·{" "}
              {Math.round(confidence * 100)}% match
              {photoSoundAgreed ? " · photo and sound agree" : ""}. Edit anything
              that looks off.
            </Text>
          </View>
        ) : null}

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
          <Text className="mb-1 font-sans-medium text-sm text-foreground/80">Species</Text>
          {countLoading && !species.trim() ? (
            <View className="flex-row items-center gap-2 rounded-xl border border-border bg-card px-4 py-3">
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
              className="rounded-xl border border-border bg-card px-4 py-3 font-sans text-base text-foreground"
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
            className="rounded-xl border border-border bg-card px-4 py-3 font-serif-italic text-base text-foreground"
          />
        </View>

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
    </SafeAreaView>
  );
}
