# MERIDIAN World Pulse Dashboard

## Product job

The opening screen should answer four questions before the member does any work:

1. **What is happening near me?**
2. **Where is the world heating up?**
3. **Which place is worth getting on a plane for?**
4. **Who do I want to pull into this trip?**

The homepage is not an event directory. It is a **current-state travel dashboard**.

A member should be able to open MERIDIAN for thirty seconds, feel the world moving, notice a place they did not want to miss, and either explore it or open a Circle.

## First ten seconds

### 0–1 second

Show a dark world-state shell while the browser establishes the member's broad region. Do not render the legacy Africa-facing camera and then whip the camera across the planet.

### 1–3 seconds

Open the globe on the member's relevant hemisphere using a timezone-derived regional launch point. Ask for browser location with coarse accuracy in parallel.

### 3–6 seconds

When browser location is available, glide toward the member's region. Current coordinates are ephemeral launch context only.

The first dashboard should already show:

- **Nearest scene on the board**
- **World Heat**
- the globe with current hot destinations visible
- one-click access to **Circles**
- destination search
- planning date controls

### 6–10 seconds

The member should be able to click a place and immediately choose among:

- Explore this place
- Save
- Start a Circle
- Invite friends
- See what people are saving there
- Open the anticipation board
- View live / trending / seasonal context

## Information hierarchy

The screen should read like a travel game dashboard, not a marketing homepage.

### Center: the living world

The globe is the primary control surface.

The member should understand heat spatially:

- where they are
- nearby scenes
- global hot spots
- clusters pulling people from multiple regions
- seasonal regions that are becoming relevant
- places their people are already watching or planning

### Left: Near You

This is not simply the geographically nearest event.

The mature version should answer:

> What is the closest place that is alive enough to be worth going to?

Inputs should eventually include:

- distance / realistic travel time
- current venue activity
- event density
- nightlife density
- social velocity
- season fit
- member / Circle activity

The first slice uses the nearest current MERIDIAN scene and displays the distance honestly.

### Right: World Heat

This answers:

> If distance did not matter, where would I feel stupid for missing this week?

World Heat should rank destination-level state, not only individual events.

The initial implementation can use existing event buzz. The destination model should aggregate:

- social mention volume
- social velocity
- search interest
- editorial/media velocity
- booking pressure
- major event relevance
- venue/nightlife activity
- weather/season fit
- member intent
- Circle formation
- partner scarcity / availability where appropriate

## Destination state, not just events

A city can be worth going to even when no marquee event is running.

The next data abstraction above `WorldEvent` should be a destination pulse such as:

```ts
interface DestinationPulse {
  id: string;
  city: string;
  country: string;
  coords: GeoPoint;

  sceneScore: number;        // 0..100
  trend: number;             // cooling -> surging
  status: 'live' | 'heating-up' | 'seasonal' | 'steady';

  nearbyEventIds: string[];
  archetypes: DestinationArchetype[];

  signalFreshness: {
    social?: string;
    venues?: string;
    search?: string;
    bookings?: string;
    weather?: string;
  };
}
```

The exact score weights should remain a product/model layer rather than being baked into the renderer.

## Visual grammar: World Scene Engine

The globe can feel like a game engine without becoming a theme-park gimmick.

The rule is:

> **Data chooses the scene treatment. The scene treatment never invents data.**

### Base globe

Keep the premium obsidian / illuminated-earth identity.

### Heat

Use spatial glow, clustered pulses, atmospheric intensity, and subtle vertical activity rather than only larger dots.

### Seasonal overlays

When a region is relevant, render lightweight scene cues around the selected or highly ranked destination.

Examples:

- **Ski**: low-poly ridge silhouette, snow field, tiny lift / skier movement
- **Beach / island**: water shimmer, palms, shoreline glow
- **Festival / nightlife**: light shafts, pulses, rooftop/city glow
- **Sailing**: harbor lines, sail silhouettes
- **Motorsport**: circuit trace / moving light streak
- **Nature / safari**: terrain tint, landscape silhouette
- **Art / fashion / film**: urban landmark / spotlight language

Do not cover the entire planet with miniatures. Treatments should be sparse and use LOD.

### Technical constraints

Prefer:

- instanced meshes
- GPU-friendly particles
- region-specific LOD
- selected / top-N scene activation
- procedural low-poly assets
- cached destination archetypes

Avoid hundreds of React DOM labels or bespoke high-poly models.

## FOMO needs provenance

MERIDIAN should be aggressive about excitement and conservative about claims.

Good labels:

- **Live venue activity**
- **Social velocity rising**
- **Search interest surging**
- **Booking pressure**
- **Season is peaking**
- **People in your network are watching**
- **Modeled World Heat**

Bad labels unless directly measured:

- "12,000 people partying here now"
- "live crowd" from historical data
- "sold out" inferred from price
- "trending on Instagram" without a supported measurement source

Every heat state should know why it exists and how fresh its inputs are.

## Circle handoff

A destination selection should not dead-end in an event dossier.

The high-value action is:

> **Start the trip before the trip exists.**

From any destination:

1. Start a Circle
2. Invite travel friends
3. Name the trip
4. Pick rough dates
5. Open **Inspiration**

The Inspiration layer should accept:

- YouTube
- Instagram/public social links
- articles
- restaurants
- bars
- nightclubs
- tours
- events
- hotels / homes
- private aviation / transport opportunities
- member notes

Members can mark items:

- **Must Do**
- **Maybe**
- **Skip**

Those choices become group context.

## Anticipation becomes intelligence

The buildup is not fluff. It is behavioral data that can improve the trip.

Example:

A Circle saves:
- four Le Marais videos
- three cocktail bars
- two late-night restaurants
- one house party
- one museum

When the group lands in Paris, NOW should know that context.

That creates the closed loop:

**World Heat → Destination → Circle → Inspiration → Group intent → NOW → Outcome**

## Product surfaces

The homepage should ultimately feel like five connected lenses rather than five separate apps:

- **WORLD**: current travel state
- **NEAR ME**: what is worth doing / reaching from here
- **CIRCLES**: my travel people and active trips
- **PLAN**: anticipation and collaboration
- **NOW**: decisions after arrival

Profiles remain the identity layer underneath all five.

## Near-term build order

1. Ship location-first globe boot and Near You / World Heat split.
2. Add a destination aggregation model above events.
3. Add a destination drawer with Circle / Save / Invite actions.
4. Make Circle Inspiration the default planning workspace.
5. Add supported social/place discovery adapters.
6. Add destination archetypes and the World Scene Engine.
7. Feed saved Circle intent into NOW.
