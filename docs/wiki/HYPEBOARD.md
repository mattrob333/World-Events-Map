# Hypeboard

## Product insight

A large part of travel pleasure happens before departure.

People watch destination videos, send restaurant links, collect screenshots, argue about neighborhoods, discover a run they want to ski, and send each other “we have to do this” content for weeks or months. Most of that anticipation disappears into a chat thread.

MERIDIAN should make anticipation durable.

## The Hypeboard

Every accepted Travel Circle can have a private Hypeboard.

Members can share:

- YouTube videos
- Instagram post/reel URLs
- TikTok URLs
- public image URLs
- articles and guides
- restaurant and venue links
- their own note explaining why the item matters
- a destination label for later filtering

The goal is not to become another universal bookmarking app. The board exists because a specific group of people is going somewhere together.

## Lifecycle

```text
Discover a trip
      |
Form or join a Circle
      |
Hypeboard fills up
  videos
  food
  places
  ideas
      |
Group anticipation increases
      |
Meet in person
      |
NOW helps make local decisions
      |
Board + trip activity become memories
```

## Data model

`saved_content` is the member-owned canonical link record.

A single item can later be surfaced in multiple contexts without duplicating the URL or notes.

`profile_content` pins member-owned content to a public traveler profile.

`circle_content` shares member-owned content into a Circle and adds a Circle-specific caption.

The `share_circle_content` RPC performs the save + share transaction atomically after checking accepted Circle membership.

## Access rules

- A Circle Hypeboard is private to accepted Circle members.
- A member may share only content they own.
- The Circle host or original sharer can remove a shared item.
- A saved item can exist in the member library without being public anywhere.
- Profile publication and Circle sharing are separate decisions.

## External media

MERIDIAN stores URLs and member-authored metadata.

It should not scrape and republish third-party media as though MERIDIAN owns it.

Current rendering approach:

- YouTube: parse the video ID and use the official iframe embed surface.
- Images: render the provided HTTPS image URL.
- Instagram/TikTok/web: show an attributed outbound card initially.

Future platform-specific adapters may improve previews and search where official APIs and terms permit it.

## Instagram reality

Do not architect the consumer product around importing every member’s personal Instagram feed.

Meta discontinued the old Instagram Basic Display API for personal consumer accounts. Current first-party APIs primarily serve professional Business/Creator accounts. Public-post embedding and professional-account connections should therefore be treated as optional adapters rather than a dependency for traveler identity.

A normal MERIDIAN member can always add an Instagram profile link and share public Instagram URLs manually.

## Destination discovery

The next useful layer is destination-native inspiration.

For a place such as Courchevel, MERIDIAN should eventually combine:

- saved Hypeboard content
- public traveler wall pins
- embeddable YouTube search results
- event intelligence
- restaurants/venues
- live/local signals

That destination page can become the bridge between PULSE and a Circle: first the user gets excited about a place, then the user finds people to go with.
