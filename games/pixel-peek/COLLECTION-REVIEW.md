# Pixel Peek collection review

Date added: 31 October 2026. Status: implemented and tested locally; not deployed.

## Collection

**1,183 additional images**, organized into seven photo packs. Together with the original packs, the game contains **3,663 pictures in 38 packs**.

| Primary category | Images |
|---|---:|
| For Us | 135 |
| Gaming | 166 |
| Movies | 213 |
| Series | 152 |
| Anime | 124 |
| Memes & Relatable | 116 |
| Music & Other Interests | 277 |

No category exceeds 24% of the new collection. Each image has one category; tags connect related subjects without copying entries.

Assumptions: a general friend-group mix, familiar global and South Asian entertainment, English and common Roman spellings, and mixed visual moods. No age, actual favorite franchises, private photos or inside jokes were supplied. The For Us category uses relatable everyday references rather than claiming to show the group.

There are 425 licensed portraits, 487 other photographs, 260 fan cosplay photographs, six public-domain artworks, and five specifically labeled composites, screenshots, official/model or display assets. No generated artwork was used. Cosplay is explicitly distinguished from official imagery.

## Review and image handling

Every delivered image was checked on full-frame contact sheets. Source metadata and full images were consulted for ambiguous identities. Wrong subjects were removed or correctly retitled. Examples include identifying the original Superman publicity photograph as Kirk Alyn and a photographed Assassin's Creed voice actor as Matt Ryan. Weak shots, unclear crowds, excessive text and near-repeated scenes were excluded.

All 1,183 delivered files decode successfully. IDs, file paths, normalized titles and SHA-256 content hashes are unique. A conservative visual-similarity check found no remaining candidates below its combined perceptual-distance and pixel-difference threshold. That check supplements the visual review rather than proving there can never be another similar shot.

Images are resized to a maximum edge of 960 pixels and converted to WebP. Both dimensions are at least 380 pixels. No new crops were applied; source framing is preserved in the gallery and the game, with letterboxing where necessary. The new images total approximately 120 MiB. Game packs fetch metadata first, then load each round's image when needed. The gallery loads 48 entries at a time with lazy image loading.

## Answers and character names

6,902 accepted answer strings are included across the new picture entries. 586 entries have character or role names. Actor portraits accept recognizable roles from movies, series, voice acting and games, as well as the actor's name. Character photos accept standard names and common short forms. Group scenes accept verified main subjects without pretending to be a single person.

Examples:

| Image | Accepted alternatives |
|---|---|
| Bryan Cranston | Walter White, Heisenberg, Hal |
| Robert Downey Jr. | Tony Stark, Iron Man, Sherlock Holmes |
| Cillian Murphy | Tommy Shelby, Thomas Shelby, Oppenheimer |
| David Tennant | The Doctor, Crowley, Barty Crouch Jr. |
| Keanu Reeves | Neo, John Wick, Johnny Silverhand |
| Matt Ryan | John Constantine, Edward Kenway |
| Naruto Uzumaki | Naruto |

Existing case, punctuation, accent normalization and typo tolerance are preserved. Aliases are not expanded through another actor's roles. For custom photos, the supplied full actor name activates the same registry. Custom photos remain exclusive to online matches; the uploader cannot score on their own photo.

Role names combine editorially selected well-known alternatives with Wikidata cast/character statements (P161/P453). Sourced records retain the work title and exact Wikidata work/character URLs in `provenance.json`. Wikidata structured data is CC0: https://www.wikidata.org/wiki/Wikidata:Licensing. Editorial aliases are not presented as quoted source claims. Directors are not assigned characters they merely directed.

## Organization and controls

Search includes titles, franchises, people, tags and accepted answers. Filters cover category, franchise/topic, mood, orientation and favorites. Sorting covers recommended, newest, title and favorites first. Favorites are separate from categories, saved per browser and not shared with other players.

The stable default sequence uses personal relevance, a five-point quality band, category/franchise variety, date added and title. All entries have the same neutral personal-relevance score because no individual preferences were supplied. Favorites do not silently rewrite recommended order.

Per-file metadata records title, category, topic, franchise, identified people, mood/style tags, relevance, author/credit, exact source and license links, original/display dimensions, orientation, date added, asset type and accepted answers. See `collection/catalog.csv` for an editable table, `catalog.json` for runtime data, and `provenance.json` for complete source records.

## Sources and credits

All new source files came from Wikimedia Commons via actual API-returned file URLs and metadata. Individual source pages, authors, credit fields, license versions, license URLs and source restrictions are retained. They use Creative Commons Attribution, Attribution-ShareAlike, CC0 or Public Domain terms as reported by the source. Files remain covered by their recorded terms after resizing and conversion. Existing game credits remain available.

Character, likeness and other restrictions noted by the source remain attached to the file. A photographer's license is not represented as a separate endorsement or ownership grant from a performer or franchise. The gallery labels fan photography, official material and other asset types separately.

## Validation

- 1,183 image decodes and file/dimension checks passed.
- Catalog, seven photo packs, pack counts, IDs and local asset paths agree.
- 24 positive/negative answer checks use the actual game matching functions: 19 built-in cases and five custom-photo cases. Recognizable roles pass and unrelated names fail.
- A live practice round accepted **The Doctor** for **David Tennant**, awarded **25 points**, and displayed the correct actor answer.
- Gallery search by character name, category/franchise/orientation filters, sorting, pagination, favorites persistence, reset, image details and source/license links were exercised in the browser.
- Mobile gallery layout was checked for overflow and full-frame image fitting. Actor photos were checked through the actual canvas reveal flow.
- No multiplayer/network protocol changes were made. Real multi-device online play was not tested in this update.

## Local use and deployment

Run `node serve.cjs` in this folder, then open http://localhost:4173/ for the game or http://localhost:4173/collection.html for the gallery. A temporary preview also runs at http://localhost:4175/ during this task.

The original 31 packs and networking files are preserved. New photos are selected by default; classic presets still work. No GitHub push or Vercel deployment was performed. Deployment remains pending because the user chose to continue locally while Vercel team access was unavailable.
