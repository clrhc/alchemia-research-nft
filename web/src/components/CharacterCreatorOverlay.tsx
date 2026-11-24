import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Dices,
  FlipHorizontal2,
  Footprints,
  Glasses,
  Palette,
  PawPrint,
  RefreshCw,
  Scissors,
  Shirt,
  Sofa,
  Sparkles,
  UserCheck,
  Users,
  X
} from "lucide-react";
import type { CreatorFocusZone } from "../engine/alchemy3DRenderer";
import {
  BACKPACK_OPTIONS,
  BOTTOM_COLORS,
  BOTTOM_STYLES,
  BUILD_SCALE_OPTIONS,
  CHARACTER_PRESETS,
  EXPRESSION_OPTIONS,
  EYEWEAR_OPTIONS,
  EYE_COLORS,
  FOOTWEAR_STYLES,
  HAIR_COLORS,
  HAIR_STYLES,
  HEADWEAR_OPTIONS,
  NECKWEAR_OPTIONS,
  OUTFIT_ACCENTS,
  OUTFIT_BASE_COLORS,
  OUTFIT_STYLES,
  PERSONALITY_TRAITS,
  RESEARCHER_TITLES,
  SKIN_TONES,
  randomizeCharacterProfile,
  randomizeOutfitOnly,
  type CharacterProfile
} from "../engine/characterConfig";
import type { CharacterEmote } from "../engine/character3D";
import { soundEngine } from "../engine/soundEngine";

type CreatorTab = "identity" | "hair" | "outfit" | "gear";
type ClothingSubTab = "tops" | "bottoms" | "shoes" | "neck";
type WelcomeStep = 1 | 2 | 3;

interface CharacterCreatorOverlayProps {
  draft: CharacterProfile;
  isFirstTime: boolean;
  turntableOn: boolean;
  onChange: (next: CharacterProfile, emote?: CharacterEmote) => void;
  onFocusZoneChange: (zone: CreatorFocusZone) => void;
  onToggleTurntable: () => void;
  onFlipView: (back: boolean) => void;
  onConfirm: (finalProfile: CharacterProfile) => void;
  onCancel?: () => void;
}

export function CharacterCreatorOverlay({
  draft,
  isFirstTime,
  turntableOn,
  onChange,
  onFocusZoneChange,
  onToggleTurntable,
  onFlipView,
  onConfirm,
  onCancel
}: CharacterCreatorOverlayProps) {
  const [welcomeStep, setWelcomeStep] = useState<WelcomeStep>(1);
  const [tab, setTab] = useState<CreatorTab>(isFirstTime ? "outfit" : "outfit");
  const [clothingSub, setClothingSub] = useState<ClothingSubTab>("tops");
  const [facingBack, setFacingBack] = useState(false);

  const patch = (
    partial: Partial<CharacterProfile>,
    emote: CharacterEmote = "hop",
    focusZone?: CreatorFocusZone
  ) => {
    soundEngine.playTap(emote === "spin" ? 1174.66 : 987.77);
    onChange({ ...draft, ...partial }, emote);
    if (focusZone) {
      setFacingBack(focusZone === "back");
      onFocusZoneChange(focusZone);
    }
  };

  const selectTab = (nextTab: CreatorTab) => {
    soundEngine.playTap(880);
    setTab(nextTab);
    setFacingBack(false);
    if (nextTab === "identity") onFocusZoneChange("face");
    else if (nextTab === "hair") onFocusZoneChange("hair");
    else if (nextTab === "outfit") onFocusZoneChange("full");
    else onFocusZoneChange("full");
  };

  const goWelcomeStep = (step: WelcomeStep) => {
    soundEngine.playTap(step === 3 ? 1174.66 : 987.77);
    setWelcomeStep(step);
    setFacingBack(false);
    if (step === 1) {
      onFocusZoneChange("face");
    } else if (step === 2) {
      setTab("outfit");
      onFocusZoneChange("full");
    } else {
      onFocusZoneChange("full");
    }
  };

  const handleRandomize = () => {
    soundEngine.playBuildRoom();
    setFacingBack(false);
    onFocusZoneChange("full");
    onChange(randomizeCharacterProfile(draft.name), "spin");
  };

  const handleRandomizeOutfit = () => {
    soundEngine.playBuildRoom();
    setFacingBack(false);
    onFocusZoneChange("full");
    onChange(randomizeOutfitOnly(draft), "spin");
  };

  const activeTrait =
    PERSONALITY_TRAITS.find((t) => t.id === (draft.trait || "genius")) || PERSONALITY_TRAITS[0];
  const activeOutfitLabel =
    OUTFIT_STYLES.find((o) => o.id === draft.outfitStyle)?.label || "Lab Coat";

  const renderIdentityFields = () => (
    <>
      <div className="creator-field">
        <label className="creator-label" htmlFor="researcher-name-input">
          Character name
        </label>
        <input
          id="researcher-name-input"
          type="text"
          maxLength={20}
          value={draft.name}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
          placeholder="Enter your researcher's name…"
          className="creator-input"
        />
      </div>

      <div className="creator-field">
        <span className="creator-label">Sims personality trait</span>
        <div className="creator-chip-grid">
          {PERSONALITY_TRAITS.map((tr) => (
            <button
              key={tr.id}
              type="button"
              title={tr.desc}
              className={`creator-chip clickable ${
                (draft.trait || "genius") === tr.id ? "active" : ""
              }`}
              onClick={() => patch({ trait: tr.id }, "hop", "face")}
            >
              <span
                className="cause-dot"
                style={{ background: tr.accent, display: "inline-block", marginRight: 5 }}
              />
              {tr.label}
            </button>
          ))}
        </div>
      </div>

      <div className="creator-field">
        <span className="creator-label">Expression</span>
        <div className="creator-chip-grid">
          {EXPRESSION_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`creator-chip clickable ${
                draft.expression === opt.id ? "active" : ""
              }`}
              onClick={() => patch({ expression: opt.id }, "wave", "face")}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="creator-field">
        <span className="creator-label">Skin tone</span>
        <div className="creator-swatch-row">
          {SKIN_TONES.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`creator-swatch clickable ${
                draft.skinTone.toLowerCase() === s.hex.toLowerCase() ? "active" : ""
              }`}
              style={{ background: s.hex }}
              title={s.label}
              aria-label={s.label}
              onClick={() => patch({ skinTone: s.hex }, "hop", "face")}
            />
          ))}
        </div>
      </div>

      <div className="creator-field">
        <span className="creator-label">Eye color</span>
        <div className="creator-swatch-row">
          {EYE_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`creator-swatch clickable ${
                draft.eyeColor.toLowerCase() === c.hex.toLowerCase() ? "active" : ""
              }`}
              style={{ background: c.hex }}
              title={c.label}
              aria-label={c.label}
              onClick={() => patch({ eyeColor: c.hex }, "hop", "face")}
            />
          ))}
        </div>
      </div>

      <div className="creator-field">
        <span className="creator-label">Lab role</span>
        <div className="creator-chip-grid">
          {RESEARCHER_TITLES.map((title) => (
            <button
              key={title}
              type="button"
              className={`creator-chip clickable ${draft.title === title ? "active" : ""}`}
              onClick={() => patch({ title }, "wave")}
            >
              {title}
            </button>
          ))}
        </div>
      </div>
    </>
  );

  const renderHairFields = () => (
    <>
      <div className="creator-field">
        <span className="creator-label">Hairstyle ({HAIR_STYLES.length})</span>
        <div className="creator-chip-grid">
          {HAIR_STYLES.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`creator-chip clickable ${draft.hairStyle === opt.id ? "active" : ""}`}
              onClick={() => patch({ hairStyle: opt.id }, "hop", "hair")}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="creator-field">
        <span className="creator-label">Hair color</span>
        <div className="creator-swatch-row">
          {HAIR_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`creator-swatch clickable ${
                draft.hairColor.toLowerCase() === c.hex.toLowerCase() ? "active" : ""
              }`}
              style={{ background: c.hex }}
              title={c.label}
              aria-label={c.label}
              onClick={() => patch({ hairColor: c.hex }, "hop", "hair")}
            />
          ))}
        </div>
      </div>

      <div className="creator-field">
        <span className="creator-label">Hats, Ears &amp; Headwear ({HEADWEAR_OPTIONS.length})</span>
        <div className="creator-chip-grid">
          {HEADWEAR_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`creator-chip clickable ${draft.headwear === opt.id ? "active" : ""}`}
              onClick={() => patch({ headwear: opt.id }, "hop", "hair")}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );

  const renderOutfitFields = () => (
    <>
      <div className="furnish-header-row">
        <div className="furnish-cat-strip" role="tablist" aria-label="Clothing slot">
          {(
            [
              { id: "tops", label: "Tops" },
              { id: "bottoms", label: "Bottoms" },
              { id: "shoes", label: "Shoes" },
              { id: "neck", label: "Neckwear" }
            ] as const
          ).map((sub) => (
            <button
              key={sub.id}
              type="button"
              role="tab"
              aria-selected={clothingSub === sub.id}
              className={`furnish-cat-pill clickable ${
                clothingSub === sub.id ? "active" : ""
              }`}
              style={{ padding: "4px 10px" }}
              onClick={() => {
                setClothingSub(sub.id);
                soundEngine.playTap(987.77);
              }}
            >
              {sub.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="inline-icon-btn clickable"
          onClick={handleRandomizeOutfit}
          title="Shuffle outfit clothes"
          aria-label="Shuffle outfit clothes"
        >
          <Dices size={13} />
        </button>
      </div>

      {clothingSub === "tops" && (
        <>
          <div className="creator-field">
            <span className="creator-label">Tops &amp; Coats ({OUTFIT_STYLES.length})</span>
            <div className="creator-chip-grid">
              {OUTFIT_STYLES.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`creator-chip clickable ${
                    draft.outfitStyle === opt.id ? "active" : ""
                  }`}
                  onClick={() => patch({ outfitStyle: opt.id }, "spin", "full")}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="creator-field">
            <span className="creator-label">Fabric color</span>
            <div className="creator-swatch-row">
              {OUTFIT_BASE_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`creator-swatch clickable ${
                    (draft.outfitBaseColor || "#f8fafd").toLowerCase() === c.hex.toLowerCase()
                      ? "active"
                      : ""
                  }`}
                  style={{ background: c.hex }}
                  title={c.label}
                  aria-label={c.label}
                  onClick={() => patch({ outfitBaseColor: c.hex }, "hop", "full")}
                />
              ))}
            </div>
          </div>

          <div className="creator-field">
            <span className="creator-label">Trim &amp; accent color</span>
            <div className="creator-swatch-row">
              {OUTFIT_ACCENTS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`creator-swatch clickable ${
                    draft.outfitAccent.toLowerCase() === c.hex.toLowerCase() ? "active" : ""
                  }`}
                  style={{ background: c.hex }}
                  title={c.label}
                  aria-label={c.label}
                  onClick={() => patch({ outfitAccent: c.hex }, "spin", "full")}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {clothingSub === "bottoms" && (
        <>
          <div className="creator-field">
            <span className="creator-label">Pants, Skirts &amp; Shorts ({BOTTOM_STYLES.length})</span>
            <div className="creator-chip-grid">
              {BOTTOM_STYLES.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`creator-chip clickable ${
                    (draft.bottomStyle || "slacks") === opt.id ? "active" : ""
                  }`}
                  onClick={() => patch({ bottomStyle: opt.id }, "hop", "full")}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="creator-field">
            <span className="creator-label">Bottoms color</span>
            <div className="creator-swatch-row">
              {BOTTOM_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`creator-swatch clickable ${
                    (draft.bottomColor || "#263042").toLowerCase() === c.hex.toLowerCase()
                      ? "active"
                      : ""
                  }`}
                  style={{ background: c.hex }}
                  title={c.label}
                  aria-label={c.label}
                  onClick={() => patch({ bottomColor: c.hex }, "hop", "full")}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {clothingSub === "shoes" && (
        <div className="creator-field">
          <span className="creator-label">
            <Footprints size={11} style={{ verticalAlign: "-1px", marginRight: 4 }} />
            Footwear ({FOOTWEAR_STYLES.length})
          </span>
          <div className="creator-chip-grid">
            {FOOTWEAR_STYLES.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`creator-chip clickable ${
                  (draft.footwearStyle || "boots") === opt.id ? "active" : ""
                }`}
                onClick={() => patch({ footwearStyle: opt.id }, "hop", "full")}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {clothingSub === "neck" && (
        <div className="creator-field">
          <span className="creator-label">Scarves, Bows &amp; Neckwear ({NECKWEAR_OPTIONS.length})</span>
          <div className="creator-chip-grid">
            {NECKWEAR_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`creator-chip clickable ${
                  (draft.neckwear || "none") === opt.id ? "active" : ""
                }`}
                onClick={() => patch({ neckwear: opt.id }, "wave", "outfit")}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );

  const renderGearFields = () => (
    <>
      <div className="creator-field">
        <span className="creator-label">Eyewear</span>
        <div className="creator-chip-grid">
          {EYEWEAR_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`creator-chip clickable ${draft.eyewear === opt.id ? "active" : ""}`}
              onClick={() => patch({ eyewear: opt.id }, "hop", "face")}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="creator-field">
        <span className="creator-label">Backpacks &amp; Wings (auto-spins to rear view)</span>
        <div className="creator-chip-grid">
          {BACKPACK_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`creator-chip clickable ${draft.backpack === opt.id ? "active" : ""}`}
              onClick={() => patch({ backpack: opt.id }, "hop", "back")}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="creator-field">
        <span className="creator-label">Build &amp; height</span>
        <div className="creator-chip-grid">
          {BUILD_SCALE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`creator-chip clickable ${
                draft.buildScale === opt.id ? "active" : ""
              }`}
              onClick={() => patch({ buildScale: opt.id }, "hop", "full")}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );

  return (
    <div className="creator-overlay" role="dialog" aria-modal="true" aria-label="Character Creator">
      {/* Left studio turntable & view flip controls over the live 3D character */}
      <div className="creator-stage-caption">
        <span className="art-hud-badge">
          <Sparkles size={11} />
          Drag 3D to orbit
        </span>
        <button
          type="button"
          className={`art-hud-badge clickable ${turntableOn ? "is-active-badge" : ""}`}
          onClick={() => {
            soundEngine.playTap(880);
            onToggleTurntable();
          }}
        >
          <RefreshCw size={11} />
          {turntableOn ? "Spin on" : "Turntable"}
        </button>
        <button
          type="button"
          className="art-hud-badge clickable"
          onClick={() => {
            const nextBack = !facingBack;
            setFacingBack(nextBack);
            soundEngine.playTap(987.77);
            onFlipView(nextBack);
          }}
        >
          <FlipHorizontal2 size={11} />
          {facingBack ? "Front" : "Back"}
        </button>
      </div>

      {/* Right frosted-glass architectural character & onboarding studio panel */}
      <div className="glass-panel creator-card">
        <div className="creator-head">
          <div>
            <div className="single-kicker">
              {isFirstTime
                ? `Welcome to Alchemia Town · Step ${welcomeStep} of 3`
                : "Researcher Closet"}
            </div>
            <h2 className="creator-title">
              {isFirstTime
                ? welcomeStep === 1
                  ? "Create your researcher"
                  : welcomeStep === 2
                    ? "Style your wardrobe"
                    : "Ready to move in!"
                : "Wardrobe & Style"}
            </h2>
          </div>

          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {isFirstTime && welcomeStep < 3 && (
              <button
                type="button"
                className="subtle-pill-btn clickable"
                style={{ padding: "5px 10px", fontSize: "0.7rem" }}
                onClick={() => {
                  soundEngine.playBuildRoom();
                  onConfirm(draft);
                }}
                title="Jump straight into your 3D lab with this look"
              >
                Quick Start
              </button>
            )}
            <button
              type="button"
              className="inline-icon-btn clickable"
              onClick={handleRandomize}
              title="Randomize full character"
              aria-label="Randomize full character"
            >
              <Dices size={14} />
            </button>
            {!isFirstTime && onCancel && (
              <button
                type="button"
                className="inline-icon-btn clickable"
                onClick={onCancel}
                title="Close wardrobe"
                aria-label="Close wardrobe"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Guided 3-Step Welcome Stepper (First-Time Onboarding) */}
        {isFirstTime && (
          <div className="onboarding-steps-bar" aria-label="Onboarding steps">
            {(
              [
                { step: 1, label: "1. Identity" },
                { step: 2, label: "2. Clothes" },
                { step: 3, label: "3. Move In" }
              ] as const
            ).map(({ step, label }) => (
              <button
                key={step}
                type="button"
                className={`onboarding-step-pill clickable ${
                  welcomeStep === step ? "active" : welcomeStep > step ? "done" : ""
                }`}
                onClick={() => goWelcomeStep(step)}
              >
                {welcomeStep > step && <Check size={10} />}
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Quick Fashion Presets (Visible on Step 1 & Returning Closet) */}
        {(!isFirstTime || welcomeStep === 1) && (
          <div className="creator-presets-row" aria-label="Quick character archetypes">
            {CHARACTER_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`creator-preset-pill clickable ${
                  draft.outfitStyle === preset.profile.outfitStyle &&
                  draft.hairStyle === preset.profile.hairStyle
                    ? "active"
                    : ""
                }`}
                onClick={() => {
                  soundEngine.playBuildRoom();
                  setFacingBack(false);
                  onFocusZoneChange("full");
                  onChange(
                    {
                      ...preset.profile,
                      name: draft.name.trim() ? draft.name : preset.profile.name,
                      createdAtMs: draft.createdAtMs
                    },
                    "spin"
                  );
                }}
              >
                <span
                  className="cause-dot"
                  style={{ background: preset.profile.outfitAccent }}
                />
                {preset.label}
              </button>
            ))}
          </div>
        )}

        {/* Style Sub-Tabs (Visible on Step 2 of Welcome & Returning Closet) */}
        {(!isFirstTime || welcomeStep === 2) && (
          <div className="creator-tabs" role="tablist" aria-label="Character sections">
            {(isFirstTime
              ? ([
                  { id: "outfit", label: "Clothes", Icon: Shirt },
                  { id: "hair", label: "Hair & Hats", Icon: Scissors },
                  { id: "gear", label: "Wings & Gear", Icon: Glasses }
                ] as const)
              : ([
                  { id: "identity", label: "Face", Icon: Palette },
                  { id: "hair", label: "Hair", Icon: Scissors },
                  { id: "outfit", label: "Clothes", Icon: Shirt },
                  { id: "gear", label: "Gear", Icon: Glasses }
                ] as const)
            ).map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                className={`creator-tab clickable ${tab === id ? "active" : ""}`}
                onClick={() => selectTab(id)}
              >
                <Icon size={13} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}

        <div className="creator-body">
          {isFirstTime ? (
            welcomeStep === 1 ? (
              renderIdentityFields()
            ) : welcomeStep === 2 ? (
              tab === "hair" ? (
                renderHairFields()
              ) : tab === "gear" ? (
                renderGearFields()
              ) : (
                renderOutfitFields()
              )
            ) : (
              /* Step 3: Warm Housewarming Move-In Preview Card! */
              <div className="world-drawer-stack">
                <div className="world-profile-card">
                  <div>
                    <div className="single-kicker">{draft.title}</div>
                    <strong style={{ fontSize: "1.1rem", color: "#1e293b" }}>
                      {draft.name.trim() || "Dr. Aria"}
                    </strong>
                    <div className="tama-sub">
                      {activeTrait.label} · Wearing {activeOutfitLabel}
                    </div>
                  </div>
                  <span
                    className="cute-icon-bubble"
                    style={{ "--bubble-accent": draft.outfitAccent } as React.CSSProperties}
                  >
                    <Sparkles size={13} />
                  </span>
                </div>

                <div className="onboarding-movein-grid">
                  <div className="onboarding-movein-item">
                    <span className="cute-icon-bubble is-sm" style={{ "--bubble-accent": "#10b981" } as React.CSSProperties}>
                      <Sofa size={11} />
                    </span>
                    <div>
                      <strong>Furnish &amp; Upgrade</strong>
                      <small>43 live 3D furnishings &amp; Lv.1–3 station upgrades</small>
                    </div>
                  </div>
                  <div className="onboarding-movein-item">
                    <span className="cute-icon-bubble is-sm" style={{ "--bubble-accent": "#f472b6" } as React.CSSProperties}>
                      <PawPrint size={11} />
                    </span>
                    <div>
                      <strong>Dress Your Pet</strong>
                      <small>Sweaters, mini lab coats, hats &amp; fairy wings</small>
                    </div>
                  </div>
                  <div className="onboarding-movein-item">
                    <span className="cute-icon-bubble is-sm" style={{ "--bubble-accent": "#38bdf8" } as React.CSSProperties}>
                      <Users size={11} />
                    </span>
                    <div>
                      <strong>Living 3D Town</strong>
                      <small>Visit neighbors&apos; homes &amp; grow friendships</small>
                    </div>
                  </div>
                  <div className="onboarding-movein-item">
                    <span className="cute-icon-bubble is-sm" style={{ "--bubble-accent": "#6366f1" } as React.CSSProperties}>
                      <Building2 size={11} />
                    </span>
                    <div>
                      <strong>Real Science &amp; ALCH</strong>
                      <small>Fold real 3D proteins &amp; earn bonus sparks</small>
                    </div>
                  </div>
                </div>
              </div>
            )
          ) : (
            <>
              {tab === "identity" && renderIdentityFields()}
              {tab === "hair" && renderHairFields()}
              {tab === "outfit" && renderOutfitFields()}
              {tab === "gear" && renderGearFields()}
            </>
          )}
        </div>

        <div className="creator-footer">
          {isFirstTime ? (
            <div className="onboarding-footer-row">
              {welcomeStep > 1 && (
                <button
                  type="button"
                  className="subtle-pill-btn clickable"
                  onClick={() => goWelcomeStep((welcomeStep - 1) as WelcomeStep)}
                >
                  <ArrowLeft size={14} /> Back
                </button>
              )}
              {welcomeStep < 3 ? (
                <button
                  type="button"
                  className="btn-mint-minimal clickable creator-confirm-btn"
                  style={{ flex: 1 }}
                  onClick={() => goWelcomeStep((welcomeStep + 1) as WelcomeStep)}
                >
                  <span>{welcomeStep === 1 ? "Next: Pick Your Clothes" : "Next: Ready to Move In"}</span>
                  <ArrowRight size={15} />
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-mint-minimal clickable creator-confirm-btn"
                  style={{ flex: 1 }}
                  onClick={() => {
                    soundEngine.playBuildRoom();
                    onConfirm(draft);
                  }}
                >
                  <UserCheck size={16} />
                  Step Inside My 3D Lab!
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              className="btn-mint-minimal clickable creator-confirm-btn"
              onClick={() => {
                soundEngine.playBuildRoom();
                onConfirm(draft);
              }}
            >
              <UserCheck size={16} />
              Save Outfit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
