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
import { SightingPhotoCropModal } from "@/components/SightingPhotoCropModal";
import { KeyboardScreen } from "@/components/KeyboardScreen";
import { RarityBadge } from "@/components/RarityBadge";
import { useAuth } from "@/hooks/useAuth";
import { usePostSendOff } from "@/hooks/usePostSendOff";
import { useProfile } from "@/hooks/useProfile";
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
import { profilePrivacyDefaults } from "@/lib/profilePreferences";
import {
  buildInitialPhotoEntries,
  createPhotoEntryDraft,
  newPhotoEntryId,
  syncActivePhotoMetadata,
  updatePhotoEntryDraft,
  type PhotoEntryDraft,
} from "@/lib/photoEntryDraft";
import { SIGHTING_PHOTO_ASPECT, type CroppedSightingPhoto } from "@/lib/sightingPhotoFrame";
import { VISIBILITY_OPTIONS } from "@/lib/privacySettings";
import { isSensitiveSpecies, getSensitiveSpeciesEntry } from "@/lib/sensitiveSpecies";
import type { DetectedBy, Prediction, Rarity, SightingPhotoInput, SightingVisibility, SoundLibraryEntry } from "@/types";

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
  const { profile } = useProfile(userId);
  const privacyDefaults = profilePrivacyDefaults(profile);
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
  const [photoEntries, setPhotoEntries] = useState<PhotoEntryDraft[]>(() =>
    buildInitialPhotoEntries(bootstrap, normalizeSightingPhotoUri),
  );
  const [activePhotoId, setActivePhotoId] = useState<string | null>(
    bootstrap.primaryPhotoId ?? bootstrap.sessionPhotos[0]?.id ?? null,
  );
  const activePhoto =
    photoEntries.find((entry) => entry.id === activePhotoId) ?? photoEntries[0] ?? null;
  const photoUri = activePhoto?.uri ?? null;
  const photoBase64 = activePhoto?.base64 ?? null;
  const photoDisplayUri = activePhoto?.displayUri ?? null;
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
  const [postVisibility, setPostVisibility] = useState<SightingVisibility>(
    privacyDefaults.defaultVisibility,
  );

  useEffect(() => {
    if (profile?.default_sighting_visibility) {
      setPostVisibility(profile.default_sighting_visibility);
    }
  }, [profile?.default_sighting_visibility]);

  const audioOnly = params.audio_only === "1";

  const [submitting, setSubmitting] = useState(false);
  const [photoAuthStatus, setPhotoAuthStatus] = useState<PhotoAuthStatus>("idle");
  const [photoAuthMessage, setPhotoAuthMessage] = useState<string | null>(null);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropSourceUri, setCropSourceUri] = useState<string | null>(null);

  const [detectedBy, setDetectedBy] = useState<DetectedBy>(bootstrap.detectedBy);
  const [confidence, setConfidence] = useState<number | null>(bootstrap.confidence);
  const photoSoundAgreed = bootstrap.photoSoundAgreed;

  useEffect(() => {
    if (!activePhotoId) return;
    setPhotoEntries((prev) =>
      syncActivePhotoMetadata(prev, activePhotoId, {
        species,
        scientific,
        count,
        confidence,
        detectedBy,
      }),
    );
  }, [species, scientific, count, confidence, detectedBy, activePhotoId]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (bootstrap.capture) return;

      if (!draftId) return;
      const draft = await getCaptureDraft(draftId);
      if (cancelled || !draft) return;

      setPhotoEntries(
        draft.photos.map((photo, index) =>
          createPhotoEntryDraft(
            photo,
            normalizeSightingPhotoUri(photo.uri, photo.base64),
            index === draft.primaryIndex
              ? {
                  species,
                  scientific,
                  count,
                  confidence,
                  detectedBy,
                }
              : undefined,
          ),
        ),
      );
      const primary = draft.photos[draft.primaryIndex] ?? draft.photos[0];
      if (primary) {
        setActivePhotoId(primary.id);
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
  const hasPhotos = photoEntries.length > 0;
  const canSubmit =
    !submitting &&
    !libraryLoading &&
    species.trim().length > 0 &&
    (hasAudio || hasPhotos) &&
    (!photoUri || !PHOTO_AUTHENTICITY_ENABLED || photoAuthStatus === "passed");

  function openPhotoCrop() {
    const entry = activePhoto;
    if (!entry) return;
    setCropSourceUri(entry.sourceUri);
    setCropModalOpen(true);
  }

  function applyCroppedPhoto(cropped: CroppedSightingPhoto) {
    if (!activePhotoId) return;
    setPhotoEntries((prev) =>
      updatePhotoEntryDraft(prev, activePhotoId, {
        uri: cropped.uri,
        base64: cropped.base64,
        displayUri: normalizeSightingPhotoUri(cropped.uri, cropped.base64),
        framed: true,
      }),
    );
    setCropModalOpen(false);
    setPhotoAuthStatus(PHOTO_AUTHENTICITY_ENABLED ? "checking" : "passed");
    setPhotoAuthMessage(null);
    void analyzePhoto(cropped.uri, cropped.base64);
  }

  function selectPhotoEntry(entry: PhotoEntryDraft) {
    setPhotoEntries((prev) =>
      syncActivePhotoMetadata(prev, activePhotoId, {
        species,
        scientific,
        count,
        confidence,
        detectedBy,
      }),
    );
    setActivePhotoId(entry.id);
    setSpecies(entry.species);
    setScientific(entry.scientific);
    setCount(entry.count);
    setConfidence(entry.confidence);
    setDetectedBy(entry.detectedBy);
    setObservedAt(new Date(entry.capturedAt));
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
        setPhotoEntries((prev) =>
          activePhotoId ? prev.filter((entry) => entry.id !== activePhotoId) : [],
        );
        setActivePhotoId(null);
        setCountFromPhoto(false);
        setDetectedBy("manual");
        setConfidence(null);
      }
      // keep the current count if analysis fails for other reasons
    } finally {
      setCountLoading(false);
    }
  }

  async function pickPhoto(append = false) {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.6,
      base64: true,
      exif: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const takenAt = await photoTakenAt(asset);
      const capturedAt = takenAt?.toISOString() ?? new Date().toISOString();
      const entry = createPhotoEntryDraft(
        {
          id: newPhotoEntryId(),
          uri: asset.uri,
          base64: asset.base64 ?? null,
          capturedAt,
        },
        normalizeSightingPhotoUri(asset.uri, asset.base64 ?? null),
        { framed: true },
      );

      if (append) {
        setPhotoEntries((prev) => [...prev, entry]);
      } else {
        setPhotoEntries([entry]);
      }
      setActivePhotoId(entry.id);
      setPhotoAuthStatus(PHOTO_AUTHENTICITY_ENABLED ? "checking" : "passed");
      setPhotoAuthMessage(null);
      setSpecies("");
      setScientific("");
      setDetectedBy("manual");
      setConfidence(null);
      setCountFromPhoto(false);
      if (takenAt) setObservedAt(takenAt);
      await analyzePhoto(asset.uri, asset.base64 ?? null);
    }
  }

  function handlePhotoPress() {
    if (audioOnly) return;
    if (photoUri) {
      openPhotoCrop();
      return;
    }
    void pickPhoto(false);
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
    const entriesForSave = syncActivePhotoMetadata(photoEntries, activePhotoId, {
      species,
      scientific,
      count,
      confidence,
      detectedBy,
    });
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
      let uploadedPhotos: SightingPhotoInput[] = [];
      if (!(audioOnly || detectedBy === "audio") && entriesForSave.length > 0) {
        uploadedPhotos = [];
        for (const entry of entriesForSave) {
          let base64 = entry.base64;
          if (!base64) {
            base64 = await readPhotoBase64(entry.uri);
          }
          const url = await uploadSightingPhoto(userId, base64);
          uploadedPhotos.push({
            photo_url: url,
            captured_at: entry.capturedAt,
            species: entry.species.trim() || species.trim(),
            scientific_name: entry.scientific.trim() || null,
            count: entry.count,
            confidence: entry.confidence,
            detected_by: entry.detectedBy,
          });
        }
        photoUrl = uploadedPhotos[0]?.photo_url ?? null;
      }

      let audioUrl: string | null = libraryEntry?.audio_url ?? null;
      let audioPredictions: Prediction[] | null =
        libraryEntry?.predictions ??
        (heardSpecies.length > 0 ? heardSpecies : null);

      if (!audioUrl && sessionAudio) {
        audioUrl = await uploadSoundClip(userId, sessionAudio.uri);
      }

      const sightingId = await createSighting(
        userId,
        {
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
          photos: uploadedPhotos,
          audio_url: audioUrl,
          audio_predictions: audioPredictions,
          confidence,
          detected_by: detectedBy,
          publish: publishToProfile,
          visibility: postVisibility,
        },
        profile,
      );

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

  const showAiIdentificationBanner = detectedBy !== "manual" && confidence !== null;
  const inputClassName =
    "min-h-[48px] rounded-xl border border-border bg-background px-4 py-3 font-sans text-base leading-5 text-foreground";
  const sectionClassName = "mb-8";
  const cardClassName = "rounded-2xl border border-border bg-card p-5";
  const cardStyle = { gap: 20 } as const;
  const fieldClassName = "";
  const fieldStyle = { gap: 10 } as const;
  const sectionLabelClassName =
    "font-sans-medium text-xs uppercase tracking-wide text-muted-foreground";
  const fieldLabelClassName = "font-sans-medium text-sm leading-5 text-foreground";

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <View className="flex-row items-center justify-between border-b border-border px-4 pb-4 pt-1">
        <Pressable onPress={() => router.back()} className="rounded-full p-2 active:bg-card">
          <X size={22} color="#8a9e82" />
        </Pressable>
        <Text className="font-serif-semibold text-base text-foreground">
          {audioOnly ? "Log sound sighting" : "Log a sighting"}
        </Text>
        <View className="w-10" />
      </View>

      <KeyboardScreen
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-5 pb-24 pt-6"
      >
        <View className={sectionClassName}>
          <Text className={`${sectionLabelClassName} mb-3`}>Photo</Text>
          <Pressable
            onPress={handlePhotoPress}
            disabled={audioOnly}
            className="overflow-hidden rounded-2xl border border-border bg-black/30"
          >
            {photoDisplayUri && !audioOnly ? (
              <Image
                source={{ uri: photoDisplayUri }}
                style={{ width: "100%", aspectRatio: SIGHTING_PHOTO_ASPECT }}
                contentFit="contain"
                transition={200}
                onError={() => {
                  const fallback = normalizeSightingPhotoUri(null, photoBase64);
                  if (fallback && fallback !== photoDisplayUri && activePhotoId) {
                    setPhotoEntries((prev) =>
                      updatePhotoEntryDraft(prev, activePhotoId, { displayUri: fallback }),
                    );
                  }
                }}
              />
            ) : audioOnly ? (
              <View
                className="items-center justify-center gap-2 px-6"
                style={{ aspectRatio: SIGHTING_PHOTO_ASPECT }}
              >
                <Mic size={28} color="#5f9470" />
                <Text className="text-center font-sans text-sm text-muted-foreground">
                  Sound-only sighting
                </Text>
              </View>
            ) : (
              <View
                className="items-center justify-center gap-2"
                style={{ aspectRatio: SIGHTING_PHOTO_ASPECT }}
              >
                <Camera size={26} color="#8a9e82" />
                <Text className="font-sans text-sm text-muted-foreground">
                  Tap to add a photo
                </Text>
              </View>
            )}
          </Pressable>
          {photoDisplayUri && !audioOnly ? (
            <Text className="mt-3 text-center font-sans text-xs leading-5 text-muted-foreground">
              Tap photo to crop or zoom
            </Text>
          ) : null}

          {photoEntries.length > 0 && !audioOnly ? (
            <View className={`${cardClassName} mt-5`} style={cardStyle}>
              <View className="flex-row items-start justify-between gap-3">
                <Text className={`${fieldLabelClassName} min-w-0 flex-1 shrink leading-relaxed`}>
                  {photoEntries.length} photo{photoEntries.length === 1 ? "" : "s"} in this entry
                </Text>
                <Pressable
                  onPress={() => void pickPhoto(true)}
                  className="shrink-0 rounded-full border border-border px-3 py-2 active:opacity-80"
                >
                  <Text className="font-sans-medium text-xs text-primary">Add photo</Text>
                </Pressable>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerClassName="gap-3 py-1"
              >
                {photoEntries.map((entry, index) => {
                  const selected = entry.id === activePhotoId;
                  return (
                    <Pressable
                      key={entry.id}
                      onPress={() => selectPhotoEntry(entry)}
                      className={`overflow-hidden rounded-lg ${
                        selected ? "border-2 border-primary" : "border border-border"
                      }`}
                    >
                      <Image
                        source={{
                          uri: entry.displayUri ?? entry.uri,
                        }}
                        style={{ width: 64, height: 64 }}
                        contentFit="cover"
                      />
                      <View className="absolute bottom-0 left-0 right-0 bg-black/55 py-0.5">
                        <Text className="text-center font-mono text-[10px] text-white">
                          {index + 1}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <Text className="font-sans text-xs leading-5 text-muted-foreground">
                Select a photo to edit its species and count before saving.
              </Text>
            </View>
          ) : null}
        </View>

        <View className={`${cardClassName} ${sectionClassName}`} style={cardStyle}>
          <Text className={sectionLabelClassName}>Identification</Text>

          {showAiIdentificationBanner ? (
            <View className="flex-row items-start gap-3 rounded-xl bg-primary/10 px-4 py-3.5">
              <Sparkles size={15} color="#5f9470" style={{ marginTop: 2 }} />
              <Text className="min-w-0 flex-1 shrink font-sans text-xs leading-5 text-foreground/80">
                Identified by {detectionSourceLabel(detectedBy)} ·{" "}
                {Math.round(confidence! * 100)}% match
                {photoSoundAgreed ? " · photo and sound agree" : ""}. Edit anything that
                looks off.
              </Text>
            </View>
          ) : null}

          <View className={fieldClassName} style={fieldStyle}>
            <Text className={fieldLabelClassName}>Species</Text>
            {countLoading && !species.trim() ? (
              <View className="min-h-[48px] flex-row items-center gap-3 rounded-xl border border-border bg-background px-4 py-3">
                <ActivityIndicator size="small" color="#5f9470" />
                <Text className="min-w-0 flex-1 shrink font-sans text-sm leading-5 text-muted-foreground">
                  Identifying species from photo…
                </Text>
              </View>
            ) : (
              <TextInput
                value={species}
                onChangeText={setSpecies}
                placeholder="e.g. Cedar Waxwing"
                placeholderTextColor="#8a9e82"
                className={inputClassName}
              />
            )}
          </View>

          <View className={fieldClassName} style={fieldStyle}>
            <Text className={fieldLabelClassName}>Scientific name</Text>
            <Text className="-mt-1 font-sans text-xs leading-5 text-muted-foreground">
              Optional
            </Text>
            <TextInput
              value={scientific}
              onChangeText={setScientific}
              placeholder="e.g. Bombycilla cedrorum"
              placeholderTextColor="#8a9e82"
              autoCapitalize="none"
              className={`${inputClassName} font-serif-italic`}
            />
          </View>
        </View>

        {sessionAudio || libraryEntry ? (
          <View className={`${cardClassName} ${sectionClassName}`} style={cardStyle}>
            <Text className={sectionLabelClassName}>Bird call</Text>
            <View className="flex-row items-center justify-between gap-3">
              <View className="min-w-0 flex-1 shrink flex-row items-center gap-2">
                <Mic size={15} color="#5f9470" />
                <Text className={fieldLabelClassName}>Attached</Text>
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
                <Text className="font-sans text-xs leading-5 text-muted-foreground">
                  Audio uploads when you log this sighting.
                </Text>
              </>
            ) : null}
            {heardSpecies.length > 0 ? (
              <View className="gap-2 border-t border-border pt-4">
                <Text className="font-sans-medium text-xs leading-5 text-muted-foreground">
                  Perch heard
                </Text>
                {heardSpecies.slice(0, 4).map((prediction, index) => (
                  <Text
                    key={`${prediction.species}-${index}`}
                    className="font-sans text-xs leading-5 text-foreground/80"
                  >
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
            className={`${sectionClassName} flex-row items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/40 bg-primary/5 px-5 py-5 active:opacity-90`}
          >
            <Volume2 size={16} color="#5f9470" />
            <Text className="font-sans-medium text-sm text-foreground">
              Attach bird call from library
            </Text>
          </Pressable>
        ) : null}

        <View className={`${cardClassName} ${sectionClassName}`} style={cardStyle}>
          <Text className={sectionLabelClassName}>Sighting details</Text>

          <View className={fieldClassName} style={fieldStyle}>
            <Text className={fieldLabelClassName}>Rarity</Text>
            <View className="flex-row items-start gap-3 rounded-xl border border-border bg-background px-4 py-4">
              <View className="shrink-0 pt-0.5">
                {rarityLoading ? (
                  <ActivityIndicator size="small" color="#5f9470" />
                ) : (
                  <RarityBadge rarity={rarity} />
                )}
              </View>
              <Text className="min-w-0 flex-1 shrink font-sans text-xs leading-5 text-muted-foreground">
                {coords
                  ? "Based on species rarity and recent sightings near you."
                  : "Waiting for location to estimate regional rarity."}
              </Text>
            </View>
          </View>

          <View className={fieldClassName} style={fieldStyle}>
            <Text className={fieldLabelClassName}>Count</Text>
            <View className="flex-row items-center gap-5 py-1">
              <Pressable
                onPress={() => {
                  setCountFromPhoto(false);
                  setCount((c) => Math.max(1, c - 1));
                }}
                className="h-11 w-11 items-center justify-center rounded-xl border border-border bg-background"
              >
                <Minus size={16} color="#eee8d4" />
              </Pressable>
              {countLoading ? (
                <ActivityIndicator color="#5f9470" />
              ) : (
                <Text className="min-w-[2rem] text-center font-serif-semibold text-2xl text-foreground">
                  {count}
                </Text>
              )}
              <Pressable
                onPress={() => {
                  setCountFromPhoto(false);
                  setCount((c) => Math.min(99, c + 1));
                }}
                className="h-11 w-11 items-center justify-center rounded-xl border border-border bg-background"
              >
                <Plus size={16} color="#eee8d4" />
              </Pressable>
            </View>
            <Text className="font-sans text-xs leading-5 text-muted-foreground">
              {countLoading
                ? "Identifying birds in your photo..."
                : countFromPhoto
                  ? "From your photo · adjust if needed."
                  : photoUri
                    ? "Adjust the count if the photo estimate looks off."
                    : "Add a photo to auto-estimate count, or set manually."}
            </Text>
          </View>
        </View>

        <View className={`${cardClassName} ${sectionClassName}`} style={cardStyle}>
          <Text className={sectionLabelClassName}>Location & notes</Text>

          <View className={fieldClassName} style={fieldStyle}>
            <Text className={fieldLabelClassName}>Location</Text>
            <TextInput
              value={locationName}
              onChangeText={setLocationName}
              placeholder="Where did you spot it?"
              placeholderTextColor="#8a9e82"
              className={inputClassName}
            />
            <Text className="font-mono text-[11px] leading-5 text-muted-foreground/70">
              {coords
                ? `GPS attached · ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`
                : "Location not attached"}
            </Text>
          </View>

          <View className={fieldClassName} style={fieldStyle}>
            <Text className={fieldLabelClassName}>Notes</Text>
            <Text className="-mt-1 font-sans text-xs leading-5 text-muted-foreground">
              Optional
            </Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Behavior, plumage, habitat..."
              placeholderTextColor="#8a9e82"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              className={`min-h-[120px] ${inputClassName} py-3`}
            />
          </View>
        </View>

        <View className={sectionClassName}>
          <View className="flex-row items-start justify-between rounded-2xl border border-border bg-card px-5 py-5">
            <View className="min-w-0 flex-1 shrink pr-4">
              <Text className={fieldLabelClassName}>Share on profile</Text>
              <Text className="mt-2 font-sans text-xs leading-5 text-muted-foreground">
                Off saves to your journal only. Turn on to post to your profile and feed.
              </Text>
            </View>
            <View className="shrink-0 pt-1">
              <Switch
                value={publishToProfile}
                onValueChange={setPublishToProfile}
                trackColor={{ false: "#3a4e35", true: "#5f9470" }}
                thumbColor="#f0ead6"
              />
            </View>
          </View>

          {publishToProfile ? (
            <View className={`${cardClassName} mt-5`} style={cardStyle}>
              <Text className={fieldLabelClassName}>Who can see this post</Text>
              <View className="flex-row flex-wrap gap-2.5">
                {VISIBILITY_OPTIONS.filter((o) => o.id !== "private").map((option) => {
                  const active = postVisibility === option.id;
                  return (
                    <Pressable
                      key={option.id}
                      onPress={() => setPostVisibility(option.id)}
                      className={`rounded-full border px-3 py-2 ${
                        active ? "border-primary bg-primary/15" : "border-border bg-background"
                      }`}
                    >
                      <Text
                        className={`font-sans text-xs ${
                          active ? "font-sans-medium text-primary" : "text-muted-foreground"
                        }`}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {isSensitiveSpecies(scientific, species) ? (
            <View className="mt-5 rounded-2xl border border-accent/30 bg-accent/10 px-5 py-5">
              <Text className={fieldLabelClassName}>Sensitive species</Text>
              <Text className="mt-2 font-sans text-xs leading-5 text-muted-foreground">
                {getSensitiveSpeciesEntry(scientific, species)?.common_name ?? species} locations
                are automatically obscured for conservation, regardless of your privacy settings.
              </Text>
            </View>
          ) : null}
        </View>

        <View className="gap-4">
          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit}
            className={`items-center rounded-2xl px-5 py-4 ${
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
            <Text className="px-1 text-center font-sans text-xs leading-5 text-red-400/90">
              {photoAuthMessage}
            </Text>
          ) : null}
        </View>
      </KeyboardScreen>

      <SoundLibraryPicker
        visible={libraryPickerOpen}
        userId={userId}
        onClose={() => setLibraryPickerOpen(false)}
        onSelect={attachLibraryEntry}
      />

      <SightingPhotoCropModal
        visible={cropModalOpen}
        uri={cropSourceUri}
        onCancel={() => setCropModalOpen(false)}
        onConfirm={applyCroppedPhoto}
      />

      <PostSendOffOverlay sendOffKey={sendOffKey} onComplete={onSendOffComplete} />
    </SafeAreaView>
  );
}
