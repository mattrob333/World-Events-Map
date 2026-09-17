# Traveler Profiles

## Product intent

The MERIDIAN profile is a product surface, not a Settings record.

The design target is the pride people used to put into early social-network profiles: a page that feels authored, recognizable and worth sharing. MERIDIAN should capture that energy without allowing arbitrary HTML/CSS, unsafe embeds or accidental privacy leaks.

A good traveler profile answers:

- Who are you when you travel?
- What kinds of trips pull you out into the world?
- Where are you based?
- What have you loved?
- What is next?
- What content gets you excited to go?
- What other public identities do you want people to know?

## Profile vs Travel Mode

The base profile is durable identity.

Travel Modes are contextual lenses.

Example:

```text
Profile: Matt
  home base: Atlanta
  broad interests: skiing, food, aviation, F1

  Family Ski
    family
    school-break dates
    skiing + food + other families

  Work Layover
    solo/work
    time constrained
    restaurants + nightlife + live music
```

The public profile can show discoverable Travel Modes, but a member can hide them independently of the profile itself.

## Safe customization

The first version allows:

- handle
- display name
- headline
- biography
- avatar URL
- cover image URL
- approved visual themes
- interests
- home base visibility
- Travel Mode visibility
- social/web links
- favorite, visited and bucket-list places
- a curated travel-content wall

The product deliberately does not allow arbitrary CSS, JavaScript, raw HTML or arbitrary third-party embed code.

## Public profile boundary

Anonymous visitors never receive direct table access to the profile editing model.

Public profiles are exposed through `traveler_snapshot(handle)`, a narrow security-definer RPC that:

- returns only public profiles
- applies home-base visibility
- returns only public links, places and profile pins
- returns only discoverable Travel Modes when the profile allows them
- never exposes auth email or other auth metadata

This is the public contract for `/traveler/[handle]`.

## Profile completeness

Profile setup should feel like building something, not completing compliance fields.

The current completeness model rewards:

- traveler identity
- a meaningful story
- home base
- interests
- at least one Travel Mode
- a useful places shelf
- travel inspiration
- at least one connected public identity

The score is explainable and deterministic. It is not a social-status score.

## Future profile layers

Likely additions after real-user testing:

- first-party image uploads through controlled object storage
- visited-country map
- trip history generated from completed Circles
- memories/photo albums
- recommendations received/given
- profile reactions or lightweight endorsements
- follow/friend model only if Circle relationships prove insufficient
- richer safe themes and section ordering

Do not add actual passport numbers, government identity documents or sensitive travel documents to this profile system.
