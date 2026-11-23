import { useState } from "react";
import {
  Dices,
  FlipHorizontal2,
  Footprints,
  Glasses,
  Palette,
  RefreshCw,
  Scissors,
  Shirt,
  Sparkles,
  UserCheck,
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
  const [tab, setTab] = useState<CreatorTab>(isFirstTime ? "identity" : "outfit");
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

      {/* Right frosted-glass architectural character & clothing wardrobe panel */}
      <div className="glass-panel creator-card">
        <div className="creator-head">
          <div>
            <div className="single-kicker">
              {isFirstTime ? "Welcome to your 3D lab" : "Researcher Closet"}
            </div>
            <h2 className="creator-title">
              {isFirstTime ? "Design your character" : "Wardrobe & Style"}
            </h2>
          </div>

          <div style={{ display: "flex", gap: 6 }}>
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

        {/* Instant Curated Fashion & Archetype Presets (8 stylish looks!) */}
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

        {/* Studio Category Tabs (Auto-frames camera to Face / Hair / Full Clothes / Back Gear!) */}
        <div className="creator-tabs" role="tablist" aria-label="Character sections">
          {(
            [
              { id: "identity", label: "Face", Icon: Palette },
              { id: "hair", label: "Hair", Icon: Scissors },
              { id: "outfit", label: "Clothes", Icon: Shirt },
              { id: "gear", label: "Gear", Icon: Glasses }
            ] as const
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

        <div className="creator-body">
          {tab === "identity" && (
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
          )}

          {tab === "hair" && (
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
          )}

          {tab === "outfit" && (
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
                            (draft.outfitBaseColor || "#f8fafd").toLowerCase() ===
                            c.hex.toLowerCase()
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
          )}

          {tab === "gear" && (
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
          )}
        </div>

        <div className="creator-footer">
          <button
            type="button"
            className="btn-mint-minimal clickable creator-confirm-btn"
            onClick={() => {
              soundEngine.playBuildRoom();
              onConfirm(draft);
            }}
          >
            <UserCheck size={16} />
            {isFirstTime ? "Enter My Lab" : "Save Outfit"}
          </button>
        </div>
      </div>
    </div>
  );
}
