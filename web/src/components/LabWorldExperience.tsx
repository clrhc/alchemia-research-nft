import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Armchair,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpCircle,
  ArrowUpRight,
  Award,
  BookOpen,
  Brain,
  Building2,
  Camera,
  Check,
  CloudSnow,
  Coffee,
  Coins,
  Compass,
  Cookie,
  Cpu,
  Dices,
  DoorOpen,
  Download,
  Droplets,
  Eye,
  FileJson,
  Flame,
  FlaskConical,
  Flower2,
  Footprints,
  Gamepad2,
  Grid2x2,
  Heart,
  HeartHandshake,
  Home,
  LampCeiling,
  Layers,
  ListChecks,
  MapPin,
  Maximize2,
  MessageCircle,
  Microscope,
  Minimize2,
  Moon,
  Move,
  Music,
  Palette,
  Pause,
  PawPrint,
  Pencil,
  Pickaxe,
  Play,
  Plus,
  RotateCcw,
  RotateCw,
  Send,
  ShieldCheck,
  Shirt,
  Smile,
  Sofa,
  Sparkles,
  Sprout,
  Star,
  Sun,
  Sunset,
  Tag,
  Timer,
  Trees,
  Trophy,
  UserRound,
  Users,
  Volume2,
  VolumeX,
  Wallet,
  X,
  Zap
} from "lucide-react";
import { ArtworkCanvas, type ArtworkCanvasHandle } from "./ArtworkCanvas";
import { CharacterCreatorOverlay } from "./CharacterCreatorOverlay";
import { ContactMapSvg } from "./ContactMapSvg";
import { SequenceRibbonBar } from "./SequenceRibbonBar";
import { SimsPieMenu } from "./SimsPieMenu";
import type {
  AtmosphereMode,
  CameraMode,
  CameraPreset,
  CreatorFocusZone,
  LightingMood,
  WalkFrameTelemetry
} from "../engine/alchemy3DRenderer";
import type { LiveImpactState } from "../engine/alchemyRenderer";
import type { CharacterEmote } from "../engine/character3D";
import {
  PERSONALITY_TRAITS,
  createDefaultCharacterProfile,
  encodeCharacterCode,
  loadCharacterProfile,
  saveCharacterProfile,
  type CharacterProfile,
  type PersonalityTraitId
} from "../engine/characterConfig";
import { LAB_STATIONS, LAB_STATION_BY_ID, type LabStationId } from "../engine/labStations";
import {
  EXTRA_ROOM_DEFS,
  HOUSE_BASEMENT_DEF,
  HOUSE_FLOOR_DEFS,
  HOUSE_SIZE_DEFS,
  MOVABLE_ITEMS,
  WALL_STYLES,
  formatFloorLabel,
  getHouseBoundsRadius,
  resolveItemPlacement,
  type ExtraRoomId,
  type FloorNumber,
  type HouseFloorCount,
  type HouseSizeLevel,
  type MovableItemId
} from "../engine/homeLayout";
import {
  COMMUNITY_FOUNTAIN_POS,
  TOWN_PARKS,
  TOWN_STREETS,
  buildNeighborhoodRoster,
  computeNeighborhoodPlacements,
  computeUpcomingBlueprintLots,
  deriveNeighborCharacterProfile,
  getExpansionBandAvenueSpan,
  getExpansionBandCount,
  getNeighborhoodGrowthStage,
  getNeighborhoodPlotSlot,
  getNeighborhoodWalkLimit,
  type NeighborLabSummary
} from "../engine/neighborhoodLayout";
import {
  GARDEN_PLOT_DEFS,
  PLANT_SPECIES,
  PLANT_SPECIES_BY_ID,
  computePlotGrowth,
  fertilizeGardenPlot,
  harvestGardenPlot,
  loadGardenState,
  plantSeedInPlot,
  saveGardenState,
  waterGardenPlot,
  type GardenWorldState,
  type PlantSpeciesId
} from "../engine/gardenState";
import { declutterFloatingLabels, type DeclutterInput } from "../engine/spatialDeclutter";
import { deriveTraitsFromSeed } from "../engine/prng";
import {
  BAR_STYLES,
  FLOOR_STYLES,
  HOBBY_PROPS,
  LIGHTING_FIXTURES,
  MOOD_SHIFT_ACTIONS,
  PATIO_DECORS,
  PLANT_PACKS,
  ROOM_THEME_PRESETS,
  RUG_STYLES,
  SEATING_STYLES,
  SIMS_MOOD_VISUALS,
  STATION_UPGRADE_DEFS,
  addGuestbookEntry,
  applyNeighborSocialAction,
  applySimsVibeDelta,
  computeSimsMood,
  computeStationUpgradeBonuses,
  getNeighborSimsStatus,
  getNextUpgradeCost,
  getSimsPieActions,
  initialSimsVibes,
  loadGuestbookEntries,
  loadLabDecor,
  loadRelationshipsMap,
  moveItemInDecor,
  randomizeLabDecor,
  saveLabDecor,
  upgradeStationInDecor,
  type LabDecorConfig,
  type LabGuestbookEntry,
  type MoodShiftAction,
  type NeighborSocialAction,
  type SimsMoodName,
  type SimsMoodlet,
  type SimsObjectTarget,
  type SimsVibes,
  type StoredNeighborRelation,
  type UpgradeableStationId
} from "../engine/simsState";
import {
  ONBOARDING_STEPS,
  completeOnboardingStep,
  createInitialOnboardingState,
  getOnboardingProgress,
  loadOnboardingState,
  saveOnboardingState,
  type OnboardingState,
  type OnboardingStepId
} from "../engine/onboarding";
import {
  PROTEIN_BENCHMARKS,
  downloadPDBFromSnapshot,
  downloadScienceCertificateFromSnapshot,
  getDailyFoldingChallenge,
  type ComputeSnapshot
} from "../engine/researchCompute";
import {
  assignSecondaryStructurePSEA,
  computeContactMap,
  computeNativeContactFractionQ,
  computeStructureGeometryQuality,
  downloadMMCIFFromSnapshot
} from "../engine/structuralAnalysis";
import { soundEngine } from "../engine/soundEngine";
import {
  PET_ACCESSORY_LABELS,
  PET_ACCESSORY_ORDER,
  PET_BACK_GEAR_OPTIONS,
  PET_COLOR_SWATCHES,
  PET_OUTFIT_OPTIONS,
  applyTamagotchiAction,
  companionBoostMultiplier,
  companionMoodLabel,
  cycleCompanionAccessory,
  loadCompanionVitals,
  randomizeCompanionWardrobe,
  saveCompanionVitals,
  setCompanionAccessory,
  setCompanionBackGear,
  setCompanionOutfit,
  setCompanionOutfitColor,
  setCompanionPetName,
  toggleCompanionSleep,
  type CompanionVitals,
  type PetAccessory,
  type PetBackGearId,
  type PetOutfitId,
  type TamagotchiAction
} from "../engine/tamagotchi";
import { complexityTierFromUsd, usdToEth } from "../web3/config";
import {
  LAB_SECTORS,
  computeMiningRatePerHour,
  countSectors,
  hasSector
} from "../web3/sectors";
import { buildAnimationUrl, type MintedVessel } from "../web3/contractService";

export interface LabWorldExperienceProps {
  /** Active lab vessel metadata */
  vessel: MintedVessel;
  /** Optional list of switchable labs in My Labs */
  switchableVessels?: MintedVessel[];
  /** All known minted labs in the collection used to build the living neighborhood */
  allVessels?: MintedVessel[];
  /** Total minted collection supply controlling neighborhood scale */
  totalSupply?: number;
  onSelectTokenId?: (tokenId: number) => void;
  /** Optional demo callback in standalone mode to preview newly minted neighbors (+1 or +5 wave) */
  onSimulateNewNeighbor?: (count?: number) => void;
  /** Optional neighbor home to step directly inside (e.g., opened from Gallery "Visit Home") */
  initialVisitLab?: NeighborLabSummary | null;
  onClearInitialVisit?: () => void;
  /** Live impact & collection context */
  impact: LiveImpactState;
  userCoinBalance: number;
  totalCoinsDonatedToResearch: number;
  labSparks: number;
  walletAddress?: string | null;
  isPreviewLab?: boolean;
  standaloneMode?: boolean;
  animationUrl?: string;
  /** Whether to open Character Creator immediately on first visit or on first user interaction */
  creatorTriggerMode: "immediate" | "on-first-interaction";
  /** Optional full-app interactive mutations (omitted in standalone read-only NFT viewer) */
  onBuildSector?: (vessel: MintedVessel, sectorId: number, payWithCoins: boolean) => Promise<void>;
  onUpgradeVessel?: (vessel: MintedVessel, addedUsd: number) => Promise<void>;
  onClaimCoins?: (vessel: MintedVessel, amount: number, researchTithePct: number) => Promise<void>;
  onDonateCoins?: (vessel: MintedVessel, amount: number) => Promise<void>;
  onAnchorProof?: (vessel: MintedVessel, snap: ComputeSnapshot) => Promise<void>;
  onAwardPlayBonus?: (sparks: number) => void;
  onConnectWallet?: () => Promise<void>;
  onSpendCoinsForTreat?: (cost: number) => boolean;
  onGoMint?: () => void;
}

const LIGHTING_ORDER: LightingMood[] = ["daylight", "golden", "silver", "moonlit"];
const LIGHTING_LABELS: Record<LightingMood, string> = {
  daylight: "Day",
  golden: "Golden",
  silver: "Silver",
  moonlit: "Mist"
};
const ATMOSPHERE_ORDER: AtmosphereMode[] = ["clear", "snow", "motes"];
const ATMOSPHERE_LABELS: Record<AtmosphereMode, string> = {
  clear: "Clear",
  snow: "Snow",
  motes: "Motes"
};

type GoalKey = "pet" | "proton" | "fold" | "claim" | "room";
const LAB_GOALS_KEY = "alchemia.lab.goals.v1";

function loadGoals(): Record<GoalKey, boolean> {
  const empty: Record<GoalKey, boolean> = {
    pet: false,
    proton: false,
    fold: false,
    claim: false,
    room: false
  };
  if (typeof window === "undefined") return empty;
  try {
    const raw = window.localStorage.getItem(LAB_GOALS_KEY);
    if (!raw) return empty;
    return { ...empty, ...(JSON.parse(raw) as Partial<Record<GoalKey, boolean>>) };
  } catch {
    return empty;
  }
}

function EnergySparkline({ history }: { history: number[] }) {
  if (history.length < 3) return null;
  const minE = Math.min(...history) - 0.5;
  const maxE = Math.max(...history) + 0.5;
  const span = Math.max(1, maxE - minE);
  const w = 200;
  const h = 34;
  const pts = history
    .map((val, i) => {
      const x = (i / (history.length - 1)) * w;
      const y = h - 4 - ((val - minE) / span) * (h - 8);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="energy-sparkline" aria-label="Live protein energy curve">
      <polyline
        fill="none"
        stroke="#5b8def"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts}
      />
    </svg>
  );
}

const STATION_ICONS: Record<LabStationId, typeof Cpu> = {
  research: FlaskConical,
  mining: Pickaxe,
  pet: PawPrint,
  builder: Building2,
  console: Smile
};

export function LabWorldExperience({
  vessel,
  switchableVessels,
  allVessels,
  totalSupply,
  onSelectTokenId,
  onSimulateNewNeighbor,
  initialVisitLab,
  onClearInitialVisit,
  impact,
  userCoinBalance,
  totalCoinsDonatedToResearch,
  labSparks,
  walletAddress,
  isPreviewLab = false,
  standaloneMode = false,
  animationUrl,
  creatorTriggerMode,
  onBuildSector,
  onUpgradeVessel,
  onClaimCoins,
  onDonateCoins,
  onAnchorProof,
  onAwardPlayBonus,
  onConnectWallet,
  onSpendCoinsForTreat,
  onGoMint
}: LabWorldExperienceProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const artworkRef = useRef<ArtworkCanvasHandle>(null);

  // Direct DOM refs for 60fps zero-re-render 3D-to-2D projected floating panels, leader lines & mini-map!
  const floatingNodeRefs = useRef<Partial<Record<LabStationId, HTMLButtonElement | null>>>({});
  const leaderLineRefs = useRef<Partial<Record<LabStationId, SVGLineElement | null>>>({});
  const leaderDotRefs = useRef<Partial<Record<LabStationId, SVGCircleElement | null>>>({});
  const cachedPillSizesRef = useRef<Record<LabStationId, { width: number; height: number }>>({
    research: { width: 156, height: 42 },
    mining: { width: 146, height: 42 },
    pet: { width: 144, height: 42 },
    builder: { width: 142, height: 42 },
    console: { width: 152, height: 42 }
  });
  const radarPlayerRef = useRef<SVGGElement | null>(null);
  const radarPetRef = useRef<SVGCircleElement | null>(null);

  // Character state & first-interaction creator flow
  const [savedProfile, setSavedProfile] = useState<CharacterProfile | null>(() =>
    loadCharacterProfile()
  );
  const [creatorDraft, setCreatorDraft] = useState<CharacterProfile>(
    () => loadCharacterProfile() || createDefaultCharacterProfile()
  );
  const [creatorOpen, setCreatorOpen] = useState<boolean>(
    () => creatorTriggerMode === "immediate" && loadCharacterProfile() === null
  );
  const [creatorFocusZone, setCreatorFocusZone] = useState<CreatorFocusZone>("full");
  const [creatorTurntable, setCreatorTurntable] = useState<boolean>(false);
  const [characterEmote, setCharacterEmote] = useState<{
    emote: CharacterEmote;
    seq: number;
  } | null>(null);

  // Spatial navigation, Sims interactivity & Minted Neighborhood state
  const [nearStation, setNearStation] = useState<LabStationId | null>(null);
  const [openStation, setOpenStation] = useState<LabStationId | null>(null);
  const openStationRef = useRef<LabStationId | null>(null);
  openStationRef.current = openStation;

  const [cameraMode, setCameraMode] = useState<CameraMode>("follow");
  const cameraModeRef = useRef<CameraMode>("follow");
  cameraModeRef.current = cameraMode;

  const [camPreset, setCamPreset] = useState<{ preset: CameraPreset; seq: number } | null>(null);
  const [lightingMood, setLightingMood] = useState<LightingMood>("daylight");
  const [atmosphereMode, setAtmosphereMode] = useState<AtmosphereMode>("clear");
  const [soundOn, setSoundOn] = useState(() => soundEngine.isEnabled());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showTouchPad, setShowTouchPad] = useState(false);

  // Visit Other Users' Homes + Cozy Guestbook state
  const [visitingHome, setVisitingHome] = useState<NeighborLabSummary | null>(
    () => initialVisitLab || null
  );
  const [homeTransitionLabel, setHomeTransitionLabel] = useState<string | null>(null);
  const [guestbookDraft, setGuestbookDraft] = useState("");
  const [guestbookOpen, setGuestbookOpen] = useState(false);

  const isVisiting = Boolean(visitingHome);

  // Active 3D Lab Vessel currently loaded in the center (either your Home Lab or a Visited Neighbor's Home!)
  const activeVessel = useMemo<MintedVessel>(() => {
    if (!visitingHome) return vessel;
    const realMatch = allVessels?.find((v) => v.tokenId === visitingHome.tokenId);
    if (realMatch) return realMatch;
    return {
      tokenId: visitingHome.tokenId,
      seed: visitingHome.seed as `0x${string}`,
      causeId: visitingHome.causeId,
      causeName: visitingHome.causeName,
      minter: visitingHome.minter,
      ownedByUser: false,
      onChain: Boolean(vessel.onChain),
      valueUsd: visitingHome.valueUsd,
      impactEth: Number((usdToEth(visitingHome.valueUsd) * 0.6).toFixed(6)),
      sectorsMask: visitingHome.sectorsMask,
      workUnits: visitingHome.workUnits,
      lastClaimMs: Date.now() - 1800000,
      mintedAt: Math.floor(Date.now() / 1000) - 7200
    };
  }, [visitingHome, vessel, allVessels]);

  const visitingHostProfile = useMemo(
    () => (visitingHome ? deriveNeighborCharacterProfile(visitingHome) : null),
    [visitingHome]
  );

  // Sims-style Needs, Dynamic Moods/Moodlets, Social Relationships, Quick Rename & Living Town
  const [labDecor, setLabDecor] = useState<LabDecorConfig>(() =>
    loadLabDecor(activeVessel.tokenId, isVisiting ? activeVessel.seed : undefined)
  );
  const [guestbookEntries, setGuestbookEntries] = useState<LabGuestbookEntry[]>(() =>
    loadGuestbookEntries(activeVessel.tokenId, activeVessel.seed)
  );
  const [simsVibes, setSimsVibes] = useState<SimsVibes>(() => initialSimsVibes());
  const [activeMoodlet, setActiveMoodlet] = useState<SimsMoodlet | null>(null);
  const [relationsMap, setRelationsMap] = useState<Record<number, StoredNeighborRelation>>(() =>
    loadRelationshipsMap()
  );
  const [consoleSubTab, setConsoleSubTab] = useState<"sims" | "friends" | "studio">("sims");
  const [quickNameEditing, setQuickNameEditing] = useState(false);
  const [quickNameDraft, setQuickNameDraft] = useState("");
  const [currentActivity, setCurrentActivity] = useState<string | null>(null);
  const [pieMenu, setPieMenu] = useState<{
    target: SimsObjectTarget;
    x: number;
    y: number;
  } | null>(null);
  const [builderSubTab, setBuilderSubTab] = useState<"furnish" | "expand" | "move" | "upgrades">("furnish");
  const [furnishCategory, setFurnishCategory] = useState<
    "seating" | "bar" | "hobby" | "rug" | "patio" | "plants" | "lights" | "floor" | "walls"
  >("seating");
  const [activeFloor, setActiveFloor] = useState<FloorNumber>(1);
  const [movingItem, setMovingItem] = useState<MovableItemId | null>(null);
  const [moveSnapGrid, setMoveSnapGrid] = useState<boolean>(true);
  const [gardenState, setGardenState] = useState<GardenWorldState>(() =>
    loadGardenState(activeVessel.tokenId)
  );
  const [townSubTab, setTownSubTab] = useState<"town" | "gardens">("town");
  const [neighborhoodDrawerOpen, setNeighborhoodDrawerOpen] = useState(false);
  const neighborhoodDrawerOpenRef = useRef(false);
  neighborhoodDrawerOpenRef.current = neighborhoodDrawerOpen;
  const [inspectedNeighbor, setInspectedNeighbor] = useState<NeighborLabSummary | null>(null);
  const [extraDemoMints, setExtraDemoMints] = useState(0);
  const [charOutInNeighborhood, setCharOutInNeighborhood] = useState(false);
  const charOutRef = useRef(false);
  const [radarManualMode, setRadarManualMode] = useState<"auto" | "lab" | "district">("auto");
  const radarIsDistrict =
    radarManualMode === "district" ||
    (radarManualMode === "auto" &&
      (charOutInNeighborhood || cameraMode === "neighborhood" || neighborhoodDrawerOpen));
  const radarIsDistrictRef = useRef(false);
  radarIsDistrictRef.current = radarIsDistrict;

  const simsMood = useMemo(
    () => computeSimsMood(simsVibes, activeMoodlet),
    [simsVibes, activeMoodlet]
  );

  const visitingHostStatus = useMemo(
    () =>
      visitingHome
        ? getNeighborSimsStatus(visitingHome.tokenId, visitingHome.seed, relationsMap)
        : null,
    [visitingHome, relationsMap]
  );

  const visitingHostProp = useMemo(
    () =>
      visitingHome && visitingHostProfile
        ? {
            profile: visitingHostProfile,
            tokenId: visitingHome.tokenId,
            moodName: visitingHostStatus?.mood,
            plumbobHex: visitingHostStatus?.plumbobHex,
            tierLabel: visitingHostStatus?.tier
          }
        : null,
    [visitingHome, visitingHostProfile, visitingHostStatus]
  );

  // Living Minted NFT Neighborhood Roster & 3D Boulevard Placements
  // Always include your own Home Lab in known summaries so when you visit a neighbor, your home sits across the street!
  const knownNeighborSummaries = useMemo<NeighborLabSummary[]>(() => {
    const source = allVessels && allVessels.length > 0 ? allVessels : switchableVessels || [];
    const mapped: NeighborLabSummary[] = [];
    const seen = new Set<number>();
    const pushVessel = (v: MintedVessel) => {
      if (seen.has(v.tokenId)) return;
      seen.add(v.tokenId);
      mapped.push({
        tokenId: v.tokenId,
        seed: v.seed,
        causeId: v.causeId,
        causeName: v.causeName,
        minter: v.minter,
        valueUsd: v.valueUsd,
        complexityTier: complexityTierFromUsd(v.valueUsd),
        sectorsMask: v.sectorsMask,
        workUnits: v.workUnits,
        ownedByUser: v.ownedByUser
      });
    };
    pushVessel(vessel);
    for (const v of source) pushVessel(v);
    return mapped;
  }, [allVessels, switchableVessels, vessel]);

  const effectiveTotalSupply =
    Math.max(
      totalSupply ?? impact.totalSupply ?? 1,
      knownNeighborSummaries.length,
      1
    ) + extraDemoMints;

  const neighbors = useMemo(
    () =>
      buildNeighborhoodRoster(activeVessel.tokenId, knownNeighborSummaries, effectiveTotalSupply),
    [activeVessel.tokenId, knownNeighborSummaries, effectiveTotalSupply]
  );

  const neighborPlacements = useMemo(
    () => computeNeighborhoodPlacements(neighbors),
    [neighbors]
  );
  const ring1Placements = useMemo(
    () => neighborPlacements.filter((p) => p.ring === 1),
    [neighborPlacements]
  );
  const ring2Placements = useMemo(
    () => neighborPlacements.filter((p) => p.ring === 2),
    [neighborPlacements]
  );
  const ring3Placements = useMemo(
    () => neighborPlacements.filter((p) => p.ring === 3),
    [neighborPlacements]
  );
  const upcomingBlueprintLots = useMemo(
    () => computeUpcomingBlueprintLots(neighborPlacements.length, 4),
    [neighborPlacements.length]
  );
  const townGrowth = useMemo(
    () => getNeighborhoodGrowthStage(neighbors.length + 1),
    [neighbors.length]
  );
  const activeExpansionBands = useMemo(
    () => getExpansionBandCount(neighborPlacements.length + upcomingBlueprintLots.length),
    [neighborPlacements.length, upcomingBlueprintLots.length]
  );
  const districtRadarSpan = useMemo(
    () => getNeighborhoodWalkLimit(neighbors.length + 1),
    [neighbors.length]
  );
  const districtRadarSpanRef = useRef<number>(districtRadarSpan);
  districtRadarSpanRef.current = districtRadarSpan;

  // Live reactive mint-to-plot growth watcher: celebrates whenever ANY user mints on-chain
  // or via simulation and announces the newly formed plot & expansion roads!
  const prevEffectiveSupplyRef = useRef<number>(effectiveTotalSupply);
  const prevExpansionBandsRef = useRef<number>(activeExpansionBands);
  useEffect(() => {
    const prevSup = prevEffectiveSupplyRef.current;
    const prevBands = prevExpansionBandsRef.current;
    prevEffectiveSupplyRef.current = effectiveTotalSupply;
    prevExpansionBandsRef.current = activeExpansionBands;
    if (effectiveTotalSupply <= prevSup) return;

    const delta = effectiveTotalSupply - prevSup;
    const newestSlot = getNeighborhoodPlotSlot(Math.max(0, neighbors.length - 1));
    soundEngine.playBuildRoom();
    if (activeExpansionBands > prevBands) {
      setFeedback(
        `New Outer Expansion Road Ring #${activeExpansionBands} paved across the canal! +${delta} plot${delta === 1 ? "" : "s"} formed in ${newestSlot.districtName} (${effectiveTotalSupply} total labs)`
      );
    } else if (delta > 1) {
      setFeedback(
        `+${delta} newly minted NFTs formed new neighborhood plots across ${newestSlot.districtName}! (${effectiveTotalSupply} total labs)`
      );
    } else {
      setFeedback(
        `New Lab #${effectiveTotalSupply} just formed a plot on ${newestSlot.districtName}!`
      );
    }
  }, [effectiveTotalSupply, activeExpansionBands, neighbors.length]);

  // Lab feature states (Protein Folding, Mining, Pet Care, Room Builder, Goals)
  const [tithePct, setTithePct] = useState(20);
  const [donateAmt, setDonateAmt] = useState(25);
  const [liveSnap, setLiveSnap] = useState<ComputeSnapshot | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [previewSectorId, setPreviewSectorId] = useState<number | null>(null);
  const [selectedBenchmark, setSelectedBenchmark] = useState<number | null>(null);
  const [foldSignal, setFoldSignal] = useState<{
    action: "wiggle" | "shake" | "bury";
    seq: number;
  } | null>(null);
  const dailyChallenge = useMemo(() => getDailyFoldingChallenge(), []);
  const [dailyDone, setDailyDone] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem("alchemia.daily.fold.v1") === dailyChallenge.dateKey;
    } catch {
      return false;
    }
  });
  const [showContactMap, setShowContactMap] = useState(false);
  const [showBestFold, setShowBestFold] = useState(true);
  const [highlightedResidueIdx, setHighlightedResidueIdx] = useState<number | null>(null);
  const [goals, setGoals] = useState<Record<GoalKey, boolean>>(() => loadGoals());
  const [onboarding, setOnboarding] = useState<OnboardingState>(() => loadOnboardingState());
  const onboardingRef = useRef<OnboardingState>(onboarding);
  onboardingRef.current = onboarding;
  const onboardingProgress = useMemo(() => getOnboardingProgress(onboarding), [onboarding]);
  const [editingPetName, setEditingPetName] = useState(false);
  const [petNameDraft, setPetNameDraft] = useState("");
  const [petSubTab, setPetSubTab] = useState<"care" | "boutique">("care");
  const [vitals, setVitals] = useState<CompanionVitals>(() => loadCompanionVitals(vessel.tokenId));
  const [tamaSignal, setTamaSignal] = useState<{ action: TamagotchiAction; seq: number } | null>(
    null
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const [miniGame, setMiniGame] = useState<{
    endsAtMs: number;
    popped: number;
    goal: number;
  } | null>(null);

  const pressedKeysRef = useRef<Set<string>>(new Set());
  const touchDirRef = useRef<{ dx: number; dz: number }>({ dx: 0, dz: 0 });
  const manualPanelPinRef = useRef<boolean>(false);

  const activeProfile = creatorOpen ? creatorDraft : savedProfile;
  const walkModeActive = true;

  // Sync initialVisitLab when navigated from Gallery "Visit Home in 3D"
  useEffect(() => {
    if (!initialVisitLab) return;
    if (initialVisitLab.tokenId === vessel.tokenId) {
      setVisitingHome(null);
    } else {
      setVisitingHome(initialVisitLab);
      const host = deriveNeighborCharacterProfile(initialVisitLab);
      setCurrentActivity(`Visiting ${host.name}'s Home`);
      setFeedback(`Stepped inside ${host.name}'s Home (Lab #${initialVisitLab.tokenId})!`);
    }
    onClearInitialVisit?.();
  }, [initialVisitLab, vessel.tokenId, onClearInitialVisit]);

  // Clear visit mode if user explicitly switches their own Home Lab selector
  useEffect(() => {
    if (visitingHome && visitingHome.tokenId === vessel.tokenId) {
      setVisitingHome(null);
    }
  }, [vessel.tokenId, visitingHome]);

  // Keep pet vitals, decor, guestbook & benchmark synced when switching homes or labs
  useEffect(() => {
    const loaded = loadCompanionVitals(activeVessel.tokenId);
    setVitals(loaded);
    setPetNameDraft(loaded.petName);
    setEditingPetName(false);
    setSelectedBenchmark(null);
    setPreviewSectorId(null);
    setLabDecor(loadLabDecor(activeVessel.tokenId, isVisiting ? activeVessel.seed : undefined));
    setGuestbookEntries(loadGuestbookEntries(activeVessel.tokenId, activeVessel.seed));
    setGuestbookDraft("");
    setPieMenu(null);
    setInspectedNeighbor(null);
    setActiveFloor(1);
    setMovingItem(null);
    setGardenState(loadGardenState(activeVessel.tokenId));
  }, [activeVessel.tokenId, activeVessel.seed, isVisiting]);

  useEffect(() => {
    if (!homeTransitionLabel) return;
    const id = window.setTimeout(() => setHomeTransitionLabel(null), 520);
    return () => window.clearTimeout(id);
  }, [homeTransitionLabel]);

  // Subtle cozy Sims needs drift (Energy, Focus, Social, Fun)
  useEffect(() => {
    const id = window.setInterval(() => {
      setSimsVibes((prev) =>
        applySimsVibeDelta(prev, { energy: -1, focus: -1, social: -1, fun: -1 })
      );
    }, 45000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!feedback) return;
    const id = window.setTimeout(() => setFeedback(null), 4200);
    return () => window.clearTimeout(id);
  }, [feedback]);

  // Listen for browser Fullscreen changes
  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // 20-second cozy Proton Catch mini-game timer
  useEffect(() => {
    if (!miniGame) return;
    if (miniGame.popped >= miniGame.goal) {
      setMiniGame(null);
      onAwardPlayBonus?.(12);
      soundEngine.playBuildRoom();
      setTamaSignal((prev) => ({ action: "play", seq: (prev?.seq || 0) + 1 }));
      setFeedback(`Proton Catch cleared (${miniGame.goal}/${miniGame.goal}). +12 bonus sparks.`);
      return;
    }
    if (nowTick >= miniGame.endsAtMs) {
      const score = miniGame.popped;
      setMiniGame(null);
      setFeedback(`Proton Catch finished: popped ${score} of ${miniGame.goal}. Try again anytime.`);
    }
  }, [miniGame, nowTick, onAwardPlayBonus]);

  // Daily folding challenge auto-completion check
  useEffect(() => {
    if (
      !dailyDone &&
      liveSnap &&
      liveSnap.benchmarkIndex === dailyChallenge.benchmarkIndex &&
      liveSnap.bestEnergy <= dailyChallenge.targetEnergyKcal
    ) {
      setDailyDone(true);
      try {
        window.localStorage.setItem("alchemia.daily.fold.v1", dailyChallenge.dateKey);
      } catch {
        // ignore storage errors
      }
      onAwardPlayBonus?.(15);
      soundEngine.playBuildRoom();
      setFeedback(
        `Finished today's ${dailyChallenge.shortName} folding goal (${liveSnap.bestEnergy.toFixed(1)} kcal/mol). +15 sparks.`
      );
    }
  }, [dailyDone, liveSnap, dailyChallenge, onAwardPlayBonus]);

  const markGoalDone = useCallback(
    (key: GoalKey) => {
      setGoals((prev) => {
        if (prev[key]) return prev;
        const next = { ...prev, [key]: true };
        try {
          window.localStorage.setItem(LAB_GOALS_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        if (Object.values(next).every(Boolean)) {
          onAwardPlayBonus?.(5);
          setFeedback("All 5 lab goals finished. +5 bonus sparks.");
        }
        return next;
      });
    },
    [onAwardPlayBonus]
  );

  // Sync combined keyboard + touch walk input into Three.js renderer
  const pushMoveInput = useCallback(() => {
    const keys = pressedKeysRef.current;
    let dx = touchDirRef.current.dx;
    let dz = touchDirRef.current.dz;
    if (keys.has("KeyA") || keys.has("ArrowLeft")) dx -= 1;
    if (keys.has("KeyD") || keys.has("ArrowRight")) dx += 1;
    if (keys.has("KeyW") || keys.has("ArrowUp")) dz += 1;
    if (keys.has("KeyS") || keys.has("ArrowDown")) dz -= 1;
    const sprint = keys.has("ShiftLeft") || keys.has("ShiftRight");
    artworkRef.current?.setMoveInput(dx, dz, sprint);
  }, []);

  // Open Character Creator on first interaction in standalone mode if not yet created
  const openCharacterCreator = useCallback(() => {
    setOpenStation(null);
    setNeighborhoodDrawerOpen(false);
    setPieMenu(null);
    setCreatorDraft(savedProfile || createDefaultCharacterProfile());
    setCreatorOpen(true);
    soundEngine.playTap(1046.5);
  }, [savedProfile]);

  const completeGuideStep = useCallback(
    (stepId: OnboardingStepId) => {
      setOnboarding((prev) => {
        if (prev.completed[stepId]) return prev;
        const res = completeOnboardingStep(prev, stepId);
        if (!res.newlyCompleted) return prev;
        if (res.totalReward > 0) {
          onAwardPlayBonus?.(res.totalReward);
        }
        if (res.grandBonusAwarded) {
          soundEngine.playBuildRoom();
          artworkRef.current?.triggerCatalyticPulse(1.25);
          setCharacterEmote((e) => ({ emote: "spin", seq: (e?.seq || 0) + 1 }));
          setFeedback(
            `Housewarming Complete! All 5 welcome steps finished (+${res.totalReward} bonus sparks)!`
          );
        } else {
          const def = ONBOARDING_STEPS.find((s) => s.id === stepId);
          setFeedback(
            `Welcome Guide: "${def?.title || stepId}" complete!${
              onAwardPlayBonus ? ` +${res.stepReward} sparks.` : ""
            }`
          );
        }
        return res.nextState;
      });
    },
    [onAwardPlayBonus]
  );

  const completeGuideStepRef = useRef(completeGuideStep);
  completeGuideStepRef.current = completeGuideStep;

  const updateLabDecor = useCallback(
    (next: LabDecorConfig) => {
      const saved = saveLabDecor(activeVessel.tokenId, next);
      setLabDecor(saved);
      soundEngine.playTap(1046.5);
      completeGuideStep("furnish");
    },
    [activeVessel.tokenId, completeGuideStep]
  );

  const triggerPlayerMoodlet = useCallback((mood: SimsMoodName, label: string, source: string) => {
    setActiveMoodlet({
      id: `${mood}-${Date.now()}`,
      mood,
      label,
      source,
      expiresAtMs: Date.now() + 180_000
    });
  }, []);

  const handleShiftMood = useCallback(
    (act: MoodShiftAction) => {
      setSimsVibes((v) => applySimsVibeDelta(v, act.vibeDelta));
      triggerPlayerMoodlet(act.mood, act.moodletLabel, act.label);
      setCharacterEmote((prev) => ({ emote: act.emote, seq: (prev?.seq || 0) + 1 }));
      setCurrentActivity(`${act.label} (${act.mood})`);
      soundEngine.playTap(act.mood === "Playful" ? 1318.5 : 1046.5);
      setFeedback(`Mood shifted to ${act.mood}! (${act.moodletLabel})`);
      completeGuideStep("mood");
    },
    [triggerPlayerMoodlet, completeGuideStep]
  );

  const handleQuickRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (!savedProfile) return;
    const trimmed = quickNameDraft.trim().slice(0, 20);
    if (!trimmed) {
      setQuickNameEditing(false);
      return;
    }
    const updated = saveCharacterProfile({ ...savedProfile, name: trimmed });
    setSavedProfile(updated);
    setCreatorDraft(updated);
    setQuickNameEditing(false);
    soundEngine.playTap(1174.66);
    setFeedback(`Renamed your researcher to ${updated.name}!`);
  };

  const handleChangeTrait = (traitId: PersonalityTraitId) => {
    if (!savedProfile) return;
    const updated = saveCharacterProfile({ ...savedProfile, trait: traitId });
    setSavedProfile(updated);
    setCreatorDraft(updated);
    const opt = PERSONALITY_TRAITS.find((t) => t.id === traitId);
    soundEngine.playTap(1046.5);
    setFeedback(`Trait updated to ${opt?.label || traitId} — ${opt?.desc || ""}`);
  };

  const performNeighborSocial = useCallback(
    (
      tokenId: number,
      action: NeighborSocialAction,
      options?: { fireBeam?: boolean; awardSparks?: number }
    ) => {
      const targetLab =
        (visitingHome && visitingHome.tokenId === tokenId ? visitingHome : null) ||
        neighbors.find((n) => n.tokenId === tokenId) ||
        knownNeighborSummaries.find((n) => n.tokenId === tokenId);
      if (!targetLab) return;

      const npcProfile = deriveNeighborCharacterProfile(targetLab);
      const outcome = applyNeighborSocialAction(
        relationsMap,
        tokenId,
        targetLab.seed,
        action,
        savedProfile?.trait
      );
      setRelationsMap(outcome.nextMap);
      setSimsVibes((v) => applySimsVibeDelta(v, outcome.playerVibeDelta));
      triggerPlayerMoodlet(outcome.playerMood, outcome.moodletLabel, npcProfile.name);

      const emote: CharacterEmote =
        action === "joke" ? "hop" : action === "spark" ? "spin" : "wave";
      const bubble =
        action === "joke"
          ? "sparkle"
          : action === "collaborate"
            ? "dna"
            : action === "toast"
              ? "coffee"
              : "heart";

      setCharacterEmote((prev) => ({ emote, seq: (prev?.seq || 0) + 1 }));
      artworkRef.current?.syncNeighborNpcStatus(
        tokenId,
        outcome.status.mood,
        outcome.status.plumbobHex,
        outcome.status.tier,
        emote,
        bubble
      );
      if (visitingHome && visitingHome.tokenId === tokenId) {
        artworkRef.current?.triggerHostReaction(emote, bubble);
      }
      if (options?.fireBeam) {
        artworkRef.current?.fireSocialBeamToNeighbor(tokenId, outcome.status.plumbobHex);
      }
      if (options?.awardSparks) {
        onAwardPlayBonus?.(options.awardSparks);
      }
      if (outcome.leveledUp) {
        soundEngine.playBuildRoom();
        setFeedback(
          `Relationship Up! You & ${npcProfile.name} are now ${outcome.status.tier}s (${outcome.status.score}/100) · Both feeling ${outcome.status.mood}!`
        );
      } else {
        soundEngine.playPet();
        setFeedback(
          `${npcProfile.name} (${outcome.status.mood}): +${outcome.delta} Friendship (${outcome.status.score}/100 · ${outcome.status.tier})${
            options?.awardSparks && onAwardPlayBonus ? ` · +${options.awardSparks} sparks` : ""
          }`
        );
      }
    },
    [
      visitingHome,
      neighbors,
      knownNeighborSummaries,
      relationsMap,
      savedProfile?.trait,
      triggerPlayerMoodlet,
      onAwardPlayBonus
    ]
  );

  const handleEnterNeighborHome = useCallback(
    (lab: NeighborLabSummary) => {
      if (!savedProfile) {
        openCharacterCreator();
        return;
      }
      setPieMenu(null);
      setOpenStation(null);
      setNeighborhoodDrawerOpen(false);
      setInspectedNeighbor(null);
      setGuestbookOpen(false);

      // If clicking your own home lab while visiting someone else, return home seamlessly!
      if (lab.tokenId === vessel.tokenId) {
        setVisitingHome(null);
        setHomeTransitionLabel(`Returning Home · Lab #${vessel.tokenId}`);
        setCurrentActivity(null);
        setCameraMode("follow");
        soundEngine.playBuildRoom();
        window.setTimeout(() => artworkRef.current?.arriveAtFrontDoor(), 60);
        setFeedback(`Welcome back home to Lab #${vessel.tokenId}!`);
        return;
      }

      const host = deriveNeighborCharacterProfile(lab);
      const outcome = applyNeighborSocialAction(
        relationsMap,
        lab.tokenId,
        lab.seed,
        "visit",
        savedProfile.trait
      );
      setRelationsMap(outcome.nextMap);
      setVisitingHome(lab);
      setHomeTransitionLabel(`Entering ${host.name}'s Home · Lab #${lab.tokenId}`);
      setCurrentActivity(`Visiting ${host.name}'s Home`);
      setCameraMode("follow");
      setSimsVibes((prev) => applySimsVibeDelta(prev, outcome.playerVibeDelta));
      triggerPlayerMoodlet("Social", "Warm Welcome", host.name);
      soundEngine.playBuildRoom();
      window.setTimeout(() => artworkRef.current?.arriveAtFrontDoor(), 60);
      setFeedback(
        outcome.leveledUp
          ? `Entered ${host.name}'s home & became ${outcome.status.tier}s (${outcome.status.score}/100)!`
          : `Stepped inside ${host.name}'s home (Lab #${lab.tokenId} · +${outcome.delta} Friendship)!`
      );
    },
    [savedProfile, openCharacterCreator, vessel.tokenId, relationsMap, triggerPlayerMoodlet]
  );

  const handleSignGuestbook = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = guestbookDraft.trim();
    if (!trimmed) return;
    const author = savedProfile || creatorDraft;
    const updated = addGuestbookEntry(activeVessel.tokenId, activeVessel.seed, {
      authorName: author.name,
      authorTitle: author.title,
      message: trimmed,
      accent: author.outfitAccent
    });
    setGuestbookEntries(updated);
    setGuestbookDraft("");
    if (isVisiting && visitingHome) {
      performNeighborSocial(visitingHome.tokenId, "guestbook", { awardSparks: 2 });
    } else {
      soundEngine.playBuildRoom();
      setCharacterEmote((prev) => ({ emote: "wave", seq: (prev?.seq || 0) + 1 }));
      setFeedback(`Posted a welcome note in your Lab #${activeVessel.tokenId} guestbook!`);
    }
  };

  // WASD / Arrow walking + E interact + Space play + C wardrobe + V camera + N neighborhood + H home + M sound + Esc close
  useEffect(() => {
    const moveCodes = new Set([
      "KeyW",
      "KeyA",
      "KeyS",
      "KeyD",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "ShiftLeft",
      "ShiftRight"
    ]);

    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      // First interaction trigger in standalone NFT viewer when user tries to walk!
      if (!savedProfile && !creatorOpen && moveCodes.has(e.code)) {
        e.preventDefault();
        openCharacterCreator();
        return;
      }

      if (creatorOpen) {
        if (e.code === "Escape" && savedProfile) {
          setCreatorOpen(false);
        }
        return;
      }

      if (moveCodes.has(e.code)) {
        if (e.code.startsWith("Arrow")) e.preventDefault();
        pressedKeysRef.current.add(e.code);
        manualPanelPinRef.current = false;
        setPieMenu(null);
        setCurrentActivity(null);
        if (cameraModeRef.current === "neighborhood") {
          setCameraMode("follow");
        }
        pushMoveInput();
        return;
      }

      if (e.code === "Escape") {
        setPieMenu(null);
        setMovingItem(null);
        setOpenStation(null);
        setNeighborhoodDrawerOpen(false);
        setInspectedNeighbor(null);
        setPreviewSectorId(null);
        manualPanelPinRef.current = false;
      } else if (e.code === "KeyE" || (e.code === "Enter" && tag !== "BUTTON" && tag !== "A")) {
        if (openStation) {
          setOpenStation(null);
        } else if (nearStation) {
          setNeighborhoodDrawerOpen(false);
          setOpenStation(nearStation);
          soundEngine.playTap(1046.5);
        }
      } else if (e.code === "Space" && tag !== "BUTTON" && tag !== "A") {
        e.preventDefault();
        setTamaSignal((prev) => ({ action: "play", seq: (prev?.seq || 0) + 1 }));
        setCharacterEmote((prev) => ({ emote: "hop", seq: (prev?.seq || 0) + 1 }));
      } else if (e.key.toLowerCase() === "m") {
        setSoundOn(soundEngine.toggle());
      } else if (e.key.toLowerCase() === "v") {
        setCameraMode((prev) => {
          const next: CameraMode =
            prev === "follow" ? "orbit" : prev === "orbit" ? "neighborhood" : "follow";
          soundEngine.playTap(880);
          return next;
        });
      } else if (e.key.toLowerCase() === "n") {
        setPieMenu(null);
        setOpenStation(null);
        setNeighborhoodDrawerOpen((open) => {
          const next = !open;
          if (next) setCameraMode("neighborhood");
          else setCameraMode("follow");
          soundEngine.playTap(next ? 1046.5 : 880);
          return next;
        });
      } else if (e.key.toLowerCase() === "h") {
        setPieMenu(null);
        setNeighborhoodDrawerOpen(false);
        setCameraMode("follow");
        setCurrentActivity(null);
        artworkRef.current?.returnHome();
        soundEngine.playTap(987.77);
      } else if (e.key.toLowerCase() === "c") {
        openCharacterCreator();
      } else if (e.key === "1") {
        setCameraMode("orbit");
        setCamPreset((p) => ({ preset: "iso", seq: (p?.seq || 0) + 1 }));
      } else if (e.key === "2") {
        setCameraMode("orbit");
        setCamPreset((p) => ({ preset: "top", seq: (p?.seq || 0) + 1 }));
      } else if (e.key === "3") {
        setCameraMode("orbit");
        setCamPreset((p) => ({ preset: "pet", seq: (p?.seq || 0) + 1 }));
      } else if (e.key === "4") {
        setCameraMode("orbit");
        setCamPreset((p) => ({ preset: "molecule", seq: (p?.seq || 0) + 1 }));
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (pressedKeysRef.current.delete(e.code)) {
        pushMoveInput();
      }
    };

    const onBlur = () => {
      if (pressedKeysRef.current.size > 0) {
        pressedKeysRef.current.clear();
        pushMoveInput();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [savedProfile, creatorOpen, nearStation, openStation, pushMoveInput, openCharacterCreator]);

  // Measure floating pill sizes once on mount / resize (zero layout reads inside rAF!)
  useEffect(() => {
    const measure = () => {
      for (const st of LAB_STATIONS) {
        const el = floatingNodeRefs.current[st.id];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width > 40 && rect.height > 20) {
          cachedPillSizesRef.current[st.id] = { width: rect.width, height: rect.height };
        }
      }
    };
    const id = window.setTimeout(measure, 120);
    window.addEventListener("resize", measure);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("resize", measure);
    };
  }, [creatorOpen]);

  // 60fps direct-DOM decluttered spatial floating cards + SVG leader lines + live Mini-Map Radar!
  const handleWalkTelemetry = useCallback((telemetry: WalkFrameTelemetry) => {
    const drawerOpen = Boolean(openStationRef.current || neighborhoodDrawerOpenRef.current);
    const isCompact = telemetry.width < 820;
    const charDist = Math.hypot(telemetry.charX, telemetry.charZ);
    if (telemetry.moving && !onboardingRef.current.completed.walk) {
      completeGuideStepRef.current("walk");
    }

    // Smooth hysteresis switching between Home Lab & Boulevard Exploration mode
    if (!charOutRef.current && charDist > 4.2) {
      charOutRef.current = true;
      setCharOutInNeighborhood(true);
    } else if (charOutRef.current && charDist < 3.4) {
      charOutRef.current = false;
      setCharOutInNeighborhood(false);
    }

    const hideHomeFloats = charDist > 4.65 || cameraModeRef.current === "neighborhood";

    const inputs: DeclutterInput[] = LAB_STATIONS.map((st) => {
      const a = telemetry.anchors[st.id];
      const sz = cachedPillSizesRef.current[st.id];
      return {
        id: st.id,
        anchorX: a?.x ?? 0,
        anchorY: a?.y ?? 0,
        visible: !hideHomeFloats && Boolean(a?.visible),
        distToCam: a?.distToCam ?? 10,
        distToChar: a?.distToChar ?? 10,
        width: sz.width,
        height: sz.height
      };
    });

    const placed = declutterFloatingLabels(inputs, {
      width: telemetry.width,
      height: telemetry.height,
      padLeft: 14,
      padRight: drawerOpen && !isCompact ? 444 : 14,
      padTop: 98,
      padBottom: isCompact ? 86 : 96
    });

    for (const st of LAB_STATIONS) {
      const el = floatingNodeRefs.current[st.id];
      const line = leaderLineRefs.current[st.id];
      const dot = leaderDotRefs.current[st.id];
      const res = placed[st.id];
      const anchor = telemetry.anchors[st.id];

      if (!el) continue;
      if (!res || !res.visible) {
        el.style.opacity = "0";
        el.style.pointerEvents = "none";
        if (line) line.style.opacity = "0";
        if (dot) dot.style.opacity = "0";
        continue;
      }

      const nearBoost = anchor && anchor.distToChar <= st.triggerRadius ? 1.04 : 1.0;
      el.style.opacity = "1";
      el.style.pointerEvents = "auto";
      el.style.transform = `translate3d(${res.placedX.toFixed(1)}px, ${res.placedY.toFixed(
        1
      )}px, 0) translate(-50%, -100%) scale(${nearBoost.toFixed(3)})`;
      el.style.zIndex = String(res.zIndex);

      // Show delicate CAD hairline leader line whenever a floating card is nudged by decluttering/clamping
      const showLeader = res.offsetDist > 16;
      if (line && dot) {
        if (showLeader) {
          line.setAttribute("x1", res.anchorX.toFixed(1));
          line.setAttribute("y1", res.anchorY.toFixed(1));
          line.setAttribute("x2", res.placedX.toFixed(1));
          line.setAttribute("y2", res.placedY.toFixed(1));
          line.style.opacity = "0.55";
          dot.setAttribute("cx", res.anchorX.toFixed(1));
          dot.setAttribute("cy", res.anchorY.toFixed(1));
          dot.style.opacity = "0.85";
        } else {
          line.style.opacity = "0";
          dot.style.opacity = "0";
        }
      }
    }

    // Update live Architectural Blueprint Mini-Map Radar (dual-scale: Lab Close-Up or Dynamically Expanding Town!)
    const radarSpan = radarIsDistrictRef.current ? districtRadarSpanRef.current : 4.75;
    const mapCoord = (v: number) => Math.max(8, Math.min(104, 56 + (v / radarSpan) * 44));
    if (radarPlayerRef.current) {
      const rx = mapCoord(telemetry.charX);
      const ry = mapCoord(telemetry.charZ);
      const deg = (Math.atan2(Math.sin(telemetry.charYaw), Math.cos(telemetry.charYaw)) * 180) / Math.PI;
      radarPlayerRef.current.setAttribute(
        "transform",
        `translate(${rx.toFixed(1)} ${ry.toFixed(1)}) rotate(${(180 - deg).toFixed(1)})`
      );
    }
    if (radarPetRef.current) {
      if (telemetry.petX !== null && telemetry.petZ !== null) {
        radarPetRef.current.setAttribute("cx", mapCoord(telemetry.petX).toFixed(1));
        radarPetRef.current.setAttribute("cy", mapCoord(telemetry.petZ).toFixed(1));
        radarPetRef.current.style.opacity = "1";
      } else {
        radarPetRef.current.style.opacity = "0";
      }
    }
  }, []);

  // Auto-open floating station panel gently when walking onto a glowing floor pad,
  // and cleanly tuck away when walking away from it!
  const handleNearStationChange = useCallback((stationId: LabStationId | null) => {
    setNearStation(stationId);
    if (stationId) {
      manualPanelPinRef.current = false;
      setNeighborhoodDrawerOpen(false);
      setOpenStation(stationId);
      soundEngine.playTap(987.77);
    } else if (!manualPanelPinRef.current) {
      setOpenStation(null);
      setPreviewSectorId(null);
    }
  }, []);

  const handleStationArrived = useCallback((stationId: LabStationId) => {
    manualPanelPinRef.current = true;
    setNeighborhoodDrawerOpen(false);
    setOpenStation(stationId);
    soundEngine.playTap(1174.66);
  }, []);

  const navigateToStation = (stationId: LabStationId) => {
    if (!savedProfile) {
      openCharacterCreator();
      return;
    }
    soundEngine.playTap(987.77);
    manualPanelPinRef.current = true;
    setPieMenu(null);
    setNeighborhoodDrawerOpen(false);
    setCurrentActivity(null);
    setCameraMode("follow");
    setOpenStation(stationId);
    artworkRef.current?.walkToStation(stationId);
  };

  const handleVisitNeighbor = (tokenId: number) => {
    if (!savedProfile) {
      openCharacterCreator();
      return;
    }
    soundEngine.playTap(1046.5);
    setPieMenu(null);
    setOpenStation(null);
    setNeighborhoodDrawerOpen(false);
    setCameraMode("follow");
    setCurrentActivity(`Visiting Lab #${tokenId}`);
    setSimsVibes((prev) => applySimsVibeDelta(prev, { social: 10 }));
    artworkRef.current?.walkToNeighbor(tokenId);
    setFeedback(`Strolling down the boulevard to visit Lab #${tokenId}!`);
  };

  const handleSendNeighborSpark = (tokenId: number) => {
    soundEngine.playProtonPop(3);
    performNeighborSocial(tokenId, "spark", { fireBeam: true, awardSparks: 2 });
  };

  const handleReturnHome = () => {
    setPieMenu(null);
    setNeighborhoodDrawerOpen(false);
    setGuestbookOpen(false);
    setCurrentActivity(null);
    setCameraMode("follow");
    if (visitingHome) {
      soundEngine.playBuildRoom();
      setVisitingHome(null);
      setHomeTransitionLabel(`Returning Home · Lab #${vessel.tokenId}`);
      window.setTimeout(() => artworkRef.current?.arriveAtFrontDoor(), 60);
      setFeedback(`Welcome back home to Lab #${vessel.tokenId}!`);
      return;
    }
    soundEngine.playTap(987.77);
    artworkRef.current?.returnHome();
  };

  const handleSpawnNeighborMint = (count = 1) => {
    soundEngine.playBuildRoom();
    if (onSimulateNewNeighbor) {
      onSimulateNewNeighbor(count);
    } else {
      setExtraDemoMints((n) => n + count);
    }
    setCameraMode("neighborhood");
    const nextTotal = neighbors.length + 1 + count;
    const nextStage = getNeighborhoodGrowthStage(nextTotal);
    setFeedback(
      count > 1
        ? `+${count} newly minted NFT Labs just rose across ${nextStage.title}! (${nextTotal} total labs in town)`
        : `A newly minted NFT Lab just materialized on an open blueprint lot! (${nextTotal} labs · ${nextStage.title})`
    );
  };

  const handleOpenNeighborhood = () => {
    soundEngine.playTap(1046.5);
    setPieMenu(null);
    setOpenStation(null);
    setInspectedNeighbor(null);
    setNeighborhoodDrawerOpen((open) => {
      const next = !open;
      setCameraMode(next ? "neighborhood" : "follow");
      if (next) completeGuideStep("town");
      return next;
    });
  };

  const toggleFullscreen = async () => {
    const el = stageRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
      soundEngine.playTap(1046.5);
    } catch {
      // Fall back to opening standalone animation.html if browser blocks fullscreen
      if (animationUrl) window.open(animationUrl, "_blank", "noopener,noreferrer");
    }
  };

  // Derived Lab Stats (follows whichever home you are currently standing inside!)
  const traits = deriveTraitsFromSeed(activeVessel.seed);
  const tier = isVisiting ? complexityTierFromUsd(activeVessel.valueUsd) : impact.complexityTier;
  const stationBonuses = useMemo(
    () => computeStationUpgradeBonuses(labDecor.stationUpgrades),
    [labDecor.stationUpgrades]
  );
  const tamaBoost = Number((companionBoostMultiplier(vitals) + stationBonuses.petBoostBonus).toFixed(2));
  const baseRate = computeMiningRatePerHour(tier, activeVessel.sectorsMask, activeVessel.workUnits);
  const effectiveMiningRate = Number((baseRate * tamaBoost * stationBonuses.miningMult).toFixed(1));
  const builtCount = countSectors(activeVessel.sectorsMask);

  const handleUpgradeStation = useCallback(
    (stationId: UpgradeableStationId) => {
      if (isVisiting) {
        setFeedback("Return to your own Home Lab to purchase station upgrades!");
        return;
      }
      const def = STATION_UPGRADE_DEFS.find((d) => d.id === stationId);
      const curLvl = labDecor.stationUpgrades[stationId];
      const cost = getNextUpgradeCost(curLvl);
      if (!def || cost === null || curLvl === 3) return;

      if (!standaloneMode && onSpendCoinsForTreat) {
        const ok = onSpendCoinsForTreat(cost);
        if (!ok) {
          setFeedback(
            `Need ${cost} sparks for Lv.${curLvl + 1} ${def.name}. Pet your companion, play Mini Arcade, or pop protons!`
          );
          return;
        }
      }

      const nextDecor = upgradeStationInDecor(labDecor, stationId);
      const saved = saveLabDecor(activeVessel.tokenId, nextDecor);
      setLabDecor(saved);
      const nextTier = curLvl === 1 ? def.tiers[1] : def.tiers[2];
      soundEngine.playBuildRoom();
      setCharacterEmote((prev) => ({ emote: "hop", seq: (prev?.seq || 0) + 1 }));
      setSimsVibes((v) => applySimsVibeDelta(v, { focus: 12, fun: 10 }));
      triggerPlayerMoodlet("Inspired", `${nextTier.title} Built!`, def.name);
      setFeedback(`Upgraded ${def.name} to Lv.${curLvl + 1} ${nextTier.title} (${nextTier.perk})!`);
      completeGuideStep("furnish");
    },
    [
      isVisiting,
      labDecor,
      standaloneMode,
      onSpendCoinsForTreat,
      activeVessel.tokenId,
      triggerPlayerMoodlet,
      completeGuideStep
    ]
  );

  // ============================================================================
  // Multi-Story Floors, Home Size Expansion, 6 Homely Rooms & Free-Place Mover
  // ============================================================================
  const handleSwitchFloor = useCallback(
    (floor: FloorNumber) => {
      const minFloor: FloorNumber = labDecor.hasBasement ? 0 : 1;
      const clamped = Math.max(minFloor, Math.min(labDecor.houseFloors, floor)) as FloorNumber;
      setActiveFloor(clamped);
      artworkRef.current?.setActiveFloor(clamped);
      soundEngine.playTap(
        clamped === 0 ? 660 : clamped === 3 ? 1318.5 : clamped === 2 ? 1046.5 : 880
      );
      setCurrentActivity(`Exploring ${formatFloorLabel(clamped)}`);
    },
    [labDecor.hasBasement, labDecor.houseFloors]
  );

  const handleExpandHouseSize = useCallback(
    (targetSize: HouseSizeLevel) => {
      if (isVisiting) {
        setFeedback("Return to your own Home Lab to expand your house!");
        return;
      }
      const def = HOUSE_SIZE_DEFS.find((s) => s.level === targetSize);
      if (!def || targetSize <= labDecor.houseSize) return;
      if (!standaloneMode && onSpendCoinsForTreat && def.costSparks > 0) {
        if (!onSpendCoinsForTreat(def.costSparks)) {
          setFeedback(`Need ${def.costSparks} sparks to expand to ${def.title} (${def.footprintLabel}).`);
          return;
        }
      }
      const saved = saveLabDecor(activeVessel.tokenId, { ...labDecor, houseSize: targetSize });
      setLabDecor(saved);
      soundEngine.playBuildRoom();
      setCharacterEmote((prev) => ({ emote: "spin", seq: (prev?.seq || 0) + 1 }));
      triggerPlayerMoodlet("Inspired", `${def.title}!`, "Home Expansion");
      setFeedback(`Expanded home to ${def.title} (${def.footprintLabel})!`);
      completeGuideStep("furnish");
    },
    [isVisiting, labDecor, standaloneMode, onSpendCoinsForTreat, activeVessel.tokenId, triggerPlayerMoodlet, completeGuideStep]
  );

  const handleAddHouseFloor = useCallback(
    (targetFloors: HouseFloorCount) => {
      if (isVisiting) {
        setFeedback("Return to your own Home Lab to add upper floors!");
        return;
      }
      const def = HOUSE_FLOOR_DEFS.find((f) => f.floors === targetFloors);
      if (!def || targetFloors <= labDecor.houseFloors) return;
      if (!standaloneMode && onSpendCoinsForTreat && def.costSparks > 0) {
        if (!onSpendCoinsForTreat(def.costSparks)) {
          setFeedback(`Need ${def.costSparks} sparks to build ${def.title}.`);
          return;
        }
      }
      const saved = saveLabDecor(activeVessel.tokenId, { ...labDecor, houseFloors: targetFloors });
      setLabDecor(saved);
      soundEngine.playBuildRoom();
      setActiveFloor(targetFloors);
      window.setTimeout(() => artworkRef.current?.setActiveFloor(targetFloors), 80);
      triggerPlayerMoodlet("Inspired", `${def.floors}F Sky Floor Built!`, "Home Architect");
      setFeedback(`Built ${def.title}! Use the 1F/2F/3F switcher or click the spiral staircase.`);
      completeGuideStep("furnish");
    },
    [isVisiting, labDecor, standaloneMode, onSpendCoinsForTreat, activeVessel.tokenId, triggerPlayerMoodlet, completeGuideStep]
  );

  const handleUnlockExtraRoom = useCallback(
    (roomId: ExtraRoomId) => {
      if (isVisiting) {
        setFeedback("Return to your own Home Lab to build cozy interior rooms!");
        return;
      }
      const def = EXTRA_ROOM_DEFS.find((r) => r.id === roomId);
      if (!def || labDecor.extraRooms.includes(roomId)) return;
      if (!standaloneMode && onSpendCoinsForTreat && def.costSparks > 0) {
        if (!onSpendCoinsForTreat(def.costSparks)) {
          setFeedback(`Need ${def.costSparks} sparks to build ${def.name}.`);
          return;
        }
      }
      const saved = saveLabDecor(activeVessel.tokenId, {
        ...labDecor,
        extraRooms: [...labDecor.extraRooms, roomId]
      });
      setLabDecor(saved);
      soundEngine.playBuildRoom();
      setCharacterEmote((prev) => ({ emote: "hop", seq: (prev?.seq || 0) + 1 }));
      triggerPlayerMoodlet("Inspired", `${def.name} Added!`, "Cozy Home");
      setFeedback(`Added ${def.name} to your home — click it in 3D for cozy Sims actions!`);
      completeGuideStep("furnish");
    },
    [isVisiting, labDecor, standaloneMode, onSpendCoinsForTreat, activeVessel.tokenId, triggerPlayerMoodlet, completeGuideStep]
  );

  const startMovingItem = useCallback(
    (itemId: MovableItemId) => {
      if (isVisiting) {
        setFeedback("Return to your own Home Lab to rearrange stations & furniture!");
        return;
      }
      const meta = MOVABLE_ITEMS.find((m) => m.id === itemId);
      const cur = resolveItemPlacement(itemId, labDecor.customLayout);
      const minFloor: FloorNumber = labDecor.hasBasement ? 0 : 1;
      const targetFloor = Math.max(minFloor, Math.min(labDecor.houseFloors, cur.floor)) as FloorNumber;
      setPieMenu(null);
      setOpenStation(null);
      setNeighborhoodDrawerOpen(false);
      setActiveFloor(targetFloor);
      setMovingItem(itemId);
      setCameraMode("orbit");
      soundEngine.playTap(1046.5);
      setFeedback(
        `Move Mode: click anywhere on ${formatFloorLabel(targetFloor)} to place ${meta?.label || itemId}. Switch floors (B1–${labDecor.houseFloors}F) or rotate anytime!`
      );
    },
    [isVisiting, labDecor.customLayout, labDecor.hasBasement, labDecor.houseFloors]
  );

  const handlePlaceMovedItem = useCallback(
    (itemId: MovableItemId, x: number, z: number, floor: FloorNumber) => {
      const cur = resolveItemPlacement(itemId, labDecor.customLayout);
      const next = moveItemInDecor(labDecor, itemId, x, z, cur.yaw, floor);
      updateLabDecor(next);
      const meta = MOVABLE_ITEMS.find((m) => m.id === itemId);
      setFeedback(
        `Moved ${meta?.label || itemId} to ${formatFloorLabel(floor)} (${x.toFixed(1)}, ${z.toFixed(1)})!`
      );
    },
    [labDecor, updateLabDecor]
  );

  const handleRotateMovedItem = useCallback(
    (itemId: MovableItemId) => {
      const cur = resolveItemPlacement(itemId, labDecor.customLayout);
      const nextYaw = Number((((cur.yaw + Math.PI / 4) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2));
      const next = moveItemInDecor(labDecor, itemId, cur.x, cur.z, nextYaw, cur.floor);
      updateLabDecor(next);
      const meta = MOVABLE_ITEMS.find((m) => m.id === itemId);
      setFeedback(`Rotated ${meta?.label || itemId} by 45°!`);
    },
    [labDecor, updateLabDecor]
  );

  const handleResetItemLayout = useCallback(
    (itemId: MovableItemId) => {
      const nextLayout = { ...labDecor.customLayout };
      delete nextLayout[itemId];
      updateLabDecor({ ...labDecor, customLayout: nextLayout });
      const meta = MOVABLE_ITEMS.find((m) => m.id === itemId);
      setFeedback(`Reset ${meta?.label || itemId} to its spacious default spot.`);
    },
    [labDecor, updateLabDecor]
  );

  const handleResetAllLayout = useCallback(() => {
    updateLabDecor({ ...labDecor, customLayout: {} });
    soundEngine.playBuildRoom();
    setFeedback("Reset all 9 stations & furniture pieces to their spacious default layout!");
  }, [labDecor, updateLabDecor]);

  // ============================================================================
  // Botanical Town Parks, Home Courtyard Gardens & Community Conservatory Beds!
  // ============================================================================
  const readyGardenCount = useMemo(
    () =>
      GARDEN_PLOT_DEFS.filter((d) => computePlotGrowth(gardenState.plots[d.id], nowTick).readyToHarvest)
        .length,
    [gardenState, nowTick]
  );

  const handlePlantSeed = useCallback(
    (plotId: string, speciesId: PlantSpeciesId) => {
      const next = saveGardenState(
        activeVessel.tokenId,
        plantSeedInPlot(gardenState, plotId, speciesId, Date.now())
      );
      setGardenState(next);
      artworkRef.current?.waterGardenPlotFX(plotId);
      soundEngine.playTap(1046.5);
      setCharacterEmote((prev) => ({ emote: "hop", seq: (prev?.seq || 0) + 1 }));
      const sp = PLANT_SPECIES_BY_ID[speciesId];
      setSimsVibes((v) => applySimsVibeDelta(v, { focus: 6, fun: 8 }));
      setFeedback(`Planted ${sp.name}! Water it anytime to speed up bloom (${sp.growSeconds}s).`);
    },
    [activeVessel.tokenId, gardenState]
  );

  const handleWaterPlot = useCallback(
    (plotId: string) => {
      const res = waterGardenPlot(gardenState, plotId, Date.now());
      const saved = saveGardenState(activeVessel.tokenId, res.nextState);
      setGardenState(saved);
      artworkRef.current?.waterGardenPlotFX(plotId);
      soundEngine.playTap(1174.66);
      setSimsVibes((v) => applySimsVibeDelta(v, { focus: 8, energy: 4 }));
      triggerPlayerMoodlet("Relaxed", "Garden Watering", "Botanical Bed");
      setFeedback(
        res.boosted
          ? "Watered plant! +36% growth speed boost with sparkling dew."
          : "Admired your blooming flowers — ready to harvest!"
      );
    },
    [activeVessel.tokenId, gardenState, triggerPlayerMoodlet]
  );

  const handleFertilizePlot = useCallback(
    (plotId: string) => {
      const saved = saveGardenState(
        activeVessel.tokenId,
        fertilizeGardenPlot(gardenState, plotId, Date.now())
      );
      setGardenState(saved);
      artworkRef.current?.waterGardenPlotFX(plotId);
      soundEngine.playBuildRoom();
      setFeedback("Applied botanical crystal mist — instant full radiant bloom!");
    },
    [activeVessel.tokenId, gardenState]
  );

  const handleHarvestPlot = useCallback(
    (plotId: string) => {
      const res = harvestGardenPlot(gardenState, plotId, Date.now());
      if (!res.harvested) return;
      const saved = saveGardenState(activeVessel.tokenId, res.nextState);
      setGardenState(saved);
      artworkRef.current?.waterGardenPlotFX(plotId);
      soundEngine.playBuildRoom();
      onAwardPlayBonus?.(res.sparksEarned);
      setSimsVibes((v) => applySimsVibeDelta(v, res.harvested!.vibeDelta));
      setCharacterEmote((prev) => ({ emote: "spin", seq: (prev?.seq || 0) + 1 }));
      triggerPlayerMoodlet("Inspired", `Harvested ${res.harvested.name}!`, "Botanical Garden");
      setFeedback(
        `Harvested ${res.harvested.name}! ${res.harvested.moodPerk}${
          onAwardPlayBonus ? ` · +${res.sparksEarned} sparks` : ""
        }!`
      );
    },
    [activeVessel.tokenId, gardenState, onAwardPlayBonus, triggerPlayerMoodlet]
  );

  const handleWaterAllPlots = useCallback(() => {
    let cur = gardenState;
    let count = 0;
    const now = Date.now();
    for (const def of GARDEN_PLOT_DEFS) {
      const res = waterGardenPlot(cur, def.id, now);
      if (res.boosted) {
        cur = res.nextState;
        count++;
        artworkRef.current?.waterGardenPlotFX(def.id);
      }
    }
    if (count === 0) {
      setFeedback("All planted beds are already blooming! Plant a new seed or harvest ready blooms.");
      return;
    }
    setGardenState(saveGardenState(activeVessel.tokenId, cur));
    soundEngine.playBuildRoom();
    setSimsVibes((v) => applySimsVibeDelta(v, { focus: 12, energy: 8 }));
    setFeedback(`Watered ${count} garden ${count === 1 ? "bed" : "beds"} across your home & park!`);
  }, [activeVessel.tokenId, gardenState]);

  const handleHarvestAllPlots = useCallback(() => {
    let cur = gardenState;
    let totalSparks = 0;
    let harvestedCount = 0;
    const now = Date.now();
    for (const def of GARDEN_PLOT_DEFS) {
      const res = harvestGardenPlot(cur, def.id, now);
      if (res.harvested) {
        cur = res.nextState;
        totalSparks += res.sparksEarned;
        harvestedCount++;
        artworkRef.current?.waterGardenPlotFX(def.id);
      }
    }
    if (harvestedCount === 0) {
      setFeedback("No blooms ready to harvest yet — water your plants to speed them up!");
      return;
    }
    setGardenState(saveGardenState(activeVessel.tokenId, cur));
    onAwardPlayBonus?.(totalSparks);
    soundEngine.playBuildRoom();
    setCharacterEmote((prev) => ({ emote: "spin", seq: (prev?.seq || 0) + 1 }));
    setSimsVibes((v) => applySimsVibeDelta(v, { energy: 16, focus: 16, fun: 16 }));
    triggerPlayerMoodlet("Inspired", "Grand Botanical Harvest!", "Alchemia Gardens");
    setFeedback(
      `Harvested ${harvestedCount} blooming ${harvestedCount === 1 ? "bed" : "beds"}${
        onAwardPlayBonus ? ` · +${totalSparks} sparks` : ""
      }!`
    );
  }, [activeVessel.tokenId, gardenState, onAwardPlayBonus, triggerPlayerMoodlet]);

  const handleWalkToPark = useCallback((parkId: string) => {
    const park = TOWN_PARKS.find((p) => p.id === parkId) || TOWN_PARKS[0];
    if (!park) return;
    setPieMenu(null);
    setOpenStation(null);
    setNeighborhoodDrawerOpen(false);
    setActiveFloor(1);
    setCameraMode("follow");
    setCurrentActivity(`Strolling to ${park.name}`);
    artworkRef.current?.walkToPark(park.id);
    soundEngine.playTap(1046.5);
    setFeedback(`Walking down the paved boulevard to ${park.name}!`);
  }, []);

  let pendingCoins: number;
  if (
    activeVessel.onChain &&
    typeof activeVessel.onChainPendingCoins === "number" &&
    typeof activeVessel.syncedAtMs === "number"
  ) {
    const sinceSyncHours = Math.max(0, (nowTick - activeVessel.syncedAtMs) / 3600000);
    const rate = activeVessel.onChainMiningRate ?? baseRate;
    pendingCoins = Number((activeVessel.onChainPendingCoins + rate * sinceSyncHours).toFixed(4));
  } else {
    const elapsedHours = Math.max(0, (nowTick - activeVessel.lastClaimMs) / 3600000);
    pendingCoins = Number((effectiveMiningRate * Math.max(0.05, elapsedHours * 6)).toFixed(2));
  }

  const defaultPetLabel =
    tier >= 4 || hasSector(activeVessel.sectorsMask, 3) ? "Cat & Dog" : traits.familiar.name;
  const petDisplayName = vitals.petName || defaultPetLabel;
  const petMoodScore = Math.round((vitals.energy + vitals.mood + vitals.curiosity) / 3);

  const structuralStats = useMemo(() => {
    const coords = liveSnap?.bestResidues?.length ? liveSnap.bestResidues : liveSnap?.residues || [];
    if (coords.length < 4 || !liveSnap) return null;
    return {
      ss: assignSecondaryStructurePSEA(coords),
      contacts: computeContactMap(coords),
      nativeQ: computeNativeContactFractionQ(liveSnap.pdbBenchmarkId, coords),
      geometry: computeStructureGeometryQuality(coords)
    };
  }, [liveSnap]);

  const effectiveGoals: Record<GoalKey, boolean> = {
    ...goals,
    room: goals.room || builtCount >= 1
  };
  const goalsDoneCount = Object.values(effectiveGoals).filter(Boolean).length;

  const badges = [
    { label: "First Room", earned: builtCount >= 1 },
    { label: "Pet Keeper", earned: vitals.careStreak >= 3 },
    { label: "Protein Folder", earned: vessel.workUnits >= 5 },
    { label: "Coin Sharer", earned: totalCoinsDonatedToResearch > 0 },
    { label: "Full Campus", earned: builtCount === 6 }
  ];

  // Tamagotchi / Studio action handlers
  const handleTamagotchi = (action: TamagotchiAction) => {
    if (action === "feed" && onSpendCoinsForTreat) {
      const ok = onSpendCoinsForTreat(5);
      if (!ok) {
        setFeedback("You need 5 sparks for treats. Tap your pet or pop floating protons in 3D.");
        return;
      }
      setFeedback("Treats dropped on the patio. Watch your pet trot over.");
    } else if (action === "feed") {
      setFeedback("Treats dropped on the patio.");
    } else if (action === "pet") {
      onAwardPlayBonus?.(1);
      markGoalDone("pet");
      setFeedback(`${petDisplayName} loved that.${onAwardPlayBonus ? " +1 spark." : ""}`);
    } else {
      onAwardPlayBonus?.(2);
      markGoalDone("pet");
      setFeedback(`Tossed a glowing ball onto the patio.${onAwardPlayBonus ? " +2 sparks." : ""}`);
    }
    const next = applyTamagotchiAction(vitals, action);
    setVitals(next);
    saveCompanionVitals(activeVessel.tokenId, next);
    setTamaSignal((prev) => ({ action, seq: (prev?.seq || 0) + 1 }));
    setCharacterEmote((prev) => ({ emote: "wave", seq: (prev?.seq || 0) + 1 }));
    completeGuideStep("pet");
  };

  const handleSavePetName = () => {
    const next = setCompanionPetName(vitals, petNameDraft);
    setVitals(next);
    saveCompanionVitals(activeVessel.tokenId, next);
    setEditingPetName(false);
    soundEngine.playTap(1046.5);
  };

  const handleToggleSleep = () => {
    const next = toggleCompanionSleep(vitals);
    setVitals(next);
    saveCompanionVitals(activeVessel.tokenId, next);
    soundEngine.playTap(next.sleeping ? 523.25 : 987.77);
    setFeedback(
      next.sleeping
        ? `${petDisplayName} curled up for a nap. Care bars pause while resting.`
        : `${petDisplayName} woke up refreshed and ready to help.`
    );
  };

  const handleCycleStyle = () => {
    const next = cycleCompanionAccessory(vitals);
    setVitals(next);
    saveCompanionVitals(activeVessel.tokenId, next);
    soundEngine.playTap(1174.66);
    setFeedback(`Switched ${petDisplayName}'s hat to ${PET_ACCESSORY_LABELS[next.accessory]}.`);
  };

  const applyPetWardrobe = (next: CompanionVitals, toastMsg: string) => {
    setVitals(next);
    saveCompanionVitals(activeVessel.tokenId, next);
    setTamaSignal((prev) => ({ action: "pet", seq: (prev?.seq || 0) + 1 }));
    soundEngine.playTap(1174.66);
    setFeedback(toastMsg);
    completeGuideStep("pet");
  };

  const handleTriggerGuideAction = (stepId: OnboardingStepId) => {
    if (!savedProfile) {
      openCharacterCreator();
      return;
    }
    if (stepId === "walk") {
      setOpenStation(null);
      setNeighborhoodDrawerOpen(false);
      setCameraMode("follow");
      artworkRef.current?.walkToStation("research");
      completeGuideStep("walk");
    } else if (stepId === "pet") {
      setPetSubTab("boutique");
      navigateToStation("pet");
      setCameraMode("orbit");
      setCamPreset((prev) => ({ preset: "pet", seq: (prev?.seq || 0) + 1 }));
    } else if (stepId === "furnish") {
      setBuilderSubTab("furnish");
      navigateToStation("builder");
    } else if (stepId === "town") {
      setOpenStation(null);
      setNeighborhoodDrawerOpen(true);
      setCameraMode("neighborhood");
      completeGuideStep("town");
    } else if (stepId === "mood") {
      setNeighborhoodDrawerOpen(false);
      setConsoleSubTab("sims");
      setOpenStation("console");
    }
    soundEngine.playTap(1046.5);
  };

  // Complete Sims-Style Contextual Radial Pie Action Handler
  const handleSimsPieAction = (actionId: string, target: SimsObjectTarget) => {
    if (!savedProfile) {
      openCharacterCreator();
      return;
    }

    switch (actionId) {
      case "pet-cuddle":
        handleTamagotchi("pet");
        setSimsVibes((v) => applySimsVibeDelta(v, { social: 14, energy: 4 }));
        setCurrentActivity(`Cuddling ${petDisplayName}`);
        break;
      case "pet-feed":
        handleTamagotchi("feed");
        setSimsVibes((v) => applySimsVibeDelta(v, { social: 10 }));
        setCurrentActivity(`Feeding ${petDisplayName}`);
        break;
      case "pet-play":
        handleTamagotchi("play");
        setSimsVibes((v) => applySimsVibeDelta(v, { social: 16, energy: -4 }));
        setCurrentActivity(`Playing fetch with ${petDisplayName}`);
        break;
      case "pet-nap":
        handleToggleSleep();
        break;
      case "pet-style":
        setPetSubTab("boutique");
        navigateToStation("pet");
        setCameraMode("orbit");
        setCamPreset((prev) => ({ preset: "pet", seq: (prev?.seq || 0) + 1 }));
        break;
      case "open-pet":
        navigateToStation("pet");
        break;

      case "fold-wiggle":
        setFoldSignal((prev) => ({ action: "wiggle", seq: (prev?.seq || 0) + 1 }));
        onAwardPlayBonus?.(1);
        markGoalDone("fold");
        setSimsVibes((v) => applySimsVibeDelta(v, { focus: 16 }));
        setCharacterEmote((prev) => ({ emote: "hop", seq: (prev?.seq || 0) + 1 }));
        setFeedback("Wiggled live protein backbone to lower folding energy.");
        break;
      case "fold-shake":
        setFoldSignal((prev) => ({ action: "shake", seq: (prev?.seq || 0) + 1 }));
        onAwardPlayBonus?.(1);
        markGoalDone("fold");
        setSimsVibes((v) => applySimsVibeDelta(v, { focus: 14 }));
        setFeedback("Shook protein chain to explore a fresh conformation.");
        break;
      case "fold-bury":
        setFoldSignal((prev) => ({ action: "bury", seq: (prev?.seq || 0) + 1 }));
        onAwardPlayBonus?.(1);
        markGoalDone("fold");
        setSimsVibes((v) => applySimsVibeDelta(v, { focus: 18 }));
        setFeedback("Pulled hydrophobic residues inward into the folded core.");
        break;
      case "flask-pulse":
        artworkRef.current?.triggerCatalyticPulse(1.25);
        soundEngine.playBuildRoom();
        setSimsVibes((v) => applySimsVibeDelta(v, { focus: 10, energy: 8 }));
        setFeedback("Triggered a radiant catalytic pulse across the borosilicate vessel!");
        break;
      case "open-research":
        navigateToStation("research");
        break;

      case "bench-sit": {
        const a = artworkRef.current?.getSimsFurnitureAnchor("bench") ?? {
          x: -2.12,
          z: 1.02,
          yaw: 1.2,
          floor: 1 as FloorNumber
        };
        const energyGain = Math.round(24 * stationBonuses.energyFunMult);
        setCameraMode("follow");
        setActiveFloor(a.floor);
        setCurrentActivity("Relaxing in Comfort Lounge");
        artworkRef.current?.performSimsAction({
          x: a.x,
          z: a.z,
          floor: a.floor,
          yaw: a.yaw,
          posture: "sit",
          bubble: "sparkle",
          burstColor: "#10b981",
          onArrive: () => {
            setSimsVibes((v) => applySimsVibeDelta(v, { energy: energyGain, focus: 8 }));
            triggerPlayerMoodlet("Relaxed", "Cozy Lounge Rest", target.label);
            soundEngine.playTap(1046.5);
            setFeedback(`Relaxing at ${target.label} — +${energyGain} Energy!`);
          }
        });
        break;
      }
      case "bench-meditate": {
        const a = artworkRef.current?.getSimsFurnitureAnchor("bench") ?? {
          x: -2.12,
          z: 1.02,
          yaw: 1.2,
          floor: 1 as FloorNumber
        };
        const focusGain = Math.round(22 * stationBonuses.focusMult);
        setCameraMode("follow");
        setActiveFloor(a.floor);
        setCurrentActivity("Stargazing & Visualizing Folds");
        artworkRef.current?.performSimsAction({
          x: a.x,
          z: a.z,
          floor: a.floor,
          yaw: a.yaw,
          posture: "sit",
          bubble: "idea",
          burstColor: "#38bdf8",
          onArrive: () => {
            setSimsVibes((v) => applySimsVibeDelta(v, { focus: focusGain, energy: 10 }));
            triggerPlayerMoodlet("Focused", "Stargaze Clarity", target.label);
            soundEngine.playTap(1174.66);
            setFeedback(`Deep focus reflection at ${target.label} — +${focusGain} Focus!`);
          }
        });
        break;
      }
      case "open-builder":
        setBuilderSubTab("furnish");
        navigateToStation("builder");
        break;
      case "open-expand":
        setBuilderSubTab("expand");
        navigateToStation("builder");
        break;
      case "open-upgrades":
        setBuilderSubTab("upgrades");
        navigateToStation("builder");
        break;
      case "move-seating":
        startMovingItem("seating");
        break;
      case "move-bar":
        startMovingItem("bar");
        break;
      case "move-research":
        startMovingItem("research");
        break;
      case "move-mining":
        startMovingItem("mining");
        break;
      case "move-hobby":
        startMovingItem("hobby");
        break;
      case "floor-up":
        handleSwitchFloor(Math.min(labDecor.houseFloors, activeFloor + 1) as FloorNumber);
        break;
      case "floor-down": {
        const minF: FloorNumber = labDecor.hasBasement ? 0 : 1;
        handleSwitchFloor(Math.max(minF, activeFloor - 1) as FloorNumber);
        break;
      }
      case "room-nap":
      case "room-cook":
      case "room-soak":
      case "room-fire":
      case "room-garden":
      case "room-piano": {
        const roomId: ExtraRoomId =
          actionId === "room-nap"
            ? "bedroom"
            : actionId === "room-cook"
              ? "kitchen"
              : actionId === "room-soak"
                ? "spa"
                : actionId === "room-fire"
                  ? "hearth"
                  : actionId === "room-garden"
                    ? "pergola"
                    : "music";
        const roomDef = EXTRA_ROOM_DEFS.find((r) => r.id === roomId);
        const rx = roomDef?.standX ?? target.worldX;
        const rz = roomDef?.standZ ?? target.worldZ;
        setCameraMode("follow");
        setActiveFloor(1);
        const cfg =
          roomId === "bedroom"
            ? {
                activity: "Power Napping in Cozy Bedroom",
                posture: "sit" as const,
                mood: "Relaxed" as SimsMoodName,
                moodlet: "Rested & Cozy",
                bubble: "zzz" as const,
                color: "#a78bfa",
                delta: { energy: 35, focus: 10 },
                msg: "Took a rejuvenating nap under the canopy bed — +35 Energy!"
              }
            : roomId === "kitchen"
              ? {
                  activity: "Cooking a Warm Lab Meal",
                  posture: "brew" as const,
                  mood: "Energized" as SimsMoodName,
                  moodlet: "Home-Cooked Feast",
                  bubble: "coffee" as const,
                  color: "#f59e0b",
                  delta: { energy: 25, social: 15, fun: 10 },
                  msg: "Prepared a warm artisan meal in your kitchenette — +25 Energy & +15 Social!"
                }
              : roomId === "spa"
                ? {
                    activity: "Soaking in Cedar Onsen Spa",
                    posture: "sit" as const,
                    mood: "Relaxed" as SimsMoodName,
                    moodlet: "Onsen Serenity",
                    bubble: "sparkle" as const,
                    color: "#38bdf8",
                    delta: { energy: 30, fun: 15 },
                    msg: "Soaked in warm sakura-scented spring water — feeling deeply Relaxed!"
                  }
                : roomId === "hearth"
                  ? {
                      activity: "Warming by the Glass Hearth",
                      posture: "sit" as const,
                      mood: "Relaxed" as SimsMoodName,
                      moodlet: "Fireside Glow",
                      bubble: "heart" as const,
                      color: "#fb7185",
                      delta: { fun: 25, energy: 14 },
                      msg: "Cozying up beside your glowing glass fireplace — +25 Fun!"
                    }
                  : roomId === "pergola"
                    ? {
                        activity: "Tending Wisteria Garden",
                        posture: "stand" as const,
                        mood: "Inspired" as SimsMoodName,
                        moodlet: "Botanical Bloom",
                        bubble: "sparkle" as const,
                        color: "#10b981",
                        delta: { focus: 20, energy: 12 },
                        msg: "Strolled beneath the blooming wisteria pergola — feeling Inspired!"
                      }
                    : {
                        activity: "Playing Grand Piano Sonata",
                        posture: "analyze" as const,
                        mood: "Playful" as SimsMoodName,
                        moodlet: "Melodic Flow",
                        bubble: "sparkle" as const,
                        color: "#f472b6",
                        delta: { fun: 30, social: 12 },
                        msg: "Played a sparkling sonata on your grand piano — +30 Fun!"
                      };
        setCurrentActivity(cfg.activity);
        artworkRef.current?.performSimsAction({
          x: rx,
          z: rz,
          floor: 1,
          yaw: roomDef?.yaw ?? 0,
          posture: cfg.posture,
          emote: roomId === "music" || roomId === "pergola" ? "hop" : undefined,
          bubble: cfg.bubble,
          burstColor: cfg.color,
          onArrive: () => {
            setSimsVibes((v) => applySimsVibeDelta(v, cfg.delta));
            triggerPlayerMoodlet(cfg.mood, cfg.moodlet, roomDef?.name || target.label);
            soundEngine.playBuildRoom();
            setFeedback(cfg.msg);
          }
        });
        break;
      }

      case "espresso-brew": {
        const a = artworkRef.current?.getSimsFurnitureAnchor("espresso") ?? {
          x: -1.26,
          z: -2.02,
          yaw: -2.45,
          floor: 1 as FloorNumber
        };
        const energyGain = Math.round(28 * stationBonuses.energyFunMult);
        setCameraMode("follow");
        setActiveFloor(a.floor);
        setCurrentActivity(`Brewing at ${target.label}`);
        artworkRef.current?.performSimsAction({
          x: a.x,
          z: a.z,
          floor: a.floor,
          yaw: a.yaw,
          posture: "brew",
          bubble: "coffee",
          burstColor: "#f59e0b",
          onArrive: () => {
            setSimsVibes((v) => applySimsVibeDelta(v, { energy: energyGain, focus: 12 }));
            triggerPlayerMoodlet("Energized", "Fresh Elixir Boost", target.label);
            soundEngine.playBuildRoom();
            setFeedback(`Fresh elixir crafted at ${target.label}! +${energyGain} Energy & +12 Focus.`);
          }
        });
        break;
      }
      case "espresso-share": {
        const a = artworkRef.current?.getSimsFurnitureAnchor("espresso") ?? {
          x: -1.26,
          z: -2.02,
          yaw: -2.45,
          floor: 1 as FloorNumber
        };
        const funGain = Math.round(12 * stationBonuses.energyFunMult);
        setCameraMode("follow");
        setActiveFloor(a.floor);
        setCurrentActivity("Toasting Open Science");
        artworkRef.current?.performSimsAction({
          x: a.x,
          z: a.z,
          floor: a.floor,
          yaw: a.yaw,
          posture: "brew",
          emote: "wave",
          bubble: "heart",
          burstColor: "#f472b6",
          onArrive: () => {
            setSimsVibes((v) => applySimsVibeDelta(v, { social: 20, energy: 12, fun: funGain }));
            triggerPlayerMoodlet("Social", "Elixir Toast", target.label);
            soundEngine.playPet();
            setFeedback(`Raised an elixir toast at ${target.label}! +20 Social & +${funGain} Fun.`);
          }
        });
        break;
      }
      case "open-console":
        navigateToStation("console");
        break;

      case "micro-analyze": {
        const a = artworkRef.current?.getSimsFurnitureAnchor("microscope") ?? {
          x: -2.06,
          z: -1.14,
          yaw: -1.65,
          floor: 1 as FloorNumber
        };
        const focusGain = Math.round(24 * stationBonuses.focusMult);
        const sparkGain = 1 + stationBonuses.extraFoldSpark;
        setCameraMode("follow");
        setActiveFloor(a.floor);
        setCurrentActivity("Analyzing Protein Fold");
        artworkRef.current?.performSimsAction({
          x: a.x,
          z: a.z,
          floor: a.floor,
          yaw: a.yaw,
          posture: "analyze",
          bubble: "dna",
          burstColor: "#38bdf8",
          onArrive: () => {
            setFoldSignal((prev) => ({ action: "wiggle", seq: (prev?.seq || 0) + 1 }));
            markGoalDone("fold");
            onAwardPlayBonus?.(sparkGain);
            setSimsVibes((v) => applySimsVibeDelta(v, { focus: focusGain, energy: -4 }));
            triggerPlayerMoodlet("Focused", "Microscope Precision", target.label);
            setFeedback(
              `Refined live protein fold at ${target.label}! +${focusGain} Focus${
                onAwardPlayBonus ? ` · +${sparkGain} sparks` : ""
              }.`
            );
          }
        });
        break;
      }

      case "hobby-read":
      case "hobby-watch":
      case "hobby-music":
      case "hobby-paint":
      case "hobby-arcade":
      case "hobby-vibe": {
        const a = artworkRef.current?.getSimsFurnitureAnchor("hobby") ?? {
          x: 2.22,
          z: -2.08,
          yaw: 0.65,
          floor: 1 as FloorNumber
        };
        const funBoost = Math.round(20 * stationBonuses.energyFunMult);
        const focusBoost = Math.round(18 * stationBonuses.focusMult);
        const config =
          actionId === "hobby-read"
            ? {
                activity: "Reading Alchemy Tomes",
                mood: "Focused" as SimsMoodName,
                moodlet: "Bookworm Spark",
                bubble: "idea" as const,
                color: "#38bdf8",
                delta: { focus: focusBoost, fun: 8 },
                sparks: 1,
                msg: `Read rare folding journals at ${target.label} — +${focusBoost} Focus!`
              }
            : actionId === "hobby-watch"
              ? {
                  activity: "Watching Glowing Jellyfish",
                  mood: "Relaxed" as SimsMoodName,
                  moodlet: "Oceanic Calm",
                  bubble: "sparkle" as const,
                  color: "#34d399",
                  delta: { energy: Math.round(16 * stationBonuses.energyFunMult), fun: funBoost },
                  sparks: 1,
                  msg: `Drifted peacefully watching ${target.label} — feeling Relaxed!`
                }
              : actionId === "hobby-music"
                ? {
                    activity: "Spinning Hi-Fi Vinyl",
                    mood: "Playful" as SimsMoodName,
                    moodlet: "Groovy Beat",
                    bubble: "sparkle" as const,
                    color: "#818cf8",
                    delta: { fun: funBoost + 6, social: 10 },
                    sparks: 1,
                    msg: `Spun a crisp lo-fi vinyl record — +${funBoost + 6} Fun!`
                  }
                : actionId === "hobby-paint"
                  ? {
                      activity: "Painting Molecular Art",
                      mood: "Inspired" as SimsMoodName,
                      moodlet: "Artist Flow",
                      bubble: "heart" as const,
                      color: "#f472b6",
                      delta: { focus: focusBoost, fun: funBoost },
                      sparks: 1,
                      msg: `Painted a luminous helix canvas — feeling Inspired!`
                    }
                  : actionId === "hobby-arcade"
                    ? {
                        activity: "Playing Silver Mini Arcade",
                        mood: "Playful" as SimsMoodName,
                        moodlet: "High Score!",
                        bubble: "coin" as const,
                        color: "#10b981",
                        delta: { fun: funBoost + 10, energy: -2 },
                        sparks: 2,
                        msg: `Set a new high score on ${target.label}! +${funBoost + 10} Fun!`
                      }
                    : {
                        activity: `Admiring ${target.label}`,
                        mood: "Inspired" as SimsMoodName,
                        moodlet: "Cozy Home Pride",
                        bubble: "heart" as const,
                        color: "#a855f7",
                        delta: { fun: funBoost },
                        sparks: 0,
                        msg: `Your custom ${target.label} makes the lab feel truly like home!`
                      };

        setCameraMode("follow");
        setActiveFloor(a.floor);
        setCurrentActivity(config.activity);
        artworkRef.current?.performSimsAction({
          x: a.x,
          z: a.z,
          floor: a.floor,
          yaw: a.yaw,
          posture: actionId === "hobby-read" || actionId === "hobby-arcade" ? "analyze" : "stand",
          emote: actionId === "hobby-music" ? "spin" : "hop",
          bubble: config.bubble,
          burstColor: config.color,
          onArrive: () => {
            setSimsVibes((v) => applySimsVibeDelta(v, config.delta));
            triggerPlayerMoodlet(config.mood, config.moodlet, target.label);
            if (config.sparks > 0) onAwardPlayBonus?.(config.sparks);
            soundEngine.playBuildRoom();
            setFeedback(
              `${config.msg}${config.sparks > 0 && onAwardPlayBonus ? ` (+${config.sparks} sparks)` : ""}`
            );
          }
        });
        break;
      }

      case "mine-overclock": {
        const a = artworkRef.current?.getSimsFurnitureAnchor("harvester") ?? {
          x: 2.22,
          z: -0.36,
          yaw: 1.45,
          floor: 1 as FloorNumber
        };
        setCameraMode("follow");
        setActiveFloor(a.floor);
        setCurrentActivity("Spinning ALCH Harvester");
        artworkRef.current?.performSimsAction({
          x: a.x,
          z: a.z,
          floor: a.floor,
          yaw: a.yaw,
          posture: "analyze",
          bubble: "coin",
          burstColor: "#6366f1",
          onArrive: () => {
            artworkRef.current?.triggerCatalyticPulse(1.0);
            soundEngine.playProtonPop(4);
            setSimsVibes((v) => applySimsVibeDelta(v, { focus: 18, energy: -4 }));
            setFeedback("Overclocked the ALCH coin harvester console! +18 Focus.");
          }
        });
        break;
      }
      case "open-mining":
        navigateToStation("mining");
        break;

      case "open-moods":
        setNeighborhoodDrawerOpen(false);
        setConsoleSubTab("sims");
        setOpenStation("console");
        soundEngine.playTap(1046.5);
        break;
      case "emote-wave":
        setCharacterEmote((prev) => ({ emote: "wave", seq: (prev?.seq || 0) + 1 }));
        setSimsVibes((v) => applySimsVibeDelta(v, { social: 10, fun: 6 }));
        triggerPlayerMoodlet("Social", "Friendly Wave", "Self");
        soundEngine.playTap(1046.5);
        break;
      case "emote-spin":
        setCharacterEmote((prev) => ({ emote: "spin", seq: (prev?.seq || 0) + 1 }));
        setSimsVibes((v) => applySimsVibeDelta(v, { fun: 16, social: 10 }));
        triggerPlayerMoodlet("Playful", "Silly Twirl", "Self");
        soundEngine.playTap(1174.66);
        break;
      case "open-creator":
        openCharacterCreator();
        break;
      case "go-home":
        handleReturnHome();
        break;

      case "fountain-wish":
        setCameraMode("follow");
        setCurrentActivity("Making a Science Wish");
        artworkRef.current?.performSimsAction({
          x: COMMUNITY_FOUNTAIN_POS[0],
          z: COMMUNITY_FOUNTAIN_POS[1] - 1.9,
          yaw: 0,
          emote: "hop",
          bubble: "sparkle",
          burstColor: "#38bdf8",
          onArrive: () => {
            artworkRef.current?.triggerCatalyticPulse(1.2);
            onAwardPlayBonus?.(1);
            soundEngine.playBuildRoom();
            setSimsVibes((v) => applySimsVibeDelta(v, { focus: 14, social: 14 }));
            setFeedback(
              `Made a wish at the Community Research Fountain!${onAwardPlayBonus ? " +1 spark." : ""}`
            );
          }
        });
        break;
      case "fountain-pulse":
        setCameraMode("neighborhood");
        artworkRef.current?.triggerCatalyticPulse(1.3);
        soundEngine.playBuildRoom();
        ring1Placements.slice(0, 4).forEach((pl) => {
          artworkRef.current?.fireSocialBeamToNeighbor(pl.lab.tokenId, "#f59e0b");
        });
        setSimsVibes((v) => applySimsVibeDelta(v, { social: 22 }));
        setFeedback("Lit up optical conduits across the entire minted neighborhood!");
        break;
      case "open-neighborhood":
        setOpenStation(null);
        setNeighborhoodDrawerOpen(true);
        setCameraMode("neighborhood");
        break;

      case "neighbor-enter":
        if ("tokenId" in target) {
          const found =
            neighbors.find((n) => n.tokenId === target.tokenId) ||
            knownNeighborSummaries.find((n) => n.tokenId === target.tokenId);
          if (found) handleEnterNeighborHome(found);
        }
        break;
      case "neighbor-visit":
        if ("tokenId" in target) handleVisitNeighbor(target.tokenId);
        break;
      case "neighbor-spark":
        if ("tokenId" in target) handleSendNeighborSpark(target.tokenId);
        break;
      case "neighbor-chat":
      case "neighbor-wave":
        if ("tokenId" in target) {
          performNeighborSocial(target.tokenId, "chat", { fireBeam: target.kind === "neighbor-lab" });
        }
        break;
      case "neighbor-joke":
        if ("tokenId" in target) {
          performNeighborSocial(target.tokenId, "joke");
        }
        break;
      case "neighbor-inspect":
        if ("tokenId" in target) {
          const found = neighbors.find((n) => n.tokenId === target.tokenId) || null;
          setOpenStation(null);
          setInspectedNeighbor(found);
          setNeighborhoodDrawerOpen(true);
          soundEngine.playTap(1046.5);
        }
        break;

      case "host-chat":
      case "host-wave":
        if (visitingHome) performNeighborSocial(visitingHome.tokenId, "chat");
        break;
      case "host-joke":
        if (visitingHome) performNeighborSocial(visitingHome.tokenId, "joke");
        break;
      case "host-spark":
        if (visitingHome) {
          artworkRef.current?.triggerCatalyticPulse(1.2);
          performNeighborSocial(visitingHome.tokenId, "spark", { awardSparks: 2 });
        }
        break;
      case "host-fold":
        setFoldSignal((prev) => ({ action: "wiggle", seq: (prev?.seq || 0) + 1 }));
        markGoalDone("fold");
        if (visitingHome) {
          performNeighborSocial(visitingHome.tokenId, "collaborate", { awardSparks: 2 });
        }
        break;
      case "host-guestbook":
        setNeighborhoodDrawerOpen(false);
        setConsoleSubTab("studio");
        setOpenStation("console");
        setGuestbookOpen(true);
        soundEngine.playTap(1046.5);
        break;
      case "return-home":
        handleReturnHome();
        break;
      case "lot-preview-mint":
        handleSpawnNeighborMint(1);
        break;
      case "lot-mint-wave":
        handleSpawnNeighborMint(5);
        break;
      case "vehicle-wave":
        if (target.kind === "vehicle") {
          artworkRef.current?.triggerEmote("wave");
          artworkRef.current?.triggerVehicleHonk(target.vehicleId);
          soundEngine.playTap(1046.5);
          setSimsVibes((prev) => applySimsVibeDelta(prev, { social: 8, fun: 6 }));
          setFeedback(`Waved at the passing ${target.label}! (+Social)`);
        }
        break;
      case "vehicle-beep":
        if (target.kind === "vehicle") {
          artworkRef.current?.triggerVehicleHonk(target.vehicleId);
          soundEngine.playTap(659.25);
          window.setTimeout(() => soundEngine.playTap(880), 110);
          setSimsVibes((prev) => applySimsVibeDelta(prev, { fun: 12, social: 4 }));
          setFeedback(`Beep beep! ${target.label} honked back along the boulevard!`);
        }
        break;

      case "garden-plant-lavender":
      case "garden-plant-sunflower":
      case "garden-plant-sakura":
      case "garden-plant-orchid":
        if (target.kind === "garden-plot") {
          const sp = actionId.replace("garden-plant-", "") as PlantSpeciesId;
          setCameraMode("follow");
          setActiveFloor(1);
          setCurrentActivity(`Planting ${PLANT_SPECIES_BY_ID[sp].name}`);
          artworkRef.current?.performSimsAction({
            x: target.worldX,
            z: target.worldZ,
            floor: 1,
            emote: "hop",
            bubble: "flower",
            burstColor: PLANT_SPECIES_BY_ID[sp].petalHex,
            onArrive: () => handlePlantSeed(target.plotId, sp)
          });
        }
        break;
      case "garden-water":
        if (target.kind === "garden-plot") {
          setCameraMode("follow");
          setActiveFloor(1);
          setCurrentActivity("Watering Botanical Bed");
          artworkRef.current?.performSimsAction({
            x: target.worldX,
            z: target.worldZ,
            floor: 1,
            emote: "wave",
            bubble: "water",
            burstColor: "#38bdf8",
            onArrive: () => handleWaterPlot(target.plotId)
          });
        }
        break;
      case "garden-fertilize":
        if (target.kind === "garden-plot") {
          setCameraMode("follow");
          setActiveFloor(1);
          setCurrentActivity("Applying Crystal Mist");
          artworkRef.current?.performSimsAction({
            x: target.worldX,
            z: target.worldZ,
            floor: 1,
            emote: "spin",
            bubble: "sparkle",
            burstColor: "#a855f7",
            onArrive: () => handleFertilizePlot(target.plotId)
          });
        }
        break;
      case "garden-harvest":
        if (target.kind === "garden-plot") {
          setCameraMode("follow");
          setActiveFloor(1);
          setCurrentActivity("Harvesting Botanical Blooms");
          artworkRef.current?.performSimsAction({
            x: target.worldX,
            z: target.worldZ,
            floor: 1,
            emote: "spin",
            bubble: "flower",
            burstColor: "#10b981",
            onArrive: () => handleHarvestPlot(target.plotId)
          });
        }
        break;
      case "open-garden":
        setOpenStation(null);
        setTownSubTab("gardens");
        setNeighborhoodDrawerOpen(true);
        soundEngine.playTap(1046.5);
        break;
      case "park-smell-flowers":
        setCameraMode("follow");
        setActiveFloor(1);
        setCurrentActivity("Breathing Conservatory Mist");
        artworkRef.current?.performSimsAction({
          x: target.worldX,
          z: target.worldZ,
          floor: 1,
          emote: "wave",
          bubble: "flower",
          burstColor: "#10b981",
          onArrive: () => {
            setSimsVibes((v) => applySimsVibeDelta(v, { energy: 18, focus: 18 }));
            triggerPlayerMoodlet("Inspired", "Conservatory Mist", target.label);
            soundEngine.playBuildRoom();
            setFeedback(`Breathed fragrant botanical mist at ${target.label} — feeling Inspired!`);
          }
        });
        break;
      case "park-tend-community":
        setCameraMode("follow");
        setActiveFloor(1);
        setCurrentActivity("Tending Town Greenhouse");
        artworkRef.current?.performSimsAction({
          x: target.worldX,
          z: target.worldZ,
          floor: 1,
          posture: "analyze",
          bubble: "water",
          burstColor: "#38bdf8",
          onArrive: () => {
            onAwardPlayBonus?.(2);
            setSimsVibes((v) => applySimsVibeDelta(v, { focus: 16, social: 14 }));
            triggerPlayerMoodlet("Social", "Community Gardener", target.label);
            soundEngine.playBuildRoom();
            setFeedback(
              `Tended the town greenhouse plants!${onAwardPlayBonus ? " +2 sparks" : ""} · +14 Social.`
            );
          }
        });
        break;
      case "park-relax":
        setCameraMode("follow");
        setActiveFloor(1);
        setCurrentActivity(`Relaxing at ${target.label}`);
        artworkRef.current?.performSimsAction({
          x: target.worldX,
          z: target.worldZ,
          floor: 1,
          posture: "sit",
          bubble: "sparkle",
          burstColor: "#10b981",
          onArrive: () => {
            setSimsVibes((v) => applySimsVibeDelta(v, { energy: 26, focus: 12 }));
            triggerPlayerMoodlet("Relaxed", "Park Breeze", target.label);
            soundEngine.playTap(1046.5);
            setFeedback(`Relaxed on the park bench at ${target.label} — +26 Energy!`);
          }
        });
        break;
      case "park-picnic":
        setCameraMode("follow");
        setActiveFloor(1);
        setCurrentActivity(`Picnicking at ${target.label}`);
        artworkRef.current?.performSimsAction({
          x: target.worldX,
          z: target.worldZ,
          floor: 1,
          posture: "sit",
          emote: "wave",
          bubble: "flower",
          burstColor: "#f472b6",
          onArrive: () => {
            setSimsVibes((v) => applySimsVibeDelta(v, { fun: 22, social: 20, energy: 14 }));
            triggerPlayerMoodlet("Playful", "Botanical Picnic!", target.label);
            soundEngine.playBuildRoom();
            setFeedback(`Enjoyed a sunny picnic at ${target.label} — +22 Fun & +20 Social!`);
          }
        });
        break;
      case "park-feed-koi":
        setCameraMode("follow");
        setActiveFloor(1);
        setCurrentActivity("Feeding Park Koi Fish");
        artworkRef.current?.performSimsAction({
          x: target.worldX,
          z: target.worldZ,
          floor: 1,
          emote: "hop",
          bubble: "water",
          burstColor: "#fb923c",
          onArrive: () => {
            onAwardPlayBonus?.(1);
            setSimsVibes((v) => applySimsVibeDelta(v, { fun: 16, energy: 12 }));
            triggerPlayerMoodlet("Relaxed", "Koi Pond Zen", target.label);
            soundEngine.playTap(1174.66);
            setFeedback(
              `Fed the swimming golden koi fish!${onAwardPlayBonus ? " +1 spark" : ""} · feeling Relaxed.`
            );
          }
        });
        break;
    }
  };

  const cycleLighting = () => {
    const idx = (LIGHTING_ORDER.indexOf(lightingMood) + 1) % LIGHTING_ORDER.length;
    setLightingMood(LIGHTING_ORDER[idx]);
    soundEngine.playTap(987.77);
  };

  const cycleAtmosphere = () => {
    const idx = (ATMOSPHERE_ORDER.indexOf(atmosphereMode) + 1) % ATMOSPHERE_ORDER.length;
    setAtmosphereMode(ATMOSPHERE_ORDER[idx]);
    soundEngine.playTap(1046.5);
  };

  const handleSavePhoto = () => {
    const dataUrl = artworkRef.current?.capturePhoto();
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `alchemia-lab-${vessel.tokenId}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    soundEngine.playTap(1318.5);
    setFeedback(`Saved PNG photo of Lab #${vessel.tokenId}.`);
  };

  const bindTouchDir = (dx: number, dz: number) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      touchDirRef.current = { dx, dz };
      pushMoveInput();
    },
    onPointerUp: () => {
      touchDirRef.current = { dx: 0, dz: 0 };
      pushMoveInput();
    },
    onPointerLeave: () => {
      touchDirRef.current = { dx: 0, dz: 0 };
      pushMoveInput();
    },
    onPointerCancel: () => {
      touchDirRef.current = { dx: 0, dz: 0 };
      pushMoveInput();
    }
  });

  const enrichedImpact: LiveImpactState = {
    ...impact,
    tokenId: activeVessel.tokenId,
    seed: activeVessel.seed,
    causeId: activeVessel.causeId,
    causeName: activeVessel.causeName,
    tokenValueUsd: activeVessel.valueUsd,
    complexityTier: tier,
    sectorsMask: activeVessel.sectorsMask,
    tokenImpactEth: activeVessel.impactEth,
    petLevel: vitals.level,
    petMoodScore,
    petAccessory: vitals.accessory,
    petOutfit: vitals.outfit || "none",
    petBackGear: vitals.backGear || "none",
    petOutfitColor: vitals.outfitColor || "#f472b6",
    petSleeping: vitals.sleeping,
    workUnits: activeVessel.workUnits
  };

  // Pipe live data into the 5 physical frosted-glass 3D holographic monitors inside WebGL!
  useEffect(() => {
    const bench = PROTEIN_BENCHMARKS[liveSnap?.benchmarkIndex ?? 0];
    artworkRef.current?.updateMonitorTelemetry({
      pdbId: liveSnap?.pdbBenchmarkId || "1L2Y",
      taskShort: bench?.shortName || "Trp-cage",
      bestEnergy: liveSnap?.bestEnergy ?? -18.4,
      nativeQ: structuralStats?.nativeQ ?? 62,
      energyHistory: liveSnap?.energyHistory || [],
      computeActive: liveSnap?.active ?? true,
      pendingCoins,
      miningRatePerHour: effectiveMiningRate,
      petName: petDisplayName,
      petMood: companionMoodLabel(vitals),
      petFood: vitals.energy,
      petHappy: vitals.mood,
      petPlay: vitals.curiosity,
      petBoost: tamaBoost,
      sectorsMask: activeVessel.sectorsMask,
      tier,
      characterName: isVisiting
        ? `${visitingHostProfile?.name || "Host"}'s Lab`
        : (savedProfile || creatorDraft).name,
      characterTitle: isVisiting
        ? `Guest: ${(savedProfile || creatorDraft).name}`
        : (savedProfile || creatorDraft).title,
      characterAccent: isVisiting
        ? traits.palette.liquidMid
        : (savedProfile || creatorDraft).outfitAccent,
      goalsDone: goalsDoneCount
    });
  }, [
    liveSnap,
    structuralStats,
    pendingCoins,
    effectiveMiningRate,
    petDisplayName,
    vitals,
    tamaBoost,
    activeVessel.sectorsMask,
    tier,
    isVisiting,
    visitingHostProfile,
    traits.palette.liquidMid,
    savedProfile,
    creatorDraft,
    goalsDoneCount
  ]);

  return (
    <div
      ref={stageRef}
      className={`lab-world-card ${standaloneMode ? "is-standalone" : ""} ${
        isFullscreen ? "is-fullscreen" : ""
      }`}
      aria-label={`Interactive walkable 3D Lab #${vessel.tokenId}`}
    >
      {/* Layer 0: Full-bleed Interactive 3D Architectural Lab & Minted Neighborhood Canvas */}
      <ArtworkCanvas
        ref={artworkRef}
        fillContainer
        showHud={false}
        walkMode={walkModeActive}
        characterProfile={activeProfile}
        visitingHost={visitingHostProp}
        characterEmoteSignal={characterEmote}
        creatorCameraMode={creatorOpen}
        creatorFocusZone={creatorFocusZone}
        creatorTurntable={creatorTurntable}
        cameraMode={cameraMode}
        activeStationHighlight={openStation || nearStation}
        neighbors={neighbors}
        labDecor={labDecor}
        gardenState={gardenState}
        activeFloor={activeFloor}
        movingItem={movingItem}
        moveSnapGrid={moveSnapGrid}
        plumbobColor={simsMood.plumbobHex}
        playerMoodName={simsMood.name}
        controlsEnabled={!pieMenu}
        cameraPreset={camPreset}
        lightingMood={lightingMood}
        atmosphereMode={atmosphereMode}
        highlightedResidueIdx={highlightedResidueIdx}
        showBestFold={showBestFold}
        previewSectorId={previewSectorId}
        benchmarkIndex={selectedBenchmark}
        foldSignal={foldSignal}
        tamagotchiSignal={tamaSignal}
        onComputeSnapshot={setLiveSnap}
        onWalkTelemetry={handleWalkTelemetry}
        onNearStationChange={handleNearStationChange}
        onStationArrived={handleStationArrived}
        onPlaceMovedItem={handlePlaceMovedItem}
        onActiveFloorChange={(fl) => {
          setActiveFloor(fl);
          setCurrentActivity(`Walked to ${formatFloorLabel(fl)}`);
        }}
        onSimsObjectClick={(target, sx, sy) => {
          if (!savedProfile && !creatorOpen && creatorTriggerMode === "on-first-interaction") {
            openCharacterCreator();
            return;
          }
          setPieMenu({ target, x: sx, y: sy });
        }}
        onInteractiveEvent={(ev) => {
          if (!savedProfile && !creatorOpen && creatorTriggerMode === "on-first-interaction") {
            openCharacterCreator();
            return;
          }
          setPieMenu(null);
          if (ev.kind === "monitor-clicked" && ev.stationId) {
            manualPanelPinRef.current = true;
            setNeighborhoodDrawerOpen(false);
            setOpenStation(ev.stationId);
          } else if (ev.kind === "floor-walk") {
            setCurrentActivity(null);
            manualPanelPinRef.current = Boolean(ev.stationId);
            if (!ev.stationId) {
              setOpenStation(null);
              setPreviewSectorId(null);
            }
          } else if (ev.kind === "pet-clicked") {
            const next = applyTamagotchiAction(vitals, "pet");
            setVitals(next);
            saveCompanionVitals(vessel.tokenId, next);
            setSimsVibes((v) => applySimsVibeDelta(v, { social: 12 }));
            onAwardPlayBonus?.(ev.bonusCoins);
            markGoalDone("pet");
            setFeedback(
              `Petted ${petDisplayName} in 3D.${onAwardPlayBonus ? ` +${ev.bonusCoins} spark.` : ""}`
            );
          } else if (ev.kind === "room-clicked") {
            onAwardPlayBonus?.(ev.bonusCoins);
            setFeedback(
              `Walking to ${ev.roomName || "lab room"}.${
                onAwardPlayBonus ? ` +${ev.bonusCoins} spark.` : ""
              }`
            );
          } else if (ev.kind === "atom-popped") {
            onAwardPlayBonus?.(ev.bonusCoins);
            markGoalDone("proton");
            setSimsVibes((v) => applySimsVibeDelta(v, { focus: 6 }));
            setMiniGame((prev) => (prev ? { ...prev, popped: prev.popped + 1 } : null));
            setFeedback(
              ev.combo && ev.combo > 1
                ? `Proton combo x${ev.combo}.${onAwardPlayBonus ? ` +${ev.bonusCoins} sparks.` : ""}`
                : `Popped a floating proton.${onAwardPlayBonus ? ` +${ev.bonusCoins} sparks.` : ""}`
            );
          }
        }}
        impact={enrichedImpact}
      />

      {/* Layer 0.5: Sims-Style Contextual Radial Pie Action Menu */}
      {!creatorOpen && pieMenu && (
        <SimsPieMenu
          target={pieMenu.target}
          screenX={pieMenu.x}
          screenY={pieMenu.y}
          containerWidth={stageRef.current?.clientWidth || 960}
          containerHeight={stageRef.current?.clientHeight || 640}
          actions={getSimsPieActions(pieMenu.target, {
            petSleeping: vitals.sleeping,
            standalone: standaloneMode,
            currentFloor: activeFloor,
            maxFloors: labDecor.houseFloors,
            hasBasement: labDecor.hasBasement,
            gardenPlotStatus:
              pieMenu.target.kind === "garden-plot"
                ? (() => {
                    const g = computePlotGrowth(gardenState.plots[pieMenu.target.plotId], nowTick);
                    return g.stage === 0 ? "empty" : g.readyToHarvest ? "ready" : "growing";
                  })()
                : undefined
          })}
          onSelect={(actionId) => handleSimsPieAction(actionId, pieMenu.target)}
          onClose={() => setPieMenu(null)}
        />
      )}

      {/* Layer 1: 5 World-Anchored Decluttered Floating Glass Cards + Hairline SVG Leader Lines */}
      {walkModeActive && !creatorOpen && (
        <div className="world-floats-layer" aria-label="In-world lab station floating panels">
          <svg className="world-leaders-svg" aria-hidden="true">
            {LAB_STATIONS.map((st) => (
              <g key={st.id}>
                <line
                  ref={(node) => {
                    leaderLineRefs.current[st.id] = node;
                  }}
                  stroke={st.accent}
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                  style={{ opacity: 0 }}
                />
                <circle
                  ref={(node) => {
                    leaderDotRefs.current[st.id] = node;
                  }}
                  r="3"
                  fill={st.accent}
                  style={{ opacity: 0 }}
                />
              </g>
            ))}
          </svg>
          {LAB_STATIONS.map((st) => {
            const Icon = STATION_ICONS[st.id];
            const isNear = nearStation === st.id;
            const isActive = openStation === st.id;

            let headline = st.shortLabel;
            let liveLine = st.subtitle;

            if (st.id === "research") {
              headline = liveSnap?.pdbBenchmarkId ? `Fold · ${liveSnap.pdbBenchmarkId}` : "Protein Lab";
              liveLine = liveSnap
                ? `${liveSnap.bestEnergy.toFixed(1)} kcal · ${
                    structuralStats ? `Q ${structuralStats.nativeQ}%` : `${liveSnap.discoveries} folds`
                  }`
                : "Folding 3D chain…";
            } else if (st.id === "mining") {
              headline = `${pendingCoins.toFixed(2)} ALCH`;
              liveLine = `${effectiveMiningRate} / hr · 0% tax`;
            } else if (st.id === "pet") {
              headline = petDisplayName;
              liveLine = `${companionMoodLabel(vitals)} · ${tamaBoost}x speed`;
            } else if (st.id === "builder") {
              headline = `Home Architect`;
              liveLine = `${labDecor.houseFloors}F · ${labDecor.extraRooms.length + builtCount} rooms · Move`;
            } else if (st.id === "console") {
              headline = savedProfile?.name || "Researcher";
              liveLine = `Goals ${goalsDoneCount}/5 · Wardrobe`;
            }

            return (
              <button
                key={st.id}
                ref={(node) => {
                  floatingNodeRefs.current[st.id] = node;
                }}
                type="button"
                className={`world-float-card clickable ${isNear ? "is-near" : ""} ${
                  isActive ? "is-open" : ""
                }`}
                style={{ "--station-accent": st.accent } as React.CSSProperties}
                onClick={(e) => {
                  e.stopPropagation();
                  navigateToStation(st.id);
                }}
              >
                <span
                  className="cute-icon-bubble world-float-icon"
                  style={{ "--bubble-accent": st.accent } as React.CSSProperties}
                >
                  <Icon size={13} />
                </span>
                <div className="world-float-content">
                  <div className="world-float-top">
                    <strong>{headline}</strong>
                  </div>
                  <div className="world-float-sub">{liveLine}</div>
                </div>
                {isNear && !isActive && <span className="world-float-key">E</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Layer 2: Cutesy Silver-White Glassmorphism Floating Top HUD */}
      {!creatorOpen && (
        <header className="world-hud-top">
          <div className="world-hud-group">
            {isVisiting && visitingHostProfile ? (
              <span className="world-pill world-pill-visiting">
                <span className="cute-icon-bubble is-sm" style={{ "--bubble-accent": "#10b981" } as React.CSSProperties}>
                  <DoorOpen size={11} />
                </span>
                <strong>
                  {visitingHostProfile.name}&apos;s Home · #{activeVessel.tokenId}
                </strong>
                <span className="world-pill-muted">{activeVessel.minter}</span>
              </span>
            ) : switchableVessels && switchableVessels.length > 1 && onSelectTokenId ? (
              switchableVessels.map((v) => (
                <button
                  key={v.tokenId}
                  type="button"
                  className={`world-pill clickable ${v.tokenId === vessel.tokenId ? "active" : ""}`}
                  onClick={() => onSelectTokenId(v.tokenId)}
                >
                  <span className="cute-icon-bubble is-sm">
                    <FlaskConical size={11} />
                  </span>
                  <strong>#{v.tokenId}</strong>
                  <span className="world-pill-muted">{countSectors(v.sectorsMask)}/6</span>
                </button>
              ))
            ) : (
              <span className="world-pill">
                <span className="cute-icon-bubble is-sm">
                  <FlaskConical size={11} />
                </span>
                <strong>Lab #{vessel.tokenId}</strong>
                <span className="world-pill-muted">{traits.vessel}</span>
              </span>
            )}

            {isVisiting && (
              <>
                <button
                  type="button"
                  className="world-pill clickable"
                  onClick={() => {
                    setNeighborhoodDrawerOpen(false);
                    setConsoleSubTab("studio");
                    setOpenStation("console");
                    setGuestbookOpen(true);
                    soundEngine.playTap(1046.5);
                  }}
                  title="Read and sign this home's guestbook"
                >
                  <span className="cute-icon-bubble is-sm">
                    <BookOpen size={11} />
                  </span>
                  <span>Guestbook ({guestbookEntries.length})</span>
                </button>
                <button
                  type="button"
                  className="world-pill active clickable"
                  onClick={handleReturnHome}
                  title="Return to your own Home Lab (H)"
                >
                  <Home size={12} />
                  <span>Go Home (#{vessel.tokenId})</span>
                </button>
              </>
            )}

            {savedProfile && (
              <button
                type="button"
                className="world-pill clickable"
                onClick={openCharacterCreator}
                title="Open 3D Closet — customize clothing, hair, wings & look (C)"
              >
                <span
                  className="cute-icon-bubble is-sm"
                  style={{ "--bubble-accent": savedProfile.outfitAccent } as React.CSSProperties}
                >
                  <Shirt size={11} />
                </span>
                <strong>{savedProfile.name}</strong>
                <span className="world-pill-muted">Closet</span>
              </button>
            )}

            <button
              type="button"
              className={`world-pill clickable ${
                neighborhoodDrawerOpen || cameraMode === "neighborhood" ? "active" : ""
              }`}
              onClick={handleOpenNeighborhood}
              title="Explore Alchemia Town & visit neighbors (N)"
            >
              <span className="cute-icon-bubble is-sm">
                <MapPin size={11} />
              </span>
              <strong>{neighbors.length + 1} Homes</strong>
              <span className="world-pill-muted">{townGrowth.title}</span>
            </button>

            {(charOutInNeighborhood || cameraMode === "neighborhood") && !isVisiting && (
              <button
                type="button"
                className="world-pill clickable"
                onClick={handleReturnHome}
                title="Walk back to your Home Lab (H)"
              >
                <Home size={12} />
                <span>Home</span>
              </button>
            )}
          </div>

          <div className="world-hud-group">
            {!standaloneMode && (
              <>
                <div className="world-balance-capsule" aria-label="Sparks and ALCH balance">
                  <span className="world-balance-item" title="Play sparks earned in 3D">
                    <span className="cute-icon-bubble is-xs">
                      <Sparkles size={10} />
                    </span>
                    <strong>{labSparks}</strong>
                  </span>
                  <span className="world-balance-sep" aria-hidden="true" />
                  <span className="world-balance-item" title="ALCH token balance">
                    <span className="cute-icon-bubble is-xs">
                      <Coins size={10} />
                    </span>
                    <strong>{userCoinBalance.toFixed(1)}</strong>
                    <span className="world-pill-muted">ALCH</span>
                  </span>
                </div>
                {onConnectWallet && !walletAddress && (
                  <button
                    type="button"
                    className="world-pill clickable"
                    onClick={() => void onConnectWallet()}
                  >
                    <Wallet size={12} />
                    Connect
                  </button>
                )}
              </>
            )}

            <button
              type="button"
              className="world-icon-orb clickable"
              onClick={() => setSoundOn(soundEngine.toggle())}
              aria-label={soundOn ? "Mute sound" : "Enable sound"}
              title="Toggle sound (M)"
            >
              {soundOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
            </button>

            <button
              type="button"
              className="world-icon-orb clickable"
              onClick={() => void toggleFullscreen()}
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              title={isFullscreen ? "Exit fullscreen" : "Expand fullscreen"}
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>

            {animationUrl && !standaloneMode && (
              <a
                href={
                  savedProfile
                    ? `${animationUrl}${animationUrl.includes("?") ? "&" : "?"}char=${encodeCharacterCode(
                        savedProfile
                      )}`
                    : animationUrl
                }
                target="_blank"
                rel="noreferrer"
                className="world-pill clickable"
                style={{ textDecoration: "none" }}
                title="Open standalone fullscreen NFT with your designed character"
              >
                <Sparkles size={11} />
                <span>NFT</span>
                <ArrowUpRight size={11} />
              </a>
            )}
          </div>
        </header>
      )}

      {/* Clickable Cutesy Silver-Glass B1 / 1F / 2F / 3F Multi-Story Floor Switcher */}
      {!creatorOpen && Boolean(savedProfile) && (labDecor.hasBasement || labDecor.houseFloors >= 2) && (
        <div className="floor-switcher-hud" role="group" aria-label="Switch house floor">
          <span className="floor-switcher-label">
            <Layers size={11} /> Floor
          </span>
          {([0, 1, 2, 3] as FloorNumber[])
            .filter((f) => (f === 0 ? labDecor.hasBasement : f <= labDecor.houseFloors))
            .map((f) => (
              <button
                key={f}
                type="button"
                className={`floor-pill-btn clickable ${activeFloor === f ? "active" : ""}`}
                onClick={() => handleSwitchFloor(f)}
                title={
                  f === 0
                    ? "Go down to B1 Sunken Basement (or walk down the East steps!)"
                    : `Go to Floor ${formatFloorLabel(f)} (or walk up/down the steps!)`
                }
              >
                {formatFloorLabel(f)}
              </button>
            ))}
        </div>
      )}

      {/* Live 3D Free-Placement Move Mode Floating Top Banner */}
      {!creatorOpen && movingItem && (() => {
        const meta = MOVABLE_ITEMS.find((m) => m.id === movingItem);
        return (
          <div className="move-mode-banner" role="region" aria-label="Move item placement mode">
            <div className="move-mode-info">
              <span
                className="cute-icon-bubble is-sm"
                style={{ "--bubble-accent": meta?.accent || "#38bdf8" } as React.CSSProperties}
              >
                <Move size={11} />
              </span>
              <div>
                <strong>Placing {meta?.label || movingItem}</strong>
                <small>Click anywhere on {formatFloorLabel(activeFloor)} floor to move it live in 3D</small>
              </div>
            </div>
            <div className="move-mode-actions">
              {(labDecor.hasBasement || labDecor.houseFloors >= 2) &&
                ([0, 1, 2, 3] as FloorNumber[])
                  .filter((f) => (f === 0 ? labDecor.hasBasement : f <= labDecor.houseFloors))
                  .map((f) => (
                    <button
                      key={f}
                      type="button"
                      className={`subtle-pill-btn clickable ${activeFloor === f ? "active" : ""}`}
                      style={{ padding: "4px 8px", fontSize: "0.7rem" }}
                      onClick={() => handleSwitchFloor(f)}
                    >
                      {formatFloorLabel(f)}
                    </button>
                  ))}
              <button
                type="button"
                className="subtle-pill-btn clickable"
                style={{ padding: "4px 9px", fontSize: "0.7rem" }}
                onClick={() => handleRotateMovedItem(movingItem)}
                title="Rotate 45 degrees"
              >
                <RotateCw size={11} /> Rotate
              </button>
              <button
                type="button"
                className={`subtle-pill-btn clickable ${moveSnapGrid ? "active" : ""}`}
                style={{ padding: "4px 9px", fontSize: "0.7rem" }}
                onClick={() => setMoveSnapGrid((v) => !v)}
                title="Toggle 0.25m alignment grid"
              >
                <Grid2x2 size={11} /> Snap
              </button>
              <button
                type="button"
                className="sector-btn clickable"
                onClick={() => {
                  setMovingItem(null);
                  setCameraMode("follow");
                  soundEngine.playTap(1046.5);
                }}
              >
                <Check size={11} /> Done
              </button>
            </div>
          </div>
        );
      })()}

      {/* Clickable Cutesy Silver-Glass Plumbob Mood & 4-Icon Needs Charm */}
      {!creatorOpen && Boolean(savedProfile) && (
        <button
          type="button"
          className="sims-vibes-bar clickable"
          aria-label="Open Sims moods, character status and relationships"
          title="Click to change mood, rename character, or grow relationships"
          onClick={() => {
            setNeighborhoodDrawerOpen(false);
            setConsoleSubTab("sims");
            setOpenStation((cur) => (cur === "console" ? null : "console"));
            soundEngine.playTap(1046.5);
          }}
        >
          <span
            className="sims-plumbob-dome"
            style={{ "--plumbob": simsMood.plumbobHex } as React.CSSProperties}
          >
            <svg viewBox="0 0 16 24" className="sims-plumbob-icon" aria-hidden="true">
              <polygon points="8,1 15,12 8,23 1,12" fill={simsMood.plumbobHex} />
              <polygon points="8,1 15,12 8,14" fill="rgba(255,255,255,0.48)" />
            </svg>
          </span>
          <span className="sims-mood-title">{simsMood.name}</span>
          <div className="sims-vibe-meters">
            <span className="sims-need-pill" title={`Energy ${simsVibes.energy}%`}>
              <Zap size={10} className="sims-need-ico" />
              <span className="sims-need-track">
                <i style={{ width: `${simsVibes.energy}%`, background: "#10b981" }} />
              </span>
            </span>
            <span className="sims-need-pill" title={`Focus ${simsVibes.focus}%`}>
              <Brain size={10} className="sims-need-ico" />
              <span className="sims-need-track">
                <i style={{ width: `${simsVibes.focus}%`, background: "#38bdf8" }} />
              </span>
            </span>
            <span className="sims-need-pill" title={`Social ${simsVibes.social}%`}>
              <Heart size={10} className="sims-need-ico" />
              <span className="sims-need-track">
                <i style={{ width: `${simsVibes.social}%`, background: "#f472b6" }} />
              </span>
            </span>
            <span className="sims-need-pill" title={`Fun ${simsVibes.fun}%`}>
              <Smile size={10} className="sims-need-ico" />
              <span className="sims-need-track">
                <i style={{ width: `${simsVibes.fun}%`, background: "#a855f7" }} />
              </span>
            </span>
          </div>
          {activeMoodlet && activeMoodlet.expiresAtMs > nowTick ? (
            <span className="sims-activity-pill">
              <Sparkles size={9} /> {activeMoodlet.label}
            </span>
          ) : currentActivity ? (
            <span className="sims-activity-pill">{currentActivity}</span>
          ) : null}
        </button>
      )}

      {/* Doorstep Portal Transition Shimmer when Entering or Leaving a Neighbor's Home */}
      {homeTransitionLabel && (
        <div className="home-transition-overlay" role="status" aria-live="polite">
          <div className="home-transition-pill">
            <DoorOpen size={15} />
            <span>{homeTransitionLabel}</span>
          </div>
        </div>
      )}

      {/* Preview Lab Banner or Feedback Toast */}
      {!creatorOpen && (feedback || isPreviewLab) && (
        <div className="world-toast-wrap" role="status">
          {feedback ? (
            <div className="world-toast">
              <span>{feedback}</span>
              <button type="button" onClick={() => setFeedback(null)} aria-label="Dismiss">
                ×
              </button>
            </div>
          ) : isPreviewLab ? (
            <div className="world-toast">
              <span>
                Exploring live Lab #{vessel.tokenId}.{" "}
                {onGoMint && (
                  <button type="button" className="world-inline-link" onClick={onGoMint}>
                    Mint your own for $1
                  </button>
                )}{" "}
                to save rooms on-chain.
              </span>
            </div>
          ) : null}
        </div>
      )}

      {/* First-Interaction Floating CTA in Standalone NFT Mode before character is created */}
      {!savedProfile && !creatorOpen && creatorTriggerMode === "on-first-interaction" && (
        <div className="world-enter-cta-wrap">
          <button
            type="button"
            className="btn-mint-minimal clickable world-enter-cta"
            onClick={openCharacterCreator}
          >
            <Footprints size={16} />
            Design Character &amp; Walk Inside
          </button>
          <span className="world-enter-hint">
            Or click the floor / press WASD to create your researcher
          </span>
        </div>
      )}

      {/* Layer 3: Interactive Floating Glass Station Panel (opens smoothly inside the NFT card!) */}
      {!creatorOpen && openStation && (
        <aside
          className="glass-panel world-station-drawer"
          aria-label={LAB_STATION_BY_ID[openStation].label}
        >
          <div className="world-drawer-head">
            <div className="world-drawer-title-group">
              <span
                className="drawer-icon-medallion"
                style={{ "--bubble-accent": LAB_STATION_BY_ID[openStation].accent } as React.CSSProperties}
              >
                {(() => {
                  const DrawerIcon = STATION_ICONS[openStation];
                  return <DrawerIcon size={17} />;
                })()}
              </span>
              <div>
                <div className="single-kicker">{LAB_STATION_BY_ID[openStation].subtitle}</div>
                <h3 className="world-drawer-title">{LAB_STATION_BY_ID[openStation].label}</h3>
              </div>
            </div>
            <button
              type="button"
              className="inline-icon-btn clickable"
              onClick={() => {
                setOpenStation(null);
                setPreviewSectorId(null);
                manualPanelPinRef.current = false;
              }}
              aria-label="Close panel"
            >
              <X size={14} />
            </button>
          </div>

          <div className="world-drawer-scroll">
            {/* STATION 1: PROTEIN RESEARCH WORKBENCH */}
            {openStation === "research" && (
              <div className="world-drawer-stack">
                <div className="science-head">
                  <div className="science-title" style={{ fontSize: "1.15rem" }}>
                    {liveSnap ? liveSnap.taskTitle : "Loading protein benchmark…"}
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <select
                      className="protein-select clickable"
                      value={selectedBenchmark ?? liveSnap?.benchmarkIndex ?? 0}
                      onChange={(e) => {
                        const idx = Number(e.target.value);
                        setSelectedBenchmark(idx);
                        soundEngine.playTap(987.77);
                      }}
                      aria-label="Choose protein benchmark"
                    >
                      {PROTEIN_BENCHMARKS.map((b) => (
                        <option key={b.pdbId} value={b.id}>
                          {b.shortName} · {b.sequence.length} aa
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="subtle-pill-btn clickable"
                      style={{ padding: "5px 10px", fontSize: "0.72rem" }}
                      onClick={() => {
                        const nextActive = !(liveSnap?.active ?? true);
                        artworkRef.current?.setComputeActive(nextActive);
                      }}
                    >
                      {liveSnap?.active === false ? <Play size={11} /> : <Pause size={11} />}
                      {liveSnap?.active === false ? "Resume" : "Pause"}
                    </button>
                  </div>
                </div>

                {liveSnap && (
                  <>
                    <p className="science-summary">
                      {PROTEIN_BENCHMARKS[liveSnap.benchmarkIndex]?.humanSummary}
                    </p>

                    <div className={`daily-fold-bar ${dailyDone ? "completed" : ""}`}>
                      <span>
                        <Trophy size={12} style={{ verticalAlign: "-2px", marginRight: 5 }} />
                        {dailyDone ? (
                          <>
                            Today&apos;s fold done: <strong>{dailyChallenge.shortName}</strong>
                          </>
                        ) : (
                          <>
                            Daily fold: <strong>{dailyChallenge.shortName}</strong> · target{" "}
                            <strong>{dailyChallenge.targetEnergyKcal} kcal/mol</strong>
                          </>
                        )}
                      </span>
                      {!dailyDone && liveSnap.benchmarkIndex !== dailyChallenge.benchmarkIndex && (
                        <button
                          type="button"
                          className="sector-btn eth clickable"
                          onClick={() => {
                            setSelectedBenchmark(dailyChallenge.benchmarkIndex);
                            soundEngine.playTap(987.77);
                          }}
                        >
                          Try fold
                        </button>
                      )}
                    </div>

                    <div className="world-metrics-2x2">
                      <div className="science-metric">
                        <span>Best energy</span>
                        <strong>{liveSnap.bestEnergy.toFixed(1)} kcal/mol</strong>
                      </div>
                      <div className="science-metric">
                        <span>Native fold Q</span>
                        <strong>{structuralStats ? `${structuralStats.nativeQ}%` : "—"}</strong>
                      </div>
                      <div className="science-metric">
                        <span>Size fit</span>
                        <strong>
                          {liveSnap.radiusOfGyration.toFixed(1)}Å ({liveSnap.compactnessMatchPct}%)
                        </strong>
                      </div>
                      <div className="science-metric">
                        <span>Core burial</span>
                        <strong>{liveSnap.hydrophobicBurialPct}%</strong>
                      </div>
                    </div>

                    <div className="sparkline-row">
                      <EnergySparkline history={liveSnap.energyHistory} />
                      <div className="sparkline-meta">
                        <span>
                          {liveSnap.opsPerSecond.toLocaleString()} steps/s · {liveSnap.contactCount}{" "}
                          contacts
                        </span>
                        {structuralStats && (
                          <span>
                            Helix {structuralStats.ss.helixPct}% · Sheet{" "}
                            {structuralStats.ss.sheetPct}% · {structuralStats.geometry.stericClashes}{" "}
                            clashes
                          </span>
                        )}
                      </div>
                    </div>

                    {structuralStats && (
                      <SequenceRibbonBar
                        residues={
                          liveSnap.bestResidues?.length ? liveSnap.bestResidues : liveSnap.residues
                        }
                        secondaryCodes={structuralStats.ss.codes}
                        onHoverResidue={setHighlightedResidueIdx}
                      />
                    )}

                    {showContactMap && structuralStats && (
                      <ContactMapSvg
                        residueCount={liveSnap.sequenceCode.length}
                        contacts={structuralStats.contacts}
                      />
                    )}

                    <div className="mining-buttons">
                      <button
                        type="button"
                        className="subtle-pill-btn clickable"
                        onClick={() => {
                          if (labDecor.stationUpgrades.research < 3) {
                            handleUpgradeStation("research");
                          } else {
                            setBuilderSubTab("upgrades");
                            setOpenStation("builder");
                          }
                        }}
                      >
                        <ArrowUpCircle size={12} />{" "}
                        {labDecor.stationUpgrades.research < 3
                          ? `Upgrade Scope Lv.${labDecor.stationUpgrades.research + 1} (${
                              standaloneMode
                                ? "Free"
                                : `${getNextUpgradeCost(labDecor.stationUpgrades.research)} sparks`
                            })`
                          : "Microscope Lv.3 Max"}
                      </button>
                      <button
                        type="button"
                        className="sector-btn clickable"
                        onClick={() => {
                          setFoldSignal((prev) => ({ action: "wiggle", seq: (prev?.seq || 0) + 1 }));
                          onAwardPlayBonus?.(1 + stationBonuses.extraFoldSpark);
                          markGoalDone("fold");
                          setFeedback(
                            `Wiggled protein backbone to lower energy.${
                              stationBonuses.extraFoldSpark > 0 && onAwardPlayBonus
                                ? " +2 sparks (Lv.3 Scope)!"
                                : ""
                            }`
                          );
                        }}
                      >
                        Wiggle
                      </button>
                      <button
                        type="button"
                        className="sector-btn eth clickable"
                        onClick={() => {
                          setFoldSignal((prev) => ({ action: "shake", seq: (prev?.seq || 0) + 1 }));
                          onAwardPlayBonus?.(1);
                          markGoalDone("fold");
                          setFeedback("Shook protein chain to explore a fresh fold.");
                        }}
                      >
                        Shake
                      </button>
                      <button
                        type="button"
                        className="sector-btn eth clickable"
                        onClick={() => {
                          setFoldSignal((prev) => ({ action: "bury", seq: (prev?.seq || 0) + 1 }));
                          onAwardPlayBonus?.(1);
                          markGoalDone("fold");
                          setFeedback("Pulled hydrophobic amino acids inward.");
                        }}
                      >
                        Bury core
                      </button>
                      <button
                        type="button"
                        className={`subtle-pill-btn clickable ${showBestFold ? "active" : ""}`}
                        onClick={() => {
                          setShowBestFold((v) => !v);
                          soundEngine.playTap(987.77);
                        }}
                      >
                        {showBestFold ? "Best fold" : "Live search"}
                      </button>
                      <button
                        type="button"
                        className="subtle-pill-btn clickable"
                        onClick={() => {
                          downloadPDBFromSnapshot(liveSnap);
                          setFeedback(`Downloaded ${liveSnap.pdbBenchmarkId}.pdb.`);
                        }}
                      >
                        <Download size={12} /> .PDB
                      </button>
                      <button
                        type="button"
                        className="subtle-pill-btn clickable"
                        onClick={() => {
                          downloadMMCIFFromSnapshot(liveSnap);
                          setFeedback(`Downloaded ${liveSnap.pdbBenchmarkId}.cif.`);
                        }}
                      >
                        <Download size={12} /> .CIF
                      </button>
                      <button
                        type="button"
                        className="subtle-pill-btn clickable"
                        onClick={() =>
                          downloadScienceCertificateFromSnapshot(liveSnap, {
                            nativeContactQ: structuralStats?.nativeQ,
                            helixPct: structuralStats?.ss.helixPct,
                            sheetPct: structuralStats?.ss.sheetPct,
                            meanCaBondAngstrom: structuralStats?.geometry.meanCaBondAngstrom,
                            stericClashes: structuralStats?.geometry.stericClashes,
                            geometryGrade: structuralStats?.geometry.grade
                          })
                        }
                      >
                        <FileJson size={12} /> .JSON
                      </button>
                      <button
                        type="button"
                        className="subtle-pill-btn clickable"
                        onClick={() => setShowContactMap((v) => !v)}
                      >
                        <Grid2x2 size={12} /> {showContactMap ? "Hide map" : "Contacts"}
                      </button>
                      <a
                        href={`https://www.rcsb.org/structure/${liveSnap.pdbBenchmarkId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="subtle-pill-btn clickable"
                        style={{ textDecoration: "none" }}
                      >
                        RCSB <ArrowUpRight size={11} />
                      </a>
                      {onAnchorProof && !isVisiting && (
                        <button
                          type="button"
                          className="subtle-pill-btn clickable"
                          onClick={async () => {
                            try {
                              await onAnchorProof(vessel, liveSnap);
                              soundEngine.playBuildRoom();
                              setFeedback(
                                `Saved fold proof (${liveSnap.proofHash.slice(0, 12)}…) on-chain.`
                              );
                            } catch (err) {
                              setFeedback(
                                err instanceof Error
                                  ? err.message
                                  : "Connect owner wallet to save proof."
                              );
                            }
                          }}
                        >
                          <ShieldCheck size={12} /> Save proof
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* STATION 2: ALCH COIN MINING BAY */}
            {openStation === "mining" && (
              <div className="world-drawer-stack">
                <div className="mining-head">
                  <div>
                    <div className="single-kicker">0% Tax ALCH Yield</div>
                    <div className="mining-big">
                      {pendingCoins.toFixed(2)} <span>ALCH ready</span>
                    </div>
                  </div>
                  <div className="mining-rate-badge">{effectiveMiningRate} / hr</div>
                </div>

                {!isVisiting && (
                  <div className="upgrade-next-box">
                    <div>
                      <div className="upgrade-next-title">
                        Harvester Lv.{labDecor.stationUpgrades.mining}/3 ·{" "}
                        {STATION_UPGRADE_DEFS[1].tiers[labDecor.stationUpgrades.mining - 1].title}
                      </div>
                      <div className="tama-sub">
                        {labDecor.stationUpgrades.mining === 1
                          ? `Next: ${STATION_UPGRADE_DEFS[1].tiers[1].perk}`
                          : labDecor.stationUpgrades.mining === 2
                            ? `Next: ${STATION_UPGRADE_DEFS[1].tiers[2].perk}`
                            : STATION_UPGRADE_DEFS[1].tiers[2].perk}
                      </div>
                    </div>
                    {labDecor.stationUpgrades.mining < 3 ? (
                      <button
                        type="button"
                        className="sector-btn clickable"
                        onClick={() => handleUpgradeStation("mining")}
                      >
                        <ArrowUpCircle size={11} />{" "}
                        {standaloneMode
                          ? `Lv.${labDecor.stationUpgrades.mining + 1}`
                          : `${getNextUpgradeCost(labDecor.stationUpgrades.mining)} sparks`}
                      </button>
                    ) : (
                      <span className="built-pill">
                        <Check size={11} /> Max
                      </span>
                    )}
                  </div>
                )}

                <div className="world-metrics-2x2">
                  <div className="science-metric">
                    <span>Base rate</span>
                    <strong>{baseRate} ALCH/hr</strong>
                  </div>
                  <div className="science-metric">
                    <span>Pet + Station</span>
                    <strong>
                      {tamaBoost}x · +{Math.round((stationBonuses.miningMult - 1) * 100)}%
                    </strong>
                  </div>
                  <div className="science-metric">
                    <span>Wallet balance</span>
                    <strong>{userCoinBalance.toFixed(1)} ALCH</strong>
                  </div>
                  <div className="science-metric">
                    <span>Shared to science</span>
                    <strong>{totalCoinsDonatedToResearch.toFixed(1)} ALCH</strong>
                  </div>
                </div>

                {onClaimCoins && !isVisiting ? (
                  <>
                    <div className="tithe-slider-row">
                      <div className="tithe-label">
                        <span>Share part of claim with researchers</span>
                        <strong>{tithePct}% to research</strong>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={50}
                        step={5}
                        value={tithePct}
                        onChange={(e) => setTithePct(Number(e.target.value))}
                        className="silver-slider"
                        aria-label="Percent of mined coins shared with researchers"
                      />
                    </div>

                    <div className="mining-buttons">
                      <button
                        type="button"
                        className="btn-mint-minimal clickable"
                        style={{ padding: "10px 20px", fontSize: "0.84rem" }}
                        onClick={async () => {
                          try {
                            await onClaimCoins(vessel, pendingCoins, tithePct);
                            soundEngine.playTap(1174.66);
                            markGoalDone("claim");
                            setCharacterEmote((prev) => ({
                              emote: "spin",
                              seq: (prev?.seq || 0) + 1
                            }));
                            setFeedback(
                              `Claimed ${(pendingCoins * (1 - tithePct / 100)).toFixed(
                                1
                              )} ALCH and shared ${(pendingCoins * (tithePct / 100)).toFixed(
                                1
                              )} ALCH with research.`
                            );
                          } catch (err) {
                            setFeedback(
                              err instanceof Error ? err.message : "Could not claim right now."
                            );
                          }
                        }}
                      >
                        <Coins size={14} /> Claim ALCH
                      </button>

                      {onDonateCoins && (
                        <div className="donate-quick-group">
                          {([10, 25, 100] as const).map((amt) => (
                            <button
                              key={amt}
                              type="button"
                              className={`donate-chip clickable ${donateAmt === amt ? "active" : ""}`}
                              onClick={() => setDonateAmt(amt)}
                            >
                              {amt}
                            </button>
                          ))}
                          <button
                            type="button"
                            className="subtle-pill-btn clickable"
                            onClick={async () => {
                              if (userCoinBalance < donateAmt) {
                                setFeedback(`Claim at least ${donateAmt} ALCH first to donate.`);
                                return;
                              }
                              try {
                                await onDonateCoins(vessel, donateAmt);
                                soundEngine.playPet();
                                setFeedback(`Sent ${donateAmt} ALCH straight to research.`);
                              } catch (err) {
                                setFeedback(
                                  err instanceof Error ? err.message : "Donation cancelled."
                                );
                              }
                            }}
                          >
                            <HeartHandshake size={13} /> Donate {donateAmt}
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="science-summary">
                    {isVisiting ? (
                      <>
                        You&apos;re visiting{" "}
                        <strong>
                          {visitingHostProfile?.name || "this researcher"}&apos;s Lab #
                          {activeVessel.tokenId}
                        </strong>{" "}
                        ({effectiveMiningRate} ALCH / hr · {builtCount}/6 rooms). Gift a research
                        spark or help fold their protein to cheer them on!
                      </>
                    ) : (
                      <>
                        This lab generates <strong>{effectiveMiningRate} ALCH / hr</strong> from its
                        Level {tier} reactor and {builtCount} built rooms. Connect your wallet in
                        the ALCHEMIA app to claim and share mined ALCH on-chain.
                      </>
                    )}
                  </p>
                )}
              </div>
            )}

            {/* STATION 3: PET SANCTUARY & 3D ANIMAL CLOTHING BOUTIQUE */}
            {openStation === "pet" && (
              <div className="world-drawer-stack">
                <div className="builder-subtabs" role="tablist" aria-label="Pet studio tabs">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={petSubTab === "care"}
                    className={`builder-subtab clickable ${petSubTab === "care" ? "active" : ""}`}
                    onClick={() => {
                      setPetSubTab("care");
                      setCameraMode("follow");
                      soundEngine.playTap(880);
                    }}
                  >
                    <Heart size={12} /> Care &amp; Play
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={petSubTab === "boutique"}
                    className={`builder-subtab clickable ${
                      petSubTab === "boutique" ? "active" : ""
                    }`}
                    onClick={() => {
                      setPetSubTab("boutique");
                      setCameraMode("orbit");
                      setCamPreset((prev) => ({ preset: "pet", seq: (prev?.seq || 0) + 1 }));
                      soundEngine.playTap(1046.5);
                    }}
                  >
                    <Shirt size={12} /> Pet Clothes
                  </button>
                </div>

                {petSubTab === "boutique" ? (
                  <div className="world-drawer-stack">
                    <div className="furnish-header-row">
                      <span className="single-kicker">
                        {petDisplayName}&apos;s 3D Wardrobe
                      </span>
                      <button
                        type="button"
                        className="subtle-pill-btn clickable"
                        style={{ padding: "4px 10px", fontSize: "0.7rem" }}
                        onClick={() => {
                          const next = randomizeCompanionWardrobe(vitals);
                          applyPetWardrobe(
                            next,
                            `Styled ${petDisplayName} in a fresh randomized outfit!`
                          );
                        }}
                      >
                        <Dices size={12} /> Shuffle Look
                      </button>
                    </div>

                    <div className="creator-field">
                      <span className="creator-label">Animal Outfits ({PET_OUTFIT_OPTIONS.length})</span>
                      <div className="creator-chip-grid">
                        {PET_OUTFIT_OPTIONS.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            className={`creator-chip clickable ${
                              (vitals.outfit || "none") === opt.id ? "active" : ""
                            }`}
                            onClick={() =>
                              applyPetWardrobe(
                                setCompanionOutfit(vitals, opt.id as PetOutfitId),
                                `Dressed ${petDisplayName} in ${opt.label}!`
                              )
                            }
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="creator-field">
                      <span className="creator-label">Outfit &amp; Hat Color</span>
                      <div className="creator-swatch-row">
                        {PET_COLOR_SWATCHES.map((sw) => (
                          <button
                            key={sw.id}
                            type="button"
                            className={`creator-swatch clickable ${
                              (vitals.outfitColor || "#f472b6").toLowerCase() ===
                              sw.hex.toLowerCase()
                                ? "active"
                                : ""
                            }`}
                            style={{ background: sw.hex }}
                            title={sw.label}
                            aria-label={sw.label}
                            onClick={() =>
                              applyPetWardrobe(
                                setCompanionOutfitColor(vitals, sw.hex),
                                `Switched ${petDisplayName}'s wardrobe color to ${sw.label}!`
                              )
                            }
                          />
                        ))}
                      </div>
                    </div>

                    <div className="creator-field">
                      <span className="creator-label">Hats, Scarves &amp; Glasses ({PET_ACCESSORY_ORDER.length})</span>
                      <div className="creator-chip-grid">
                        {PET_ACCESSORY_ORDER.map((accId) => (
                          <button
                            key={accId}
                            type="button"
                            className={`creator-chip clickable ${
                              (vitals.accessory || "auto") === accId ? "active" : ""
                            }`}
                            onClick={() =>
                              applyPetWardrobe(
                                setCompanionAccessory(vitals, accId as PetAccessory),
                                `Equipped ${PET_ACCESSORY_LABELS[accId]} on ${petDisplayName}!`
                              )
                            }
                          >
                            {PET_ACCESSORY_LABELS[accId]}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="creator-field">
                      <span className="creator-label">Wings &amp; Back Gear ({PET_BACK_GEAR_OPTIONS.length})</span>
                      <div className="creator-chip-grid">
                        {PET_BACK_GEAR_OPTIONS.map((bg) => (
                          <button
                            key={bg.id}
                            type="button"
                            className={`creator-chip clickable ${
                              (vitals.backGear || "none") === bg.id ? "active" : ""
                            }`}
                            onClick={() =>
                              applyPetWardrobe(
                                setCompanionBackGear(vitals, bg.id as PetBackGearId),
                                bg.id === "none"
                                  ? `Removed ${petDisplayName}'s back gear.`
                                  : `Put ${bg.label} on ${petDisplayName}!`
                              )
                            }
                          >
                            {bg.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                <div className="tama-head">
                  <div>
                    {editingPetName ? (
                      <form
                        className="pet-name-form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleSavePetName();
                        }}
                      >
                        <input
                          type="text"
                          value={petNameDraft}
                          maxLength={22}
                          placeholder={defaultPetLabel}
                          onChange={(e) => setPetNameDraft(e.target.value)}
                          autoFocus
                          className="pet-name-input"
                          aria-label="Pet name"
                        />
                        <button type="submit" className="sector-btn clickable">
                          Save
                        </button>
                      </form>
                    ) : (
                      <div className="tama-title-row">
                        <span className="tama-title">{petDisplayName}</span>
                        <button
                          type="button"
                          className="inline-icon-btn clickable"
                          onClick={() => {
                            setPetNameDraft(vitals.petName);
                            setEditingPetName(true);
                          }}
                          title="Rename pet"
                          aria-label="Rename pet"
                        >
                          <Pencil size={12} />
                        </button>
                      </div>
                    )}
                    <div className="tama-sub">
                      Level {vitals.level} · {companionMoodLabel(vitals)} ·{" "}
                      <strong>{tamaBoost}x</strong> lab speed ·{" "}
                      <Flame size={11} style={{ verticalAlign: "-1px" }} /> {vitals.dailyStreak}d
                      streak
                    </div>
                  </div>
                </div>

                <div className="tama-bars">
                  <div className="tama-bar-item">
                    <span>Food</span>
                    <div className="mini-track">
                      <div
                        className="mini-fill"
                        style={{ width: `${vitals.energy}%`, background: "#10b981" }}
                      />
                    </div>
                  </div>
                  <div className="tama-bar-item">
                    <span>Happy</span>
                    <div className="mini-track">
                      <div
                        className="mini-fill"
                        style={{ width: `${vitals.mood}%`, background: "#f472b6" }}
                      />
                    </div>
                  </div>
                  <div className="tama-bar-item">
                    <span>Play</span>
                    <div className="mini-track">
                      <div
                        className="mini-fill"
                        style={{ width: `${vitals.curiosity}%`, background: "#5b8def" }}
                      />
                    </div>
                  </div>
                </div>

                <div className="tama-actions">
                  <button
                    type="button"
                    className="subtle-pill-btn clickable"
                    onClick={() => handleTamagotchi("feed")}
                  >
                    <Cookie size={13} />
                    {onSpendCoinsForTreat ? "Feed (5 sparks)" : "Feed"}
                  </button>
                  <button
                    type="button"
                    className="subtle-pill-btn clickable"
                    onClick={() => handleTamagotchi("pet")}
                  >
                    <Heart size={13} /> Pet
                  </button>
                  <button
                    type="button"
                    className="subtle-pill-btn clickable"
                    onClick={() => handleTamagotchi("play")}
                  >
                    <Sparkles size={13} /> Play
                  </button>
                  <button
                    type="button"
                    className="subtle-pill-btn clickable"
                    onClick={handleToggleSleep}
                  >
                    {vitals.sleeping ? <Sun size={13} /> : <Moon size={13} />}
                    {vitals.sleeping ? "Wake" : "Nap"}
                  </button>
                  <button
                    type="button"
                    className="subtle-pill-btn clickable"
                    onClick={() => {
                      setPetSubTab("boutique");
                      soundEngine.playTap(1046.5);
                    }}
                  >
                    <Shirt size={13} /> Dress Up
                  </button>
                  <button
                    type="button"
                    className="subtle-pill-btn clickable"
                    onClick={handleCycleStyle}
                  >
                    <Tag size={13} /> {PET_ACCESSORY_LABELS[vitals.accessory || "auto"]}
                  </button>
                  {!isVisiting && (
                    <button
                      type="button"
                      className="subtle-pill-btn clickable"
                      onClick={() => {
                        if (labDecor.stationUpgrades.pet < 3) {
                          handleUpgradeStation("pet");
                        } else {
                          setBuilderSubTab("upgrades");
                          setOpenStation("builder");
                        }
                      }}
                    >
                      <ArrowUpCircle size={13} />{" "}
                      {labDecor.stationUpgrades.pet < 3
                        ? `Sanctuary Lv.${labDecor.stationUpgrades.pet + 1} (${
                            standaloneMode
                              ? "Free"
                              : `${getNextUpgradeCost(labDecor.stationUpgrades.pet)} sparks`
                          })`
                        : "Sanctuary Lv.3"}
                    </button>
                  )}
                  <button
                    type="button"
                    className="subtle-pill-btn clickable"
                    onClick={() => {
                      if (miniGame) {
                        setMiniGame(null);
                        return;
                      }
                      soundEngine.playTap(1046.5);
                      setCameraMode("orbit");
                      setCamPreset((prev) => ({ preset: "iso", seq: (prev?.seq || 0) + 1 }));
                      setMiniGame({ endsAtMs: Date.now() + 20000, popped: 0, goal: 6 });
                      setFeedback("Pop 6 floating protons in the 3D scene within 20s for +12 sparks.");
                    }}
                  >
                    <Timer size={13} />
                    {miniGame
                      ? `${miniGame.popped}/${miniGame.goal} · ${Math.max(
                          0,
                          Math.ceil((miniGame.endsAtMs - nowTick) / 1000)
                        )}s`
                      : "Proton Catch"}
                  </button>
                </div>

                <div className="badge-row">
                  {badges.map((b) => (
                    <span key={b.label} className={`badge-chip ${b.earned ? "earned" : ""}`}>
                      <Award size={11} />
                      {b.label}
                    </span>
                  ))}
                </div>
                  </>
                )}
              </div>
            )}

            {/* STATION 4: HOME ARCHITECT — FURNISH, EXPAND FLOORS & ROOMS, FREE-PLACE MOVER & UPGRADES */}
            {openStation === "builder" && (
              <div className="world-drawer-stack">
                <div
                  className="builder-subtabs builder-subtabs-4"
                  role="tablist"
                  aria-label="Home architect mode"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={builderSubTab === "furnish"}
                    className={`builder-subtab clickable ${
                      builderSubTab === "furnish" ? "active" : ""
                    }`}
                    onClick={() => {
                      setBuilderSubTab("furnish");
                      soundEngine.playTap(987.77);
                    }}
                  >
                    <Sofa size={12} /> Furnish
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={builderSubTab === "expand"}
                    className={`builder-subtab clickable ${
                      builderSubTab === "expand" ? "active" : ""
                    }`}
                    onClick={() => {
                      setBuilderSubTab("expand");
                      soundEngine.playTap(1046.5);
                    }}
                  >
                    <Home size={12} /> Expand
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={builderSubTab === "move"}
                    className={`builder-subtab clickable ${
                      builderSubTab === "move" ? "active" : ""
                    }`}
                    onClick={() => {
                      setBuilderSubTab("move");
                      soundEngine.playTap(1174.66);
                    }}
                  >
                    <Move size={12} /> Move
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={builderSubTab === "upgrades"}
                    className={`builder-subtab clickable ${
                      builderSubTab === "upgrades" ? "active" : ""
                    }`}
                    onClick={() => {
                      setBuilderSubTab("upgrades");
                      soundEngine.playTap(880);
                    }}
                  >
                    <ArrowUpCircle size={12} /> Gear
                  </button>
                </div>

                {/* TAB 1: FULL 9-CATEGORY 3D HOME FURNISHING CATALOG (48 LIVE 3D ITEMS!) */}
                {builderSubTab === "furnish" && (() => {
                  const furnishCats = [
                    { id: "seating", label: "Seating", icon: Armchair },
                    { id: "bar", label: "Bar", icon: Coffee },
                    { id: "hobby", label: "Hobbies", icon: Gamepad2 },
                    { id: "rug", label: "Rugs", icon: Layers },
                    { id: "patio", label: "Patio", icon: Sparkles },
                    { id: "plants", label: "Plants", icon: Flower2 },
                    { id: "lights", label: "Lights", icon: LampCeiling },
                    { id: "floor", label: "Floors", icon: Palette },
                    { id: "walls", label: "Walls", icon: Home }
                  ] as const;

                  return (
                    <div className="world-drawer-stack">
                      <div className="furnish-header-row">
                        <span className="single-kicker">
                          {isVisiting
                            ? `Previewing ${visitingHostProfile?.name || "Host"}'s Decor`
                            : "48 Live 3D Furnishings & Finishes"}
                        </span>
                        <button
                          type="button"
                          className="subtle-pill-btn clickable"
                          style={{ padding: "4px 10px", fontSize: "0.7rem" }}
                          onClick={() => {
                            const next = randomizeLabDecor(labDecor.stationUpgrades, labDecor);
                            updateLabDecor(next);
                            setFeedback("Styled your home with a fresh randomized 3D furnishing set!");
                          }}
                        >
                          <Dices size={12} /> Randomize Look
                        </button>
                      </div>

                      <div className="theme-presets-strip" aria-label="1-click room themes">
                        {ROOM_THEME_PRESETS.map((theme) => (
                          <button
                            key={theme.id}
                            type="button"
                            className="creator-preset-pill clickable"
                            onClick={() => {
                              updateLabDecor({
                                ...labDecor,
                                ...theme.decor,
                                stationUpgrades: { ...labDecor.stationUpgrades }
                              });
                              soundEngine.playBuildRoom();
                              setFeedback(`Applied the ${theme.label} full-room theme in 3D!`);
                            }}
                          >
                            <span className="cause-dot" style={{ background: theme.swatch }} />
                            {theme.label}
                          </button>
                        ))}
                      </div>

                      <div className="furnish-cat-strip" role="tablist" aria-label="Furniture categories">
                        {furnishCats.map((cat) => {
                          const CatIcon = cat.icon;
                          const active = furnishCategory === cat.id;
                          return (
                            <button
                              key={cat.id}
                              type="button"
                              role="tab"
                              aria-selected={active}
                              className={`furnish-cat-pill clickable ${active ? "active" : ""}`}
                              onClick={() => {
                                setFurnishCategory(cat.id);
                                soundEngine.playTap(987.77);
                              }}
                            >
                              <span className="cute-icon-bubble is-xs">
                                <CatIcon size={10} />
                              </span>
                              <span>{cat.label}</span>
                            </button>
                          );
                        })}
                      </div>

                      {furnishCategory === "seating" && (
                        <div className="decor-grid">
                          {SEATING_STYLES.map((item) => {
                            const active = labDecor.seatingStyle === item.id;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                className={`decor-swatch-card furnish-card clickable ${active ? "active" : ""}`}
                                onClick={() => {
                                  updateLabDecor({ ...labDecor, seatingStyle: item.id });
                                  setFeedback(`Placed ${item.label} in your lounge!`);
                                }}
                              >
                                <div className="furnish-card-top">
                                  <span className="decor-swatch-dot" style={{ background: item.swatch }} />
                                  {active && (
                                    <span className="furnish-check-badge">
                                      <Check size={10} />
                                    </span>
                                  )}
                                </div>
                                <strong>{item.label}</strong>
                                <small>{item.desc}</small>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {furnishCategory === "bar" && (
                        <div className="decor-grid">
                          {BAR_STYLES.map((item) => {
                            const active = labDecor.barStyle === item.id;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                className={`decor-swatch-card furnish-card clickable ${active ? "active" : ""}`}
                                onClick={() => {
                                  updateLabDecor({ ...labDecor, barStyle: item.id });
                                  setFeedback(`Installed ${item.label} in your studio!`);
                                }}
                              >
                                <div className="furnish-card-top">
                                  <span className="decor-swatch-dot" style={{ background: item.swatch }} />
                                  {active && (
                                    <span className="furnish-check-badge">
                                      <Check size={10} />
                                    </span>
                                  )}
                                </div>
                                <strong>{item.label}</strong>
                                <small>{item.desc}</small>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {furnishCategory === "hobby" && (
                        <div className="decor-grid">
                          {HOBBY_PROPS.map((item) => {
                            const active = labDecor.hobbyProp === item.id;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                className={`decor-swatch-card furnish-card clickable ${active ? "active" : ""}`}
                                onClick={() => {
                                  updateLabDecor({ ...labDecor, hobbyProp: item.id });
                                  setFeedback(
                                    item.id === "none"
                                      ? "Cleared the hobby nook terrace."
                                      : `Placed interactive ${item.label} — click it in 3D to play!`
                                  );
                                }}
                              >
                                <div className="furnish-card-top">
                                  <span className="decor-swatch-dot" style={{ background: item.swatch }} />
                                  {active && (
                                    <span className="furnish-check-badge">
                                      <Check size={10} />
                                    </span>
                                  )}
                                </div>
                                <strong>{item.label}</strong>
                                <small>{item.desc}</small>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {furnishCategory === "rug" && (
                        <div className="decor-grid">
                          {RUG_STYLES.map((item) => {
                            const active = labDecor.rugStyle === item.id;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                className={`decor-swatch-card furnish-card clickable ${active ? "active" : ""}`}
                                onClick={() => {
                                  updateLabDecor({ ...labDecor, rugStyle: item.id });
                                  setFeedback(`Rolled out ${item.label} under your lounge.`);
                                }}
                              >
                                <div className="furnish-card-top">
                                  <span className="decor-swatch-dot" style={{ background: item.swatch }} />
                                  {active && (
                                    <span className="furnish-check-badge">
                                      <Check size={10} />
                                    </span>
                                  )}
                                </div>
                                <strong>{item.label}</strong>
                                <small>{item.desc}</small>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {furnishCategory === "patio" && (
                        <div className="decor-grid">
                          {PATIO_DECORS.map((item) => {
                            const active = labDecor.patioDecor === item.id;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                className={`decor-swatch-card furnish-card clickable ${active ? "active" : ""}`}
                                onClick={() => {
                                  updateLabDecor({ ...labDecor, patioDecor: item.id });
                                  setFeedback(`Placed ${item.label} on the lab patio.`);
                                }}
                              >
                                <div className="furnish-card-top">
                                  <span className="decor-swatch-dot" style={{ background: item.swatch }} />
                                  {active && (
                                    <span className="furnish-check-badge">
                                      <Check size={10} />
                                    </span>
                                  )}
                                </div>
                                <strong>{item.label}</strong>
                                <small>{item.desc}</small>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {furnishCategory === "plants" && (
                        <div className="decor-grid">
                          {PLANT_PACKS.map((item) => {
                            const active = labDecor.plantPack === item.id;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                className={`decor-swatch-card furnish-card clickable ${active ? "active" : ""}`}
                                onClick={() => {
                                  updateLabDecor({ ...labDecor, plantPack: item.id });
                                  setFeedback(`Arranged ${item.label} around your rotunda!`);
                                }}
                              >
                                <div className="furnish-card-top">
                                  <span className="decor-swatch-dot" style={{ background: item.swatch }} />
                                  {active && (
                                    <span className="furnish-check-badge">
                                      <Check size={10} />
                                    </span>
                                  )}
                                </div>
                                <strong>{item.label}</strong>
                                <small>{item.desc}</small>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {furnishCategory === "lights" && (
                        <div className="decor-grid">
                          {LIGHTING_FIXTURES.map((item) => {
                            const active = labDecor.lightingFixture === item.id;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                className={`decor-swatch-card furnish-card clickable ${active ? "active" : ""}`}
                                onClick={() => {
                                  updateLabDecor({ ...labDecor, lightingFixture: item.id });
                                  setFeedback(`Suspended ${item.label} above your atrium!`);
                                }}
                              >
                                <div className="furnish-card-top">
                                  <span className="decor-swatch-dot" style={{ background: item.swatch }} />
                                  {active && (
                                    <span className="furnish-check-badge">
                                      <Check size={10} />
                                    </span>
                                  )}
                                </div>
                                <strong>{item.label}</strong>
                                <small>{item.desc}</small>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {furnishCategory === "floor" && (
                        <div className="decor-grid">
                          {FLOOR_STYLES.map((f) => {
                            const active = labDecor.floorStyle === f.id;
                            return (
                              <button
                                key={f.id}
                                type="button"
                                className={`decor-swatch-card furnish-card clickable ${active ? "active" : ""}`}
                                onClick={() => {
                                  updateLabDecor({ ...labDecor, floorStyle: f.id });
                                  setFeedback(`Applied ${f.label} finish to your home floor.`);
                                }}
                              >
                                <div className="furnish-card-top">
                                  <span className="decor-swatch-dot" style={{ background: f.swatch }} />
                                  {active && (
                                    <span className="furnish-check-badge">
                                      <Check size={10} />
                                    </span>
                                  )}
                                </div>
                                <strong>{f.label}</strong>
                                <small>Architectural stone &amp; wood</small>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {furnishCategory === "walls" && (
                        <div className="decor-grid">
                          {WALL_STYLES.map((w) => {
                            const active = labDecor.wallStyle === w.id;
                            return (
                              <button
                                key={w.id}
                                type="button"
                                className={`decor-swatch-card furnish-card clickable ${active ? "active" : ""}`}
                                onClick={() => {
                                  updateLabDecor({ ...labDecor, wallStyle: w.id });
                                  setFeedback(`Refinished home walls & trim with ${w.label}!`);
                                }}
                              >
                                <div className="furnish-card-top">
                                  <span className="decor-swatch-dot" style={{ background: w.swatch }} />
                                  {active && (
                                    <span className="furnish-check-badge">
                                      <Check size={10} />
                                    </span>
                                  )}
                                </div>
                                <strong>{w.label}</strong>
                                <small>Walls, trim &amp; balcony rails</small>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      <div className="world-goals-block">
                        <div className="single-kicker" style={{ marginBottom: 7 }}>
                          World Sky &amp; Atmosphere
                        </div>
                        <div className="tama-actions">
                          {LIGHTING_ORDER.map((m) => (
                            <button
                              key={m}
                              type="button"
                              className={`subtle-pill-btn clickable ${
                                lightingMood === m ? "active" : ""
                              }`}
                              onClick={() => {
                                setLightingMood(m);
                                soundEngine.playTap(987.77);
                              }}
                            >
                              <Sun size={11} /> {LIGHTING_LABELS[m]}
                            </button>
                          ))}
                          {ATMOSPHERE_ORDER.map((a) => (
                            <button
                              key={a}
                              type="button"
                              className={`subtle-pill-btn clickable ${
                                atmosphereMode === a ? "active" : ""
                              }`}
                              onClick={() => {
                                setAtmosphereMode(a);
                                soundEngine.playTap(1046.5);
                              }}
                            >
                              <CloudSnow size={11} /> {ATMOSPHERE_LABELS[a]}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* TAB 2: EXPAND HOUSE SIZE, ADD MULTI-STORY FLOORS (2F/3F) & 6 COZY ROOMS */}
                {builderSubTab === "expand" && (
                  <div className="world-drawer-stack">
                    {/* 1. House Footprint Expansion (Lv. 1 -> 2 -> 3) */}
                    <div className="expand-section-card">
                      <div className="single-kicker">House Size · Bigger Courtyard &amp; Veranda</div>
                      <div className="world-sector-list" style={{ marginTop: 6 }}>
                        {HOUSE_SIZE_DEFS.map((sz) => {
                          const owned = labDecor.houseSize >= sz.level;
                          const isNext = sz.level === labDecor.houseSize + 1;
                          const canAfford =
                            standaloneMode || !onSpendCoinsForTreat || labSparks >= sz.costSparks;
                          return (
                            <div key={sz.level} className={`expand-room-card ${owned ? "is-owned" : ""}`}>
                              <div className="expand-room-top">
                                <div>
                                  <strong>
                                    Lv.{sz.level} {sz.title}
                                  </strong>
                                  <span className="world-pill-muted" style={{ marginLeft: 6 }}>
                                    {sz.footprintLabel}
                                  </span>
                                  <div className="tama-sub">{sz.desc}</div>
                                </div>
                                {owned ? (
                                  <span className="built-pill">
                                    <Check size={11} /> Built
                                  </span>
                                ) : isNext && !isVisiting ? (
                                  <button
                                    type="button"
                                    className="sector-btn clickable"
                                    disabled={!canAfford}
                                    onClick={() => handleExpandHouseSize(sz.level)}
                                  >
                                    <Sparkles size={11} />{" "}
                                    {standaloneMode ? "Expand Free" : `${sz.costSparks} sparks`}
                                  </button>
                                ) : (
                                  <span className="world-pill-muted">Unlock Lv.{sz.level - 1} first</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 2. Multi-Story Walkable Floors (B1 Basement -> 1F -> 2F Loft -> 3F Sky Penthouse) */}
                    <div className="expand-section-card">
                      <div className="single-kicker">
                        Multi-Story Architect Levels · Walkable Steps &amp; Basement
                      </div>
                      <div className="world-sector-list" style={{ marginTop: 6 }}>
                        {labDecor.hasBasement && (
                          <div className="expand-room-card is-owned">
                            <div className="expand-room-top">
                              <div>
                                <strong>{HOUSE_BASEMENT_DEF.title}</strong>
                                <div className="tama-sub">{HOUSE_BASEMENT_DEF.desc}</div>
                              </div>
                              <button
                                type="button"
                                className={`subtle-pill-btn clickable ${
                                  activeFloor === 0 ? "active" : ""
                                }`}
                                style={{ padding: "4px 10px", fontSize: "0.7rem" }}
                                onClick={() => handleSwitchFloor(0)}
                              >
                                {activeFloor === 0 ? "Here" : "Go B1"}
                              </button>
                            </div>
                          </div>
                        )}
                        {HOUSE_FLOOR_DEFS.map((fl) => {
                          const owned = labDecor.houseFloors >= fl.floors;
                          const isNext = fl.floors === labDecor.houseFloors + 1;
                          const canAfford =
                            standaloneMode || !onSpendCoinsForTreat || labSparks >= fl.costSparks;
                          return (
                            <div key={fl.floors} className={`expand-room-card ${owned ? "is-owned" : ""}`}>
                              <div className="expand-room-top">
                                <div>
                                  <strong>{fl.title}</strong>
                                  <div className="tama-sub">{fl.desc}</div>
                                </div>
                                {owned ? (
                                  <button
                                    type="button"
                                    className={`subtle-pill-btn clickable ${
                                      activeFloor === fl.floors ? "active" : ""
                                    }`}
                                    style={{ padding: "4px 10px", fontSize: "0.7rem" }}
                                    onClick={() => handleSwitchFloor(fl.floors)}
                                  >
                                    {activeFloor === fl.floors ? "Here" : `Go ${fl.floors}F`}
                                  </button>
                                ) : isNext && !isVisiting ? (
                                  <button
                                    type="button"
                                    className="sector-btn clickable"
                                    disabled={!canAfford}
                                    onClick={() => handleAddHouseFloor(fl.floors)}
                                  >
                                    <Sparkles size={11} />{" "}
                                    {standaloneMode ? `Add ${fl.floors}F` : `${fl.costSparks} sparks`}
                                  </button>
                                ) : (
                                  <span className="world-pill-muted">Build {fl.floors - 1}F first</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 3. 6 Cozy Unlockable Interior Rooms */}
                    <div className="expand-section-card">
                      <div className="single-kicker">
                        Cozy Homely Rooms ({labDecor.extraRooms.length}/{EXTRA_ROOM_DEFS.length} Built)
                      </div>
                      <div className="world-sector-list" style={{ marginTop: 6 }}>
                        {EXTRA_ROOM_DEFS.map((room) => {
                          const owned = labDecor.extraRooms.includes(room.id);
                          const canAfford =
                            standaloneMode || !onSpendCoinsForTreat || labSparks >= room.costSparks;
                          const RIcon =
                            room.id === "bedroom"
                              ? Moon
                              : room.id === "kitchen"
                                ? Coffee
                                : room.id === "spa"
                                  ? Sparkles
                                  : room.id === "hearth"
                                    ? Flame
                                    : room.id === "pergola"
                                      ? Flower2
                                      : Music;
                          return (
                            <div key={room.id} className={`expand-room-card ${owned ? "is-owned" : ""}`}>
                              <div className="expand-room-top">
                                <span
                                  className="cute-icon-bubble is-sm"
                                  style={{ "--bubble-accent": room.accent } as React.CSSProperties}
                                >
                                  <RIcon size={11} />
                                </span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <strong>{room.name}</strong>
                                  <div className="tama-sub">
                                    {room.desc} · <strong>{room.perk}</strong>
                                  </div>
                                </div>
                                {owned ? (
                                  <button
                                    type="button"
                                    className="subtle-pill-btn clickable"
                                    style={{ padding: "4px 9px", fontSize: "0.7rem" }}
                                    onClick={() => {
                                      setActiveFloor(1);
                                      setCameraMode("follow");
                                      artworkRef.current?.performSimsAction({
                                        x: room.standX,
                                        z: room.standZ,
                                        floor: 1,
                                        yaw: room.yaw,
                                        emote: "wave"
                                      });
                                      setOpenStation(null);
                                      soundEngine.playTap(1046.5);
                                    }}
                                  >
                                    Visit
                                  </button>
                                ) : !isVisiting ? (
                                  <button
                                    type="button"
                                    className="sector-btn clickable"
                                    disabled={!canAfford}
                                    onClick={() => handleUnlockExtraRoom(room.id)}
                                  >
                                    <Sparkles size={11} />{" "}
                                    {standaloneMode ? "Add Free" : `${room.costSparks} sparks`}
                                  </button>
                                ) : (
                                  <span className="world-pill-muted">Not built</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: FREE-PLACEMENT MOVER FOR EVERY STATION & FURNITURE ITEM! */}
                {builderSubTab === "move" && (
                  <div className="world-drawer-stack">
                    <div className="furnish-header-row">
                      <span className="single-kicker">
                        Move Any Station or Furniture (B1–{labDecor.houseFloors}F)
                      </span>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          type="button"
                          className={`subtle-pill-btn clickable ${moveSnapGrid ? "active" : ""}`}
                          style={{ padding: "4px 8px", fontSize: "0.68rem" }}
                          onClick={() => setMoveSnapGrid((v) => !v)}
                        >
                          <Grid2x2 size={11} /> Snap
                        </button>
                        {!isVisiting && (
                          <button
                            type="button"
                            className="subtle-pill-btn clickable"
                            style={{ padding: "4px 8px", fontSize: "0.68rem" }}
                            onClick={handleResetAllLayout}
                            title="Reset every station & furniture piece back to spacious defaults"
                          >
                            <RotateCcw size={11} /> Reset All
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="science-summary" style={{ margin: 0 }}>
                      Click <strong>Move</strong> on any tabletop station or furniture set, then click
                      anywhere in your B1 basement, 1F living hall, 2F loft, or 3F sky penthouse!
                    </p>

                    <div className="world-sector-list">
                      {MOVABLE_ITEMS.map((item) => {
                        const pos = resolveItemPlacement(item.id, labDecor.customLayout);
                        const isCustomized = Boolean(labDecor.customLayout[item.id]);
                        return (
                          <div key={item.id} className="move-item-row">
                            <span
                              className="cause-dot"
                              style={{ background: item.accent, flexShrink: 0 }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="neighbor-card-title">
                                <strong>{item.label}</strong>
                                <span className="move-floor-badge">{formatFloorLabel(pos.floor)}</span>
                              </div>
                              <div className="tama-sub">
                                {item.category === "station" ? "Station" : "Furniture"} · (
                                {pos.x.toFixed(1)}, {pos.z.toFixed(1)})
                              </div>
                            </div>
                            {!isVisiting && (
                              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                                <button
                                  type="button"
                                  className="sector-btn clickable"
                                  style={{ padding: "4px 9px", fontSize: "0.68rem" }}
                                  onClick={() => startMovingItem(item.id)}
                                >
                                  <Move size={10} /> Move
                                </button>
                                <button
                                  type="button"
                                  className="inline-icon-btn clickable"
                                  onClick={() => handleRotateMovedItem(item.id)}
                                  title="Rotate 45°"
                                  aria-label={`Rotate ${item.label}`}
                                >
                                  <RotateCw size={11} />
                                </button>
                                {isCustomized && (
                                  <button
                                    type="button"
                                    className="inline-icon-btn clickable"
                                    onClick={() => handleResetItemLayout(item.id)}
                                    title="Reset default spot"
                                    aria-label={`Reset ${item.label}`}
                                  >
                                    <RotateCcw size={11} />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* TAB 4: PROGRESSIVE 3D STATION HARDWARE UPGRADES + ON-CHAIN WINGS */}
                {builderSubTab === "upgrades" && (
                  <div className="world-drawer-stack">
                    <div className="upgrade-summary-strip">
                      <span className="upgrade-perk-pill">
                        <Pickaxe size={10} /> Mining x{stationBonuses.miningMult}
                      </span>
                      <span className="upgrade-perk-pill">
                        <Brain size={10} /> Focus x{stationBonuses.focusMult}
                      </span>
                      <span className="upgrade-perk-pill">
                        <Zap size={10} /> Rest x{stationBonuses.energyFunMult}
                      </span>
                      <span className="upgrade-perk-pill">
                        <PawPrint size={10} /> Pet +{stationBonuses.petBoostBonus.toFixed(2)}x
                      </span>
                    </div>

                    <div className="world-sector-list">
                      {STATION_UPGRADE_DEFS.map((def) => {
                        const lvl = labDecor.stationUpgrades[def.id];
                        const curTier = def.tiers[lvl - 1];
                        const nextTier = lvl === 1 ? def.tiers[1] : lvl === 2 ? def.tiers[2] : null;
                        const cost = getNextUpgradeCost(lvl);
                        const canAfford = standaloneMode || !onSpendCoinsForTreat || (cost !== null && labSparks >= cost);
                        const StIcon =
                          def.id === "research"
                            ? Microscope
                            : def.id === "mining"
                              ? Pickaxe
                              : def.id === "pet"
                                ? PawPrint
                                : def.id === "builder"
                                  ? Building2
                                  : Sofa;

                        return (
                          <div key={def.id} className="upgrade-station-card">
                            <div className="upgrade-station-head">
                              <span
                                className="cute-icon-bubble"
                                style={{ "--bubble-accent": def.accent } as React.CSSProperties}
                              >
                                <StIcon size={13} />
                              </span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div className="neighbor-card-title">
                                  <strong>{def.name}</strong>
                                  <span className="upgrade-stars" aria-label={`Level ${lvl} of 3`}>
                                    {[1, 2, 3].map((pip) => (
                                      <Star
                                        key={pip}
                                        size={11}
                                        className={`upgrade-star-pip ${pip <= lvl ? "filled" : ""}`}
                                      />
                                    ))}
                                  </span>
                                </div>
                                <div className="tama-sub">
                                  Lv.{lvl} {curTier.title} · {curTier.perk}
                                </div>
                              </div>
                            </div>

                            {nextTier && cost !== null ? (
                              <div className="upgrade-next-box">
                                <div>
                                  <div className="upgrade-next-title">
                                    Next: Lv.{nextTier.level} {nextTier.title}
                                  </div>
                                  <div className="tama-sub">
                                    3D: {nextTier.hardware} · <strong>{nextTier.perk}</strong>
                                  </div>
                                </div>
                                {!isVisiting && (
                                  <button
                                    type="button"
                                    className="sector-btn clickable"
                                    disabled={!canAfford}
                                    onClick={() => handleUpgradeStation(def.id)}
                                  >
                                    <Sparkles size={11} />{" "}
                                    {standaloneMode ? `Unlock Lv.${nextTier.level}` : `${cost} sparks`}
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="upgrade-action-row">
                                <span className="tama-sub">{curTier.hardware}</span>
                                <span className="built-pill">
                                  <Check size={11} /> Max Lv. 3
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="builder-head" style={{ marginTop: 6 }}>
                      <span>
                        {isVisiting
                          ? `${visitingHostProfile?.name || "Host"}'s home · ${builtCount} of 6 on-chain wings`
                          : `On-Chain Architectural Wings · ${builtCount} of 6 built`}
                      </span>
                      {onUpgradeVessel && !isVisiting && tier < 5 && (
                        <button
                          type="button"
                          className="sector-btn eth clickable"
                          onClick={async () => {
                            const nextTargetUsd =
                              tier === 1 ? 5 : tier === 2 ? 25 : tier === 3 ? 100 : 500;
                            const delta = Math.max(1, nextTargetUsd - vessel.valueUsd);
                            try {
                              await onUpgradeVessel(vessel, delta);
                              soundEngine.playBuildRoom();
                              setFeedback(`Upgraded Lab #${vessel.tokenId} to Level ${tier + 1}.`);
                            } catch (err) {
                              setFeedback(
                                err instanceof Error ? err.message : "Upgrade cancelled."
                              );
                            }
                          }}
                        >
                          <ArrowUpCircle
                            size={11}
                            style={{ verticalAlign: "-1px", marginRight: 4 }}
                          />
                          Level {tier + 1} (+$
                          {Math.max(
                            1,
                            (tier === 1 ? 5 : tier === 2 ? 25 : tier === 3 ? 100 : 500) -
                              vessel.valueUsd
                          )}
                          )
                        </button>
                      )}
                    </div>

                    <div className="world-sector-list">
                      {LAB_SECTORS.map((sector) => {
                        const built = hasSector(activeVessel.sectorsMask, sector.id);
                        const canAffordCoins = userCoinBalance >= sector.coinCost;

                        return (
                          <div
                            key={sector.id}
                            className={`sector-card ${built ? "is-built" : ""} ${
                              previewSectorId === sector.id ? "is-previewing" : ""
                            }`}
                            onMouseEnter={() => {
                              if (!built) setPreviewSectorId(sector.id);
                            }}
                            onMouseLeave={() => {
                              if (previewSectorId === sector.id) setPreviewSectorId(null);
                            }}
                          >
                            <div className="sector-top">
                              <span className="sector-name">
                                <span
                                  className="cause-dot"
                                  style={{ background: sector.accent }}
                                />
                                {sector.name}
                              </span>
                              <span className="sector-bonus">
                                +{sector.miningBonusPerHour} ALCH/hr
                              </span>
                            </div>
                            <p className="sector-desc">{sector.role}</p>
                            <div className="sector-bottom">
                              <span className="sector-effect">{sector.researchEffect}</span>
                              {built ? (
                                <span className="built-pill">
                                  <Check size={12} /> Built
                                </span>
                              ) : onBuildSector && !isVisiting ? (
                                <div style={{ display: "flex", gap: 6 }}>
                                  <button
                                    type="button"
                                    className="sector-btn clickable"
                                    disabled={!canAffordCoins}
                                    onClick={async () => {
                                      try {
                                        await onBuildSector(vessel, sector.id, true);
                                        setPreviewSectorId(null);
                                        markGoalDone("room");
                                        setFeedback(
                                          `Added ${sector.name} to Lab #${vessel.tokenId}.`
                                        );
                                      } catch (err) {
                                        setFeedback(
                                          err instanceof Error
                                            ? err.message
                                            : "Could not build room."
                                        );
                                      }
                                    }}
                                  >
                                    {sector.coinCost} ALCH
                                  </button>
                                  <button
                                    type="button"
                                    className="sector-btn eth clickable"
                                    onClick={async () => {
                                      try {
                                        await onBuildSector(vessel, sector.id, false);
                                        setPreviewSectorId(null);
                                        markGoalDone("room");
                                        setFeedback(
                                          `Added ${sector.name} to Lab #${vessel.tokenId}.`
                                        );
                                      } catch (err) {
                                        setFeedback(
                                          err instanceof Error
                                            ? err.message
                                            : "Could not build room."
                                        );
                                      }
                                    }}
                                  >
                                    ${sector.ethCostUsd}
                                  </button>
                                </div>
                              ) : (
                                <span className="sector-effect">Unbuilt lot</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STATION 5: SIMS STATUS, MOODS, RELATIONSHIPS, QUICK RENAME, GUESTBOOK & STUDIO */}
            {openStation === "console" && (
              <div className="world-drawer-stack">
                <div className="builder-subtabs builder-subtabs-3" role="tablist" aria-label="Sims status tabs">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={consoleSubTab === "sims"}
                    className={`builder-subtab clickable ${consoleSubTab === "sims" ? "active" : ""}`}
                    onClick={() => {
                      setConsoleSubTab("sims");
                      soundEngine.playTap(987.77);
                    }}
                  >
                    <Smile size={12} /> Moods
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={consoleSubTab === "friends"}
                    className={`builder-subtab clickable ${consoleSubTab === "friends" ? "active" : ""}`}
                    onClick={() => {
                      setConsoleSubTab("friends");
                      soundEngine.playTap(1046.5);
                    }}
                  >
                    <Heart size={12} /> Friends
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={consoleSubTab === "studio"}
                    className={`builder-subtab clickable ${consoleSubTab === "studio" ? "active" : ""}`}
                    onClick={() => {
                      setConsoleSubTab("studio");
                      soundEngine.playTap(880);
                    }}
                  >
                    <BookOpen size={12} /> Studio
                  </button>
                </div>

                {/* SUB-TAB 1: YOUR SIMS STATUS, QUICK RENAME, PERSONALITY TRAIT, NEEDS & MOOD SHIFTER */}
                {consoleSubTab === "sims" && (
                  <div className="world-drawer-stack">
                    {savedProfile && (
                      <div className="world-profile-card">
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {quickNameEditing ? (
                            <form className="pet-name-form" onSubmit={handleQuickRename}>
                              <input
                                type="text"
                                value={quickNameDraft}
                                maxLength={20}
                                onChange={(e) => setQuickNameDraft(e.target.value)}
                                autoFocus
                                className="pet-name-input"
                                aria-label="Character name"
                              />
                              <button type="submit" className="sector-btn clickable">
                                Save
                              </button>
                            </form>
                          ) : (
                            <div className="tama-title-row">
                              <span className="tama-title" style={{ fontSize: "1.2rem" }}>
                                {savedProfile.name}
                              </span>
                              <button
                                type="button"
                                className="inline-icon-btn clickable"
                                onClick={() => {
                                  setQuickNameDraft(savedProfile.name);
                                  setQuickNameEditing(true);
                                }}
                                title="Rename character"
                                aria-label="Rename character"
                              >
                                <Pencil size={12} />
                              </button>
                            </div>
                          )}
                          <div className="tama-sub">
                            {savedProfile.title} ·{" "}
                            {PERSONALITY_TRAITS.find((t) => t.id === (savedProfile.trait || "genius"))
                              ?.label || "Genius"}{" "}
                            · Lab #{vessel.tokenId}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="subtle-pill-btn clickable"
                          onClick={openCharacterCreator}
                        >
                          <UserRound size={12} /> Wardrobe
                        </button>
                      </div>
                    )}

                    {/* Live Sims Mood Card & 4 Needs Bars */}
                    <div
                      className="sims-mood-hero"
                      style={{ borderColor: `${simsMood.plumbobHex}66` }}
                    >
                      <div className="sims-mood-hero-top">
                        <span
                          className="sims-plumbob-chip"
                          style={{ "--plumbob": simsMood.plumbobHex } as React.CSSProperties}
                        >
                          <svg viewBox="0 0 16 24" className="sims-plumbob-icon" aria-hidden="true">
                            <polygon points="8,1 15,12 8,23 1,12" fill={simsMood.plumbobHex} />
                            <polygon points="8,1 15,12 8,14" fill="rgba(255,255,255,0.42)" />
                          </svg>
                          <strong style={{ fontSize: "0.92rem" }}>{simsMood.name}</strong>
                        </span>
                        {activeMoodlet && activeMoodlet.expiresAtMs > nowTick && (
                          <span
                            className="sims-activity-pill"
                            style={{ background: simsMood.plumbobHex }}
                          >
                            +{activeMoodlet.label}
                          </span>
                        )}
                      </div>
                      <p className="tama-sub" style={{ marginTop: 4 }}>
                        {simsMood.tagline}
                      </p>

                      <div className="tama-bars" style={{ marginTop: 10 }}>
                        <div className="tama-bar-item">
                          <span>Energy {simsVibes.energy}%</span>
                          <div className="mini-track">
                            <div
                              className="mini-fill"
                              style={{ width: `${simsVibes.energy}%`, background: "#10b981" }}
                            />
                          </div>
                        </div>
                        <div className="tama-bar-item">
                          <span>Focus {simsVibes.focus}%</span>
                          <div className="mini-track">
                            <div
                              className="mini-fill"
                              style={{ width: `${simsVibes.focus}%`, background: "#38bdf8" }}
                            />
                          </div>
                        </div>
                        <div className="tama-bar-item">
                          <span>Social {simsVibes.social}%</span>
                          <div className="mini-track">
                            <div
                              className="mini-fill"
                              style={{ width: `${simsVibes.social}%`, background: "#f472b6" }}
                            />
                          </div>
                        </div>
                        <div className="tama-bar-item">
                          <span>Fun {simsVibes.fun}%</span>
                          <div className="mini-track">
                            <div
                              className="mini-fill"
                              style={{ width: `${simsVibes.fun}%`, background: "#a855f7" }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 1-Click Mood Shifter */}
                    <div>
                      <div className="single-kicker" style={{ marginBottom: 7 }}>
                        Change Mood (Live 3D Plumbob &amp; Emote)
                      </div>
                      <div className="mood-shift-grid">
                        {MOOD_SHIFT_ACTIONS.map((act) => {
                          const vis = SIMS_MOOD_VISUALS[act.mood];
                          const isCurrent = simsMood.name === act.mood;
                          return (
                            <button
                              key={act.id}
                              type="button"
                              className={`mood-shift-btn clickable ${isCurrent ? "active" : ""}`}
                              style={{ "--mood-hex": vis.plumbobHex } as React.CSSProperties}
                              onClick={() => handleShiftMood(act)}
                            >
                              <span
                                className="cause-dot"
                                style={{ background: vis.plumbobHex }}
                              />
                              <div>
                                <strong>{act.mood}</strong>
                                <small>{act.label}</small>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Personality Trait Selector */}
                    <div>
                      <div className="single-kicker" style={{ marginBottom: 7 }}>
                        Personality Trait
                      </div>
                      <div className="creator-chip-grid">
                        {PERSONALITY_TRAITS.map((tr) => (
                          <button
                            key={tr.id}
                            type="button"
                            title={tr.desc}
                            className={`creator-chip clickable ${
                              (savedProfile?.trait || "genius") === tr.id ? "active" : ""
                            }`}
                            onClick={() => handleChangeTrait(tr.id)}
                          >
                            {tr.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* SUB-TAB 2: SIMS RELATIONSHIPS & NEIGHBOR STATUSES */}
                {consoleSubTab === "friends" && (
                  <div className="world-drawer-stack">
                    <div className="single-kicker">
                      Town Relationships &amp; Live Neighbor Moods ({neighbors.length} residents)
                    </div>
                    <div className="world-sector-list">
                      {neighbors
                        .slice(0, 16)
                        .map((lab) => ({
                          lab,
                          npc: deriveNeighborCharacterProfile(lab),
                          status: getNeighborSimsStatus(lab.tokenId, lab.seed, relationsMap)
                        }))
                        .sort((a, b) => b.status.score - a.status.score)
                        .map(({ lab, npc, status }) => (
                          <div key={lab.tokenId} className="neighbor-card">
                            <div className="neighbor-card-head">
                              <span
                                className="cause-dot"
                                style={{ background: status.plumbobHex }}
                                title={`Current mood: ${status.mood}`}
                              />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div className="neighbor-card-title">
                                  <strong>
                                    {npc.name} <small style={{ fontWeight: 500 }}>· #{lab.tokenId}</small>
                                  </strong>
                                  <span
                                    className="rel-tier-badge"
                                    style={{
                                      color: status.tierColor,
                                      borderColor: `${status.tierColor}66`
                                    }}
                                  >
                                    {status.tier}
                                  </span>
                                </div>
                                <div className="tama-sub">
                                  {status.mood} · {status.traitLabel} · {status.activity}
                                </div>
                              </div>
                            </div>

                            <div className="rel-meter-row">
                              <div className="mini-track" style={{ flex: 1 }}>
                                <div
                                  className="mini-fill"
                                  style={{
                                    width: `${Math.max(4, status.score)}%`,
                                    background: status.tierColor
                                  }}
                                />
                              </div>
                              <span className="rel-score-text">{status.score}/100</span>
                            </div>

                            <div className="neighbor-card-actions">
                              <button
                                type="button"
                                className="subtle-pill-btn clickable"
                                onClick={() => performNeighborSocial(lab.tokenId, "chat")}
                              >
                                <MessageCircle size={11} /> Chat
                              </button>
                              <button
                                type="button"
                                className="subtle-pill-btn clickable"
                                onClick={() => performNeighborSocial(lab.tokenId, "joke")}
                              >
                                <Smile size={11} /> Joke
                              </button>
                              <button
                                type="button"
                                className="subtle-pill-btn clickable"
                                onClick={() => handleSendNeighborSpark(lab.tokenId)}
                              >
                                <Sparkles size={11} /> Spark
                              </button>
                              <button
                                type="button"
                                className="sector-btn clickable"
                                onClick={() => handleEnterNeighborHome(lab)}
                              >
                                <DoorOpen size={11} /> Visit
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* SUB-TAB 3: COZY LAB GUESTBOOK, GOALS & STUDIO CAMERA */}
                {consoleSubTab === "studio" && (
                  <div className="world-drawer-stack">
                    <div className={`world-goals-block ${guestbookOpen ? "guestbook-highlighted" : ""}`}>
                      <div
                        className="single-kicker"
                        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}
                      >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <BookOpen size={12} /> Lab #{activeVessel.tokenId} Guestbook ·{" "}
                          {guestbookEntries.length} notes
                        </span>
                        {isVisiting && (
                          <button
                            type="button"
                            className="sector-btn clickable"
                            style={{ padding: "3px 8px", fontSize: "0.66rem" }}
                            onClick={handleReturnHome}
                          >
                            <Home size={10} /> Go Home
                          </button>
                        )}
                      </div>
                      <form className="guestbook-form" onSubmit={handleSignGuestbook}>
                        <input
                          type="text"
                          value={guestbookDraft}
                          maxLength={140}
                          onChange={(e) => setGuestbookDraft(e.target.value)}
                          placeholder={
                            isVisiting
                              ? `Leave a cozy note for ${visitingHostProfile?.name || "your host"}…`
                              : "Write a welcome note for visiting neighbors…"
                          }
                          className="guestbook-input"
                          aria-label="Guestbook message"
                        />
                        <button type="submit" className="sector-btn clickable">
                          Sign
                        </button>
                      </form>
                      <div className="guestbook-list">
                        {guestbookEntries.slice(0, 6).map((note) => (
                          <div key={note.id} className="guestbook-entry">
                            <div className="guestbook-entry-head">
                              <span className="cause-dot" style={{ background: note.accent }} />
                              <strong>{note.authorName}</strong>
                              <span className="tama-sub">{note.authorTitle}</span>
                            </div>
                            <p className="guestbook-entry-msg">{note.message}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="world-goals-block">
                      <div className="single-kicker" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <ListChecks size={12} /> Lab goals · {goalsDoneCount} of 5
                      </div>
                      <div className="goals-list" style={{ marginTop: 6, paddingTop: 6 }}>
                        {(
                          [
                            { key: "pet", label: "Pet or play with your lab companion" },
                            { key: "proton", label: "Pop a floating proton inside 3D" },
                            { key: "fold", label: "Wiggle or shake the live protein chain" },
                            { key: "claim", label: "Claim mined ALCH coins" },
                            { key: "room", label: "Build your first architectural room" }
                          ] as const
                        ).map((g) => (
                          <div key={g.key} className={`goal-row ${effectiveGoals[g.key] ? "done" : ""}`}>
                            <span className="goal-check">
                              {effectiveGoals[g.key] ? <Check size={11} /> : null}
                            </span>
                            <span>{g.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="single-kicker" style={{ marginBottom: 8 }}>
                        Studio &amp; Camera
                      </div>
                      <div className="tama-actions">
                        <button type="button" className="subtle-pill-btn clickable" onClick={cycleLighting}>
                          <Sun size={12} /> Light: {LIGHTING_LABELS[lightingMood]}
                        </button>
                        <button type="button" className="subtle-pill-btn clickable" onClick={cycleAtmosphere}>
                          <CloudSnow size={12} /> Air: {ATMOSPHERE_LABELS[atmosphereMode]}
                        </button>
                        <button type="button" className="subtle-pill-btn clickable" onClick={handleSavePhoto}>
                          <Camera size={12} /> Save PNG
                        </button>
                        <button
                          type="button"
                          className={`subtle-pill-btn clickable ${cameraMode === "follow" ? "active" : ""}`}
                          onClick={() => {
                            setCameraMode("follow");
                            soundEngine.playTap(880);
                          }}
                        >
                          <Footprints size={12} /> Follow Cam
                        </button>
                        <button
                          type="button"
                          className={`subtle-pill-btn clickable ${cameraMode === "orbit" ? "active" : ""}`}
                          onClick={() => {
                            setCameraMode("orbit");
                            soundEngine.playTap(880);
                          }}
                        >
                          <Compass size={12} /> Orbit Cam
                        </button>
                        <button
                          type="button"
                          className="subtle-pill-btn clickable"
                          onClick={() => {
                            const fresh = saveOnboardingState(createInitialOnboardingState());
                            setOnboarding(fresh);
                            setOpenStation(null);
                            soundEngine.playTap(1046.5);
                            setFeedback("Reopened the interactive Welcome Guide!");
                          }}
                        >
                          <Sparkles size={12} /> Replay Guide
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      )}

      {/* Layer 3.5: Living Minted NFT Neighborhood Directory & Neighbor Inspector */}
      {!creatorOpen && !openStation && neighborhoodDrawerOpen && (
        <aside className="glass-panel world-station-drawer" aria-label="Minted NFT Neighborhood">
          <div className="world-drawer-head">
            <div className="world-drawer-title-group">
              <span className="drawer-icon-medallion" style={{ "--bubble-accent": "#38bdf8" } as React.CSSProperties}>
                <MapPin size={17} />
              </span>
              <div>
                <div className="single-kicker">
                  {townGrowth.title} · {neighbors.length + 1} Minted Homes
                </div>
                <h3 className="world-drawer-title">Alchemia Town</h3>
              </div>
            </div>
            <button
              type="button"
              className="inline-icon-btn clickable"
              onClick={() => {
                setNeighborhoodDrawerOpen(false);
                setInspectedNeighbor(null);
                setCameraMode("follow");
              }}
              aria-label="Close neighborhood panel"
            >
              <X size={14} />
            </button>
          </div>

          <div className="world-drawer-scroll">
            <div className="world-drawer-stack">
              <div className="builder-subtabs" role="tablist" aria-label="Town & Parks view">
                <button
                  type="button"
                  role="tab"
                  aria-selected={townSubTab === "town"}
                  className={`builder-subtab clickable ${townSubTab === "town" ? "active" : ""}`}
                  onClick={() => {
                    setTownSubTab("town");
                    soundEngine.playTap(987.77);
                  }}
                >
                  <MapPin size={12} /> Town ({neighbors.length + 1})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={townSubTab === "gardens"}
                  className={`builder-subtab clickable ${townSubTab === "gardens" ? "active" : ""}`}
                  onClick={() => {
                    setTownSubTab("gardens");
                    soundEngine.playTap(1046.5);
                  }}
                >
                  <Flower2 size={12} /> Parks &amp; Gardens
                  {readyGardenCount > 0 ? ` (${readyGardenCount}!)` : ""}
                </button>
              </div>

              {townSubTab === "gardens" ? (
                <div className="world-drawer-stack">
                  {/* 4 Walkable Botanical Town Parks */}
                  <div className="expand-section-card">
                    <div className="single-kicker">
                      4 Walkable Town Parks &amp; Glass Conservatory
                    </div>
                    <div className="world-sector-list" style={{ marginTop: 6 }}>
                      {TOWN_PARKS.map((park) => (
                        <div key={park.id} className="park-card">
                          <span
                            className="cute-icon-bubble is-sm"
                            style={{ "--bubble-accent": park.accent } as React.CSSProperties}
                          >
                            <Trees size={11} />
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <strong>{park.name}</strong>
                            <div className="tama-sub">{park.subtitle}</div>
                          </div>
                          <button
                            type="button"
                            className="sector-btn clickable"
                            style={{ padding: "4px 9px", fontSize: "0.68rem" }}
                            onClick={() => handleWalkToPark(park.id)}
                          >
                            <Footprints size={10} /> Walk
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Seed Packet Picker + Bulk Water/Harvest Controls */}
                  <div className="expand-section-card">
                    <div className="furnish-header-row">
                      <span className="single-kicker">Choose Seed Packet (8 Species)</span>
                      <div style={{ display: "flex", gap: 5 }}>
                        <button
                          type="button"
                          className="subtle-pill-btn clickable"
                          style={{ padding: "3px 8px", fontSize: "0.68rem" }}
                          onClick={handleWaterAllPlots}
                        >
                          <Droplets size={10} /> Water All
                        </button>
                        <button
                          type="button"
                          className="sector-btn clickable"
                          style={{ padding: "3px 8px", fontSize: "0.68rem" }}
                          onClick={handleHarvestAllPlots}
                        >
                          <Sparkles size={10} /> Harvest{readyGardenCount > 0 ? ` (${readyGardenCount})` : ""}
                        </button>
                      </div>
                    </div>
                    <div className="seed-chip-grid" style={{ marginTop: 7 }}>
                      {PLANT_SPECIES.map((sp) => {
                        const selected = gardenState.selectedSeed === sp.id;
                        return (
                          <button
                            key={sp.id}
                            type="button"
                            className={`seed-chip clickable ${selected ? "active" : ""}`}
                            onClick={() => {
                              setGardenState((prev) =>
                                saveGardenState(activeVessel.tokenId, { ...prev, selectedSeed: sp.id })
                              );
                              soundEngine.playTap(987.77);
                            }}
                            title={`${sp.desc} · ${sp.growSeconds}s · +${sp.harvestSparks} sparks`}
                          >
                            <span className="cause-dot" style={{ background: sp.petalHex }} />
                            <span>{sp.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* All 10 Live Growing Garden Beds (4 Home Courtyard + 6 Botanical Park!) */}
                  <div className="expand-section-card">
                    <div className="single-kicker">
                      Home Courtyard &amp; Park Allotment Beds ({GARDEN_PLOT_DEFS.length})
                    </div>
                    <div className="world-sector-list" style={{ marginTop: 6 }}>
                      {GARDEN_PLOT_DEFS.map((def) => {
                        const plot = gardenState.plots[def.id];
                        const snap = computePlotGrowth(plot, nowTick);
                        const pct = Math.round(snap.progress * 100);
                        return (
                          <div key={def.id} className="garden-plot-card">
                            <div className="expand-room-top">
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div className="neighbor-card-title">
                                  <strong>{def.label}</strong>
                                  <span className="move-floor-badge">
                                    {def.zone === "home" ? "Home" : "Park"}
                                  </span>
                                </div>
                                <div className="tama-sub">
                                  {snap.species
                                    ? snap.readyToHarvest
                                      ? `${snap.species.name} · Full Bloom! (+${snap.species.harvestSparks} sparks)`
                                      : `${snap.species.name} · ${pct}% (${snap.secondsLeft}s left)`
                                    : "Empty sunlit soil — ready for seeds"}
                                </div>
                              </div>
                              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                                {!snap.species ? (
                                  <button
                                    type="button"
                                    className="sector-btn clickable"
                                    style={{ padding: "4px 9px", fontSize: "0.68rem" }}
                                    onClick={() => handlePlantSeed(def.id, gardenState.selectedSeed)}
                                  >
                                    <Sprout size={10} /> Plant
                                  </button>
                                ) : snap.readyToHarvest ? (
                                  <button
                                    type="button"
                                    className="sector-btn clickable"
                                    style={{ padding: "4px 9px", fontSize: "0.68rem" }}
                                    onClick={() => handleHarvestPlot(def.id)}
                                  >
                                    <Sparkles size={10} /> Harvest
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      className="subtle-pill-btn clickable"
                                      style={{ padding: "4px 8px", fontSize: "0.68rem" }}
                                      onClick={() => handleWaterPlot(def.id)}
                                      title="Water plant (+36% growth)"
                                    >
                                      <Droplets size={10} /> Water
                                    </button>
                                    <button
                                      type="button"
                                      className="inline-icon-btn clickable"
                                      onClick={() => handleFertilizePlot(def.id)}
                                      title="Crystal mist — instant bloom"
                                      aria-label={`Instant bloom ${def.label}`}
                                    >
                                      <Sparkles size={11} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                            {snap.species && (
                              <div className="garden-progress-track">
                                <div
                                  className="garden-progress-fill"
                                  style={{
                                    width: `${Math.max(6, pct)}%`,
                                    background: snap.species.petalHex
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Botanical Almanac (8 Collectible Species) */}
                  <div className="expand-section-card">
                    <div className="single-kicker">
                      Botanical Almanac · {gardenState.totalHarvests} Total Harvests
                    </div>
                    <div className="almanac-grid" style={{ marginTop: 6 }}>
                      {PLANT_SPECIES.map((sp) => {
                        const cnt = gardenState.harvestedCounts[sp.id] ?? 0;
                        return (
                          <div key={sp.id} className={`almanac-badge ${cnt > 0 ? "collected" : ""}`}>
                            <span className="cause-dot" style={{ background: sp.petalHex }} />
                            <span>{sp.name}</span>
                            <strong>×{cnt}</strong>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <>
              {/* Live Town Growth Progress & Civic Milestone Unlocks */}
              <div className="town-growth-card">
                <div className="town-growth-head">
                  <strong>
                    Stage {townGrowth.level}/5 · {townGrowth.title}
                  </strong>
                  <span>
                    {townGrowth.nextMilestone
                      ? `${neighbors.length + 1} / ${townGrowth.nextMilestone} mints`
                      : `${neighbors.length + 1} mints · Max Tier`}
                  </span>
                </div>
                <p className="town-growth-sub">{townGrowth.subtitle}</p>
                <div className="town-growth-track">
                  <div
                    className="town-growth-fill"
                    style={{ width: `${Math.max(8, townGrowth.progressPct)}%` }}
                  />
                </div>
                <div className="wing-tags" style={{ marginTop: 8 }}>
                  <span className="wing-tag built">
                    ● {impact.mode === "simulation" ? "Live Growth Sim" : "Live On-Chain Sync"}
                  </span>
                  <span className={`wing-tag ${townGrowth.transitUnlocked ? "built" : ""}`}>
                    {townGrowth.transitUnlocked ? "● " : "○ "}Hover-Shuttle (10+)
                  </span>
                  <span className={`wing-tag ${activeExpansionBands > 0 ? "built" : ""}`}>
                    {activeExpansionBands > 0
                      ? `● ${activeExpansionBands} Outer Road Ring${activeExpansionBands === 1 ? "" : "s"} & Canal Bridges`
                      : "○ Outer Road Ring (22+)"}
                  </span>
                </div>
              </div>

              <div className="world-metrics-2x2">
                <div className="science-metric">
                  <span>Inner Boulevard</span>
                  <strong>{ring1Placements.length}/8 walkable</strong>
                </div>
                <div className="science-metric">
                  <span>Canal Suburbs</span>
                  <strong>{ring2Placements.length}/16 walkable</strong>
                </div>
                <div className="science-metric">
                  <span>Outer Districts</span>
                  <strong>
                    {ring3Placements.length} homes · {activeExpansionBands} ring
                    {activeExpansionBands === 1 ? "" : "s"}
                  </strong>
                </div>
                <div className="science-metric">
                  <span>Open Surveyed Lots</span>
                  <strong>{upcomingBlueprintLots.length} ready</strong>
                </div>
              </div>

              <div className="tama-actions">
                <button
                  type="button"
                  className={`subtle-pill-btn clickable ${
                    cameraMode === "neighborhood" ? "active" : ""
                  }`}
                  onClick={() => {
                    setCameraMode((m) => (m === "neighborhood" ? "follow" : "neighborhood"));
                    soundEngine.playTap(987.77);
                  }}
                >
                  <Eye size={12} /> {cameraMode === "neighborhood" ? "Follow Cam" : "Aerial Vista"}
                </button>
                <button
                  type="button"
                  className="subtle-pill-btn clickable"
                  onClick={handleReturnHome}
                >
                  <Home size={12} /> Home Lab
                </button>
                <button
                  type="button"
                  className="sector-btn clickable"
                  onClick={() => handleSpawnNeighborMint(1)}
                  title="Watch a newly minted NFT rise onto the next surveyed blueprint lot"
                >
                  <Plus size={12} /> +1 Mint
                </button>
                <button
                  type="button"
                  className="sector-btn eth clickable"
                  onClick={() => handleSpawnNeighborMint(5)}
                  title="Watch a 5-mint wave expand the town into new blocks & suburbs"
                >
                  <Sparkles size={12} /> +5 Wave
                </button>
                {onGoMint && (
                  <button
                    type="button"
                    className="subtle-pill-btn clickable"
                    onClick={onGoMint}
                  >
                    Mint Real Lab
                  </button>
                )}
              </div>

              {inspectedNeighbor && (() => {
                const nTraits = deriveTraitsFromSeed(inspectedNeighbor.seed);
                const npc = deriveNeighborCharacterProfile(inspectedNeighbor);
                const isSwitchable = Boolean(
                  switchableVessels?.some((sv) => sv.tokenId === inspectedNeighbor.tokenId) &&
                    onSelectTokenId
                );
                const neighborNftUrl = buildAnimationUrl({
                  tokenId: inspectedNeighbor.tokenId,
                  seed: inspectedNeighbor.seed,
                  causeId: inspectedNeighbor.causeId,
                  complexityTier: inspectedNeighbor.complexityTier,
                  sectorsMask: inspectedNeighbor.sectorsMask,
                  tokenValueUsd: inspectedNeighbor.valueUsd,
                  globalImpactEth: impact.globalImpactEth,
                  totalSupply: effectiveTotalSupply
                });

                return (
                  <div className="neighbor-inspector-card">
                    <div className="neighbor-card-head">
                      <span
                        className="cause-dot"
                        style={{ background: nTraits.palette.liquidMid }}
                      />
                      <div>
                        <strong>
                          Lab #{inspectedNeighbor.tokenId} · {nTraits.vessel}
                        </strong>
                        <div className="tama-sub">
                          {npc.name} ({npc.title}) · {inspectedNeighbor.causeName}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="inline-icon-btn clickable"
                        onClick={() => setInspectedNeighbor(null)}
                        aria-label="Close neighbor details"
                      >
                        <X size={12} />
                      </button>
                    </div>
                    <div className="wing-tags" style={{ marginTop: 8 }}>
                      {LAB_SECTORS.map((sec) => {
                        const built = hasSector(inspectedNeighbor.sectorsMask, sec.id);
                        return (
                          <span key={sec.id} className={`wing-tag ${built ? "built" : ""}`}>
                            {built ? "● " : "○ "}
                            {sec.shortName}
                          </span>
                        );
                      })}
                    </div>
                    <div className="neighbor-card-actions" style={{ marginTop: 10 }}>
                      <button
                        type="button"
                        className="btn-mint-minimal clickable"
                        style={{ padding: "6px 12px", fontSize: "0.74rem" }}
                        onClick={() => handleEnterNeighborHome(inspectedNeighbor)}
                      >
                        <DoorOpen size={12} />{" "}
                        {inspectedNeighbor.tokenId === vessel.tokenId ? "Return Home" : "Enter Home"}
                      </button>
                      <button
                        type="button"
                        className="sector-btn clickable"
                        onClick={() => handleVisitNeighbor(inspectedNeighbor.tokenId)}
                      >
                        <MapPin size={11} /> Walk Outside
                      </button>
                      <button
                        type="button"
                        className="subtle-pill-btn clickable"
                        onClick={() => handleSendNeighborSpark(inspectedNeighbor.tokenId)}
                      >
                        <Send size={11} /> Send Spark
                      </button>
                      {isSwitchable && (
                        <button
                          type="button"
                          className="subtle-pill-btn clickable"
                          onClick={() => {
                            onSelectTokenId?.(inspectedNeighbor.tokenId);
                            setVisitingHome(null);
                            setNeighborhoodDrawerOpen(false);
                          }}
                        >
                          Manage Own Lab
                        </button>
                      )}
                      <a
                        href={neighborNftUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="subtle-pill-btn clickable"
                        style={{ textDecoration: "none" }}
                      >
                        NFT <ArrowUpRight size={11} />
                      </a>
                    </div>
                  </div>
                );
              })()}

              <div className="single-kicker">
                Walkable Boulevard Neighbors ({ring1Placements.length})
              </div>
              {ring1Placements.length === 0 ? (
                <p className="science-summary">
                  You&apos;re the pioneer founder of this research plaza! Click{" "}
                  <strong>Preview New Mint</strong> above (or mint another NFT) to watch new
                  architectural neighbor labs rise along the boulevard.
                </p>
              ) : (
                <div className="world-sector-list">
                  {ring1Placements.map((pl) => {
                    const nTraits = deriveTraitsFromSeed(pl.lab.seed);
                    const npc = deriveNeighborCharacterProfile(pl.lab);
                    return (
                      <div key={pl.lab.tokenId} className="neighbor-card">
                        <div className="neighbor-card-head">
                          <span
                            className="cause-dot"
                            style={{ background: nTraits.palette.liquidMid }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="neighbor-card-title">
                              <strong>Lab #{pl.lab.tokenId}</strong>
                              <span className="sector-bonus">
                                {countSectors(pl.lab.sectorsMask)}/6 rooms
                              </span>
                            </div>
                            <div className="tama-sub">
                              {npc.name} · ${pl.lab.valueUsd} · {pl.lab.causeName}
                            </div>
                          </div>
                        </div>
                        <div className="neighbor-card-actions">
                          <button
                            type="button"
                            className="sector-btn clickable"
                            onClick={() => handleEnterNeighborHome(pl.lab)}
                          >
                            <DoorOpen size={11} />{" "}
                            {pl.lab.tokenId === vessel.tokenId ? "Return Home" : "Enter Home"}
                          </button>
                          <button
                            type="button"
                            className="subtle-pill-btn clickable"
                            onClick={() => handleVisitNeighbor(pl.lab.tokenId)}
                          >
                            <Footprints size={11} /> Walk Over
                          </button>
                          <button
                            type="button"
                            className="subtle-pill-btn clickable"
                            onClick={() => handleSendNeighborSpark(pl.lab.tokenId)}
                          >
                            <Sparkles size={11} /> Spark
                          </button>
                          <button
                            type="button"
                            className="subtle-pill-btn clickable"
                            onClick={() => setInspectedNeighbor(pl.lab)}
                          >
                            Inspect
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {ring2Placements.length > 0 && (
                <>
                  <div className="single-kicker">
                    Canal-Side Suburb Estates ({ring2Placements.length} — Walk across the 4 bridges!)
                  </div>
                  <div className="world-sector-list">
                    {ring2Placements.map((pl) => {
                      const nTraits = deriveTraitsFromSeed(pl.lab.seed);
                      const npc = deriveNeighborCharacterProfile(pl.lab);
                      return (
                        <div key={pl.lab.tokenId} className="neighbor-card">
                          <div className="neighbor-card-head">
                            <span
                              className="cause-dot"
                              style={{ background: nTraits.palette.liquidMid }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="neighbor-card-title">
                                <strong>Lab #{pl.lab.tokenId}</strong>
                                <span className="sector-bonus">{pl.districtName}</span>
                              </div>
                              <div className="tama-sub">
                                {npc.name} · {countSectors(pl.lab.sectorsMask)}/6 rooms · $
                                {pl.lab.valueUsd}
                              </div>
                            </div>
                          </div>
                          <div className="neighbor-card-actions">
                            <button
                              type="button"
                              className="sector-btn clickable"
                              onClick={() => handleEnterNeighborHome(pl.lab)}
                            >
                              <DoorOpen size={11} />{" "}
                              {pl.lab.tokenId === vessel.tokenId ? "Return Home" : "Enter Home"}
                            </button>
                            <button
                              type="button"
                              className="subtle-pill-btn clickable"
                              onClick={() => handleVisitNeighbor(pl.lab.tokenId)}
                            >
                              <Footprints size={11} /> Walk Over
                            </button>
                            <button
                              type="button"
                              className="subtle-pill-btn clickable"
                              onClick={() => setInspectedNeighbor(pl.lab)}
                            >
                              Inspect
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {ring3Placements.length > 0 && (
                <div className="world-goals-block">
                  <div className="single-kicker" style={{ marginBottom: 6 }}>
                    Outer Expansion Districts ({ring3Placements.length} minted homes across{" "}
                    {Math.max(1, activeExpansionBands)} paved ring
                    {activeExpansionBands === 1 ? "" : "s"} — walk over canal bridges!)
                  </div>
                  <div className="wing-tags">
                    {ring3Placements.slice(0, 60).map((pl) => (
                      <button
                        key={pl.lab.tokenId}
                        type="button"
                        className="wing-tag built clickable"
                        style={{ border: "none" }}
                        onClick={() => setInspectedNeighbor(pl.lab)}
                        title={`Inspect or visit Lab #${pl.lab.tokenId} (${pl.districtName})`}
                      >
                        #{pl.lab.tokenId} · {pl.districtName.split(" ")[0]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {upcomingBlueprintLots.length > 0 && (
                <div className="world-goals-block">
                  <div className="single-kicker" style={{ marginBottom: 6 }}>
                    Next Surveyed Plots Forming ({upcomingBlueprintLots.length} open lots)
                  </div>
                  <div className="wing-tags">
                    {upcomingBlueprintLots.map((lot) => (
                      <button
                        key={`lot-chip-${lot.plotIndex}`}
                        type="button"
                        className="wing-tag clickable"
                        style={{ border: "1px dashed #38bdf8" }}
                        onClick={() =>
                          onSimulateNewNeighbor || !onGoMint
                            ? handleSpawnNeighborMint(1)
                            : onGoMint()
                        }
                        title={`Claim or preview open Lot #${lot.lotNumber} on ${lot.districtName}`}
                      >
                        Lot #{lot.lotNumber} · {lot.districtName}
                      </button>
                    ))}
                  </div>
                </div>
              )}
                </>
              )}
            </div>
          </div>
        </aside>
      )}

      {/* Layer 4: Plush Silver-White Glassmorphism Bottom Dock & Cute Icon Controls */}
      {!creatorOpen && Boolean(savedProfile) && (
        <div className="world-hud-bottom">
          <div className="world-dock-pills" role="navigation" aria-label="Lab sections">
            {LAB_STATIONS.map((st) => {
              const Icon = STATION_ICONS[st.id];
              const active = openStation === st.id;
              const near = nearStation === st.id;
              return (
                <button
                  key={st.id}
                  type="button"
                  className={`world-dock-btn clickable ${active ? "active" : ""} ${
                    near ? "is-near" : ""
                  }`}
                  style={{ "--dock-accent": st.accent } as React.CSSProperties}
                  onClick={() => navigateToStation(st.id)}
                >
                  <span className="dock-icon-charm">
                    <Icon size={13} />
                  </span>
                  <span>{st.shortLabel}</span>
                </button>
              );
            })}
            <button
              type="button"
              className={`world-dock-btn clickable ${
                neighborhoodDrawerOpen && townSubTab === "town" ? "active" : ""
              }`}
              style={{ "--dock-accent": "#0ea5e9" } as React.CSSProperties}
              onClick={() => {
                setTownSubTab("town");
                handleOpenNeighborhood();
              }}
            >
              <span className="dock-icon-charm">
                <Users size={13} />
              </span>
              <span>Town</span>
            </button>
            <button
              type="button"
              className={`world-dock-btn clickable ${
                neighborhoodDrawerOpen && townSubTab === "gardens" ? "active" : ""
              }`}
              style={{ "--dock-accent": "#10b981" } as React.CSSProperties}
              onClick={() => {
                soundEngine.playTap(1046.5);
                setPieMenu(null);
                setOpenStation(null);
                setTownSubTab("gardens");
                setNeighborhoodDrawerOpen((open) => (townSubTab === "gardens" ? !open : true));
              }}
              title="Open Town Parks, Glass Conservatory & Plant Gardens"
            >
              <span className="dock-icon-charm">
                <Flower2 size={13} />
              </span>
              <span>{readyGardenCount > 0 ? `Gardens (${readyGardenCount})` : "Gardens"}</span>
            </button>
          </div>

          <div className="world-dock-right">
            <button
              type="button"
              className={`world-pill clickable ${cameraMode !== "orbit" ? "active" : ""}`}
              onClick={() => {
                setCameraMode((prev) =>
                  prev === "follow" ? "orbit" : prev === "orbit" ? "neighborhood" : "follow"
                );
                soundEngine.playTap(880);
              }}
              title="Cycle Follow / Orbit / Aerial Town camera (V)"
            >
              <span className="cute-icon-bubble is-xs">
                {cameraMode === "follow" ? (
                  <Footprints size={11} />
                ) : cameraMode === "neighborhood" ? (
                  <Compass size={11} />
                ) : (
                  <Eye size={11} />
                )}
              </span>
              <span>
                {cameraMode === "follow"
                  ? "Follow"
                  : cameraMode === "neighborhood"
                    ? "Aerial"
                    : "Orbit"}
              </span>
            </button>
            <button
              type="button"
              className="world-pill clickable"
              onClick={cycleLighting}
              title="Switch world sky & time of day"
            >
              <span className="cute-icon-bubble is-xs">
                {lightingMood === "golden" ? (
                  <Sunset size={11} />
                ) : lightingMood === "moonlit" ? (
                  <Moon size={11} />
                ) : (
                  <Sun size={11} />
                )}
              </span>
              <span>{LIGHTING_LABELS[lightingMood]}</span>
            </button>
            <button
              type="button"
              className="world-pill clickable"
              onClick={cycleAtmosphere}
              title="Switch atmosphere particles"
            >
              <span className="cute-icon-bubble is-xs">
                {atmosphereMode === "snow" ? <CloudSnow size={11} /> : <Sparkles size={11} />}
              </span>
              <span>{ATMOSPHERE_LABELS[atmosphereMode]}</span>
            </button>
            <button
              type="button"
              className={`world-icon-orb clickable ${showTouchPad ? "active" : ""}`}
              onClick={() => setShowTouchPad((v) => !v)}
              title="Toggle on-screen walk pad"
              aria-label="Toggle on-screen walk pad"
            >
              <Gamepad2 size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Interactive Cutesy Silver-Glass Housewarming Welcome Guide (Auto-Hides When Drawers Open!) */}
      {!creatorOpen &&
        Boolean(savedProfile) &&
        !onboarding.dismissed &&
        !onboardingProgress.allDone &&
        !openStation &&
        !neighborhoodDrawerOpen &&
        onboardingProgress.nextStep && (
          onboarding.minimized ? (
            <button
              type="button"
              className="welcome-guide-pill clickable"
              onClick={() =>
                setOnboarding((prev) => saveOnboardingState({ ...prev, minimized: false }))
              }
            >
              <span className="cute-icon-bubble is-xs">
                <Sparkles size={10} />
              </span>
              <strong>Welcome Guide</strong>
              <span className="world-pill-muted">
                {onboardingProgress.doneCount}/{onboardingProgress.totalCount}
              </span>
            </button>
          ) : (
            <section className="welcome-guide-card" aria-label="Interactive Welcome Guide">
              <div className="welcome-guide-head">
                <div className="welcome-guide-title-row">
                  <span
                    className="cute-icon-bubble is-sm"
                    style={{ "--bubble-accent": onboardingProgress.nextStep.accent } as React.CSSProperties}
                  >
                    <Sparkles size={11} />
                  </span>
                  <div>
                    <div className="single-kicker">
                      Welcome Tour · {onboardingProgress.doneCount}/{onboardingProgress.totalCount}
                    </div>
                    <strong>{onboardingProgress.nextStep.title}</strong>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    type="button"
                    className="inline-icon-btn clickable"
                    onClick={() =>
                      setOnboarding((prev) => saveOnboardingState({ ...prev, minimized: true }))
                    }
                    title="Minimize guide"
                    aria-label="Minimize guide"
                  >
                    –
                  </button>
                  <button
                    type="button"
                    className="inline-icon-btn clickable"
                    onClick={() =>
                      setOnboarding((prev) => saveOnboardingState({ ...prev, dismissed: true }))
                    }
                    title="Dismiss guide"
                    aria-label="Dismiss guide"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>

              <div className="welcome-guide-progress">
                <div
                  className="welcome-guide-progress-fill"
                  style={{ width: `${Math.max(12, onboardingProgress.pct)}%` }}
                />
              </div>

              <p className="welcome-guide-desc">{onboardingProgress.nextStep.desc}</p>

              <div className="welcome-guide-cta-row">
                <span className="welcome-reward-chip">
                  +{onboardingProgress.nextStep.rewardSparks} sparks
                </span>
                <button
                  type="button"
                  className="sector-btn clickable"
                  onClick={() =>
                    onboardingProgress.nextStep &&
                    handleTriggerGuideAction(onboardingProgress.nextStep.id)
                  }
                >
                  {onboardingProgress.nextStep.ctaLabel} <ArrowRight size={11} />
                </button>
              </div>
            </section>
          )
        )}

      {/* Subtle Frosted-Silver Keyboard & Walk Hint Micro-Capsule */}
      {!creatorOpen && Boolean(savedProfile) && (
        <div className="world-walk-hint">
          <kbd className="world-walk-kbd">WASD</kbd> walk · <kbd className="world-walk-kbd">Click</kbd>{" "}
          Sims actions · <kbd className="world-walk-kbd">N</kbd> town ·{" "}
          <kbd className="world-walk-kbd">H</kbd> home · <kbd className="world-walk-kbd">C</kbd> look
        </div>
      )}

      {/* Optional Compact On-Screen Walk D-Pad for Mobile / Touch / Mouse-Only Walking */}
      {!creatorOpen && Boolean(savedProfile) && showTouchPad && (
        <div className="world-dpad" aria-label="On-screen walk controls">
          <div />
          <button type="button" className="dpad-btn clickable" aria-label="Walk forward" {...bindTouchDir(0, 1)}>
            <ArrowUp size={15} />
          </button>
          <div />
          <button type="button" className="dpad-btn clickable" aria-label="Walk left" {...bindTouchDir(-1, 0)}>
            <ArrowLeft size={15} />
          </button>
          <button
            type="button"
            className="dpad-btn dpad-center clickable"
            aria-label="Interact or jump"
            onClick={() => {
              if (nearStation) setOpenStation((cur) => (cur === nearStation ? null : nearStation));
              else setCharacterEmote((prev) => ({ emote: "hop", seq: (prev?.seq || 0) + 1 }));
            }}
          >
            {nearStation ? "E" : "•"}
          </button>
          <button type="button" className="dpad-btn clickable" aria-label="Walk right" {...bindTouchDir(1, 0)}>
            <ArrowRight size={15} />
          </button>
          <div />
          <button type="button" className="dpad-btn clickable" aria-label="Walk backward" {...bindTouchDir(0, -1)}>
            <ArrowDown size={15} />
          </button>
          <div />
        </div>
      )}

      {/* Live Dual-Scale Architectural Blueprint Mini-Map Radar (Home Lab ↔ Neighborhood District!) */}
      {!creatorOpen && Boolean(savedProfile) && !showTouchPad && (
        <div className="world-minimap" aria-label="Lab & neighborhood blueprint mini-map">
          <svg viewBox="0 0 112 112" className="world-minimap-svg">
            {radarIsDistrict ? (
              <>
                {/* Dynamically Scaling Orthogonal Neighborhood & Expansion Road Grid Radar */}
                <rect
                  x="10"
                  y="10"
                  width="92"
                  height="92"
                  rx="10"
                  fill="rgba(220,247,228,0.45)"
                  stroke="rgba(148,163,184,0.38)"
                  strokeWidth="1"
                />
                {/* Shimmering Reflecting Canal Perimeter Ring */}
                <circle
                  cx="56"
                  cy="56"
                  r={(31.1 / districtRadarSpan) * 44}
                  fill="none"
                  stroke="rgba(56,189,248,0.45)"
                  strokeWidth="1.5"
                />
                {/* Dynamically Paved Outer Expansion Ring Roads! */}
                {Array.from({ length: activeExpansionBands }, (_, b) => {
                  const s = (getExpansionBandAvenueSpan(b) / districtRadarSpan) * 44;
                  return (
                    <rect
                      key={`exp-road-${b}`}
                      x={56 - s}
                      y={56 - s}
                      width={s * 2}
                      height={s * 2}
                      rx="1.5"
                      fill="none"
                      stroke="rgba(100,116,139,0.52)"
                      strokeWidth="1.8"
                    />
                  );
                })}
                {/* 4 North-South & 4 East-West Inner Neighborhood Streets (extending onto canal bridges!) */}
                {TOWN_STREETS.ns.map((sx) => {
                  const px = 56 + (sx / districtRadarSpan) * 44;
                  const innerExt =
                    Math.abs(sx) < 10 && activeExpansionBands > 0
                      ? (getExpansionBandAvenueSpan(activeExpansionBands - 1) / districtRadarSpan) * 44
                      : (29.5 / districtRadarSpan) * 44;
                  return (
                    <line
                      key={`ns-${sx}`}
                      x1={px}
                      y1={Math.max(10, 56 - innerExt)}
                      x2={px}
                      y2={Math.min(102, 56 + innerExt)}
                      stroke="rgba(100,116,139,0.52)"
                      strokeWidth={districtRadarSpan > 35 ? "1.6" : "2.4"}
                    />
                  );
                })}
                {TOWN_STREETS.ew.map((sz) => {
                  const py = 56 + (sz / districtRadarSpan) * 44;
                  const innerExt =
                    Math.abs(sz) < 10 && activeExpansionBands > 0
                      ? (getExpansionBandAvenueSpan(activeExpansionBands - 1) / districtRadarSpan) * 44
                      : (29.5 / districtRadarSpan) * 44;
                  return (
                    <line
                      key={`ew-${sz}`}
                      x1={Math.max(10, 56 - innerExt)}
                      y1={py}
                      x2={Math.min(102, 56 + innerExt)}
                      y2={py}
                      stroke="rgba(100,116,139,0.52)"
                      strokeWidth={districtRadarSpan > 35 ? "1.6" : "2.4"}
                    />
                  );
                })}
                {/* Active Center Home Plot #1 */}
                <rect
                  x={56 - (districtRadarSpan > 35 ? 4.5 : 6.5)}
                  y={56 - (districtRadarSpan > 35 ? 4.5 : 6.5)}
                  width={districtRadarSpan > 35 ? 9 : 13}
                  height={districtRadarSpan > 35 ? 9 : 13}
                  rx="2.2"
                  fill="rgba(91,141,239,0.34)"
                  stroke="#5b8def"
                  strokeWidth="1.2"
                  className="clickable"
                  style={{ cursor: "pointer" }}
                  onClick={handleReturnHome}
                >
                  <title>
                    {isVisiting ? `Return Home (Lab #${vessel.tokenId})` : `Home Plot · Lab #${vessel.tokenId}`}
                  </title>
                </rect>
                {/* Community Fountain Square Dot */}
                <circle
                  cx={56 + (COMMUNITY_FOUNTAIN_POS[0] / districtRadarSpan) * 44}
                  cy={56 + (COMMUNITY_FOUNTAIN_POS[1] / districtRadarSpan) * 44}
                  r={districtRadarSpan > 35 ? "1.7" : "2.2"}
                  fill="#0ea5e9"
                  stroke="#ffffff"
                  strokeWidth="0.8"
                >
                  <title>Community Research Fountain</title>
                </circle>
                {/* Surveyed Next-Mint Open Residential Lots across ALL Rings (dashed cyan squares) */}
                {upcomingBlueprintLots.map((lot) => {
                  const lx = Math.max(10, Math.min(102, 56 + (lot.x / districtRadarSpan) * 44));
                  const ly = Math.max(10, Math.min(102, 56 + (lot.z / districtRadarSpan) * 44));
                  const bsz = districtRadarSpan > 35 ? 4.2 : 6;
                  return (
                    <rect
                      key={`lot-${lot.plotIndex}`}
                      x={lx - bsz / 2}
                      y={ly - bsz / 2}
                      width={bsz}
                      height={bsz}
                      rx="1"
                      fill="rgba(224,242,254,0.52)"
                      stroke="#0ea5e9"
                      strokeWidth="0.95"
                      strokeDasharray="1.5 1"
                    >
                      <title>Next Mint · Lot #{lot.lotNumber} ({lot.districtName})</title>
                    </rect>
                  );
                })}
                {/* 4 Clickable Emerald City-Block Town Parks on District Radar */}
                {TOWN_PARKS.map((park) => {
                  const px = 56 + (park.x / districtRadarSpan) * 44;
                  const py = 56 + (park.z / districtRadarSpan) * 44;
                  const ps = Math.max(5.5, (8.2 / districtRadarSpan) * 44);
                  return (
                    <rect
                      key={park.id}
                      x={px - ps / 2}
                      y={py - ps / 2}
                      width={ps}
                      height={ps}
                      rx="2"
                      fill="rgba(52,211,153,0.72)"
                      stroke="#ffffff"
                      strokeWidth="0.95"
                      className="clickable"
                      style={{ cursor: "pointer" }}
                      onClick={() => handleWalkToPark(park.id)}
                    >
                      <title>Walk to {park.name}</title>
                    </rect>
                  );
                })}
                {/* Clickable Ring 1 + Ring 2 + Ring 3 Street-Aligned Neighborhood House Plots! */}
                {neighborPlacements.map((pl) => {
                  const nx = Math.max(10, Math.min(102, 56 + (pl.x / districtRadarSpan) * 44));
                  const ny = Math.max(10, Math.min(102, 56 + (pl.z / districtRadarSpan) * 44));
                  const col = deriveTraitsFromSeed(pl.lab.seed).palette.liquidMid;
                  const sz =
                    districtRadarSpan > 48
                      ? 3.2
                      : districtRadarSpan > 35
                        ? pl.ring === 1
                          ? 4.6
                          : 3.9
                        : pl.ring === 1
                          ? 6.8
                          : 5.8;
                  return (
                    <rect
                      key={pl.lab.tokenId}
                      x={nx - sz / 2}
                      y={ny - sz / 2}
                      width={sz}
                      height={sz}
                      rx="1.1"
                      fill={col}
                      stroke="#ffffff"
                      strokeWidth={districtRadarSpan > 35 ? "0.7" : "1.1"}
                      className="clickable"
                      style={{ cursor: "pointer" }}
                      onClick={() => handleVisitNeighbor(pl.lab.tokenId)}
                    >
                      <title>
                        Walk to Lab #{pl.lab.tokenId} ({pl.districtName})
                      </title>
                    </rect>
                  );
                })}
              </>
            ) : (
              <>
                {/* Architectural drafting crosshairs & rotunda ring */}
                <circle cx="56" cy="56" r="48" fill="none" stroke="rgba(148,163,184,0.28)" strokeWidth="1" />
                <circle
                  cx="56"
                  cy="56"
                  r="24"
                  fill="rgba(255,255,255,0.65)"
                  stroke="rgba(100,116,139,0.42)"
                  strokeWidth="1.2"
                />
                <circle
                  cx="56"
                  cy="56"
                  r="9.5"
                  fill="rgba(91,141,239,0.18)"
                  stroke="rgba(91,141,239,0.55)"
                  strokeWidth="1"
                />
                <line x1="8" y1="56" x2="104" y2="56" stroke="rgba(148,163,184,0.18)" strokeWidth="0.8" />
                <line x1="56" y1="8" x2="56" y2="104" stroke="rgba(148,163,184,0.18)" strokeWidth="0.8" />

                {/* 5 Clickable Station Dots (tracks live moved station positions across floors!) */}
                {LAB_STATIONS.map((st) => {
                  const placed = resolveItemPlacement(st.id, labDecor.customLayout);
                  const homeSpan = Math.max(4.75, getHouseBoundsRadius(labDecor.houseSize) + 0.15);
                  const cx = Math.max(10, Math.min(102, 56 + (placed.x / homeSpan) * 44));
                  const cy = Math.max(10, Math.min(102, 56 + (placed.z / homeSpan) * 44));
                  const active = openStation === st.id || nearStation === st.id;
                  return (
                    <circle
                      key={st.id}
                      cx={cx}
                      cy={cy}
                      r={active ? 5.2 : 3.8}
                      fill={st.accent}
                      stroke="#ffffff"
                      strokeWidth="1.4"
                      className="clickable"
                      style={{ cursor: "pointer" }}
                      onClick={() => navigateToStation(st.id)}
                    >
                      <title>
                        {st.label} ({placed.floor}F)
                      </title>
                    </circle>
                  );
                })}
              </>
            )}

            {/* Live 3D Companion Pet Blip */}
            <circle
              ref={radarPetRef}
              cx="68"
              cy="66"
              r="2.8"
              fill="#f472b6"
              stroke="#ffffff"
              strokeWidth="1"
              style={{ opacity: 0 }}
            />

            {/* Live Researcher Directional Chevron */}
            <g ref={radarPlayerRef} transform="translate(56 74)">
              <polygon
                points="0,-5.5 4.2,4.5 0,2.2 -4.2,4.5"
                fill="#1a1f2c"
                stroke="#ffffff"
                strokeWidth="1"
              />
            </g>
          </svg>
          <span className="world-minimap-label">N</span>
          <button
            type="button"
            className="world-minimap-toggle clickable"
            onClick={() =>
              setRadarManualMode((m) =>
                m === "auto"
                  ? radarIsDistrict
                    ? "lab"
                    : "district"
                  : m === "district"
                    ? "lab"
                    : "district"
              )
            }
            title="Switch mini-map between Home Lab and Neighborhood District"
          >
            {radarIsDistrict ? "District" : "Lab"}
          </button>
        </div>
      )}

      {/* Layer 5: First-Interaction & Re-Editable 3D Character Creator */}
      {creatorOpen && (
        <CharacterCreatorOverlay
          draft={creatorDraft}
          isFirstTime={!savedProfile}
          turntableOn={creatorTurntable}
          onChange={(next, emote) => {
            setCreatorDraft(next);
            if (emote) {
              setCharacterEmote((prev) => ({ emote, seq: (prev?.seq || 0) + 1 }));
            }
          }}
          onFocusZoneChange={(zone) => setCreatorFocusZone(zone)}
          onToggleTurntable={() => setCreatorTurntable((v) => !v)}
          onFlipView={(back) => {
            setCreatorTurntable(false);
            artworkRef.current?.flipCreatorView(back);
          }}
          onConfirm={(finalProfile) => {
            const persisted = saveCharacterProfile(finalProfile);
            setSavedProfile(persisted);
            setCreatorDraft(persisted);
            setCreatorOpen(false);
            setCreatorTurntable(false);
            setCreatorFocusZone("full");
            setCameraMode("follow");
            setFeedback(
              `Welcome, ${persisted.name}! Walk around with WASD / Arrows or click any 3D floating monitor.`
            );
          }}
          onCancel={
            savedProfile
              ? () => {
                  setCreatorOpen(false);
                  setCreatorTurntable(false);
                  setCreatorFocusZone("full");
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
