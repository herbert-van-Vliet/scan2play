# scan2play

A lightweight, client-side NFC- and QR-enabled audio and video player for scanning and playing media content from NFC tags or QR codes embedded in physical books or materials.

## Features

- **NFC Tag Scanning** — Tap the NFC icon to activate scanning. Continuously reads NFC tags without requiring repeated button presses. Hidden automatically on devices without NFC support.
- **QR Code Scanning** — Tap the QR icon to open a camera viewfinder. Uses the native `BarcodeDetector` API where available, with jsQR as fallback. Automatically detects QR codes containing URLs and loads them for playback.
- **Redirect Resolution** — Short URLs and redirects are resolved server-side via `resolve/index.php` before playback. Falls back gracefully if the resolver is unavailable.
- **Player URL Detection** — If a scanned QR code points to the player itself (same origin, `?url=` parameter), the inner URL and parameters are extracted and used directly.
- **URL-Based Playback** — Extracts URLs from NFC tags or QR codes and plays media directly.
- **M3U Playlist Support** — Automatically parses M3U/M3U8 playlists and loads all tracks.
- **Video Support** — Plays MP4, WebM, OGV, and MOV files natively via the `<video>` element.
- **Smart Metadata** — Extracts track titles from filename with formatting (removes leading numbers, replaces hyphens with spaces, applies proper case).
- **Animated Waveform Visualizer** — Smooth wave animation that syncs with audio playback.
- **Playback Controls** — Previous/restart, play/pause, next track (multi-track playlists only).
- **Shuffle** — Shuffle playlist once on load via `?shuffle=1` parameter, or toggle via button.
- **Repeat** — Repeat playlist (jump to track 1 when end reached) via `?repeat=1` parameter, or toggle via button.
- **Share** — Share button generates a QR code and player URL for the current source. Tap QR or URL to copy to clipboard.
- **Bookmarks** — Bookmark button saves the current source URL to localStorage. Open the bookmark list to replay saved sources or delete them. List auto-closes when the last bookmark is removed.
- **Session Memory** — Remembers all scanned/played tracks in the current session.
- **Dark Mode** — Optimized dark theme with high contrast.
- **Direct URL Playback** — Use `?url=...` query parameter to auto-play media on page load.
- **Configurable Wait Time** — Set delay between tracks with `?wait=<seconds>` parameter (default: 0).
- **Offline Support** — Service worker precaches all assets for offline use.
- **Installable PWA** — Can be installed as a fullscreen app via the browser's Add to Home Screen.
- **URL Validation** — Only accepts `http://` and `https://` URLs. Silently rejects unsafe input.

## Usage

### Scanning NFC Tags

1. Open the app on an Android device (Chrome or Edge with Web NFC API support).
2. Tap the NFC icon to activate scanning.
3. Hold your NFC-tagged page near the device to read the tag.
4. The player automatically extracts the URL and loads the media.

NFC tags can include query parameters for shuffle, repeat, and wait time:
- `https://example.com/audio.mp3?shuffle=1&repeat=1&wait=2`

### Scanning QR Codes

1. Tap the QR icon to open the camera viewfinder.
2. Point the camera at a QR code containing a URL.
3. The app detects the code, resolves any redirects, and loads the media.
4. Tap anywhere to close the viewfinder without scanning.

### Sharing

Tap the share button while media is playing to show a QR code for the current source URL (playlist or single file), including active shuffle, repeat, and wait settings. Tap the QR code or URL to copy the player link to the clipboard.

### Direct URL Playback

Use the `?url=...` query parameter to auto-play media on page load:

```
https://player.metafor.no/?url=https://example.com/audio.mp3
```

### Query Parameters

- `url` — URL of media file or M3U playlist (required for auto-play)
- `shuffle` — Set to `1` to shuffle playlist on load
- `repeat` — Set to `1` to enable repeat (playlist loops back to track 1)
- `wait` — Delay in seconds between tracks (default: 0)

Examples:
```
https://player.metafor.no/?url=https://example.com/playlist.m3u&shuffle=1
https://player.metafor.no/?url=https://example.com/playlist.m3u&repeat=1
https://player.metafor.no/?url=https://example.com/playlist.m3u&shuffle=1&repeat=1&wait=2
```

### M3U Playlists

If the URL points to an M3U/M3U8 file, the app automatically parses all tracks, loads them into the session, optionally shuffles, starts playing the first track, and enables next/previous navigation.

## Supported Formats

**Audio:** MP3, WAV, FLAC, AAC, M4A, OGG, WMA
**Video:** MP4, WebM, OGV, MOV
**Playlists:** M3U, M3U8

## NFC Tag Setup

Write NFC tags with a URL payload using an NFC writing app (e.g., NFC Tools for Android):

- **Record Type:** Text or URL
- **Content:** A complete URL pointing to media or a playlist
  - Example: `https://example.com/song.mp3`
  - Example: `https://example.com/playlist.m3u`
  - Example: `https://example.com/song.mp3?shuffle=1&repeat=1&wait=2`

## Browser Compatibility

- ✅ **Android Chrome/Edge** — Full support with Web NFC API and QR camera scanning
- ⚠️ **iOS** — NFC reading not supported via Web NFC API. QR scanning works via camera on iOS 14.3+.
- ✅ **Desktop** — Direct URL mode works on all modern browsers. QR scanning works if a camera is available.
- ⚠️ **Brave** — Web NFC not supported. QR scanning uses native `BarcodeDetector` API to avoid canvas fingerprinting restrictions.

**Device Detection:** If NFC is not supported, the NFC button and status message are hidden automatically, leaving only the QR button.

## Controls

| Control | Action |
|---------|--------|
| NFC Icon | Start/continue NFC scanning |
| QR Icon | Open camera viewfinder for QR code scanning |
| Previous (⏮) | Go to previous track, or restart current track on single-track playback |
| Play/Pause (▶/⏸) | Toggle playback |
| Next (⏭) | Go to next track (only visible for multi-track playlists) |
| Shuffle (🔀) | Toggle shuffle mode (brightens green when active) |
| Repeat (🔁) | Toggle repeat mode (brightens green when active) |
| Bookmark | Save current source URL; open bookmark list to replay or delete saved sources |
| Share | Show QR code and URL for the current source |

## Playback Behavior

- **Manual track changes** (prev/next buttons) — Play immediately
- **Track end** — Waits for configured wait time (default: 0 seconds), then advances to next track
- **Single track with repeat enabled** — Repeats the same track when it ends
- **Playlist with repeat enabled** — Jumps back to track 1 when playlist ends
- **Playlist with shuffle enabled** — Playlist is shuffled once on load

## Technical Details

### QR Code Detection

The app uses a two-tier approach: the native `BarcodeDetector` API is used when available (Chrome, Edge, newer Brave), as it bypasses canvas fingerprinting restrictions and handles both normal and inverted QR codes. jsQR is used as a fallback with canvas-based detection at a capped resolution of 640px wide, running at ~5fps to reduce CPU usage.

### Redirect Resolution

A PHP-based resolver at `resolve/index.php` follows HTTP redirects server-side and returns the final URL. This allows short URLs (e.g. `307.no/abc`) to be resolved to their actual media target before playback. The resolver includes SSRF protection (blocks private IP ranges), referer validation, rate limiting, and a timeout. The player probes for the resolver on startup and falls back gracefully if it is unavailable.

### Session Tracking

The player maintains a session history of all scanned/played tracks in browser memory. Closing the page clears the history.

### URL Validation

- Only `http://` and `https://` URLs are accepted.
- All other schemes (e.g., `javascript:`, `data:`) are rejected.
- Invalid URLs are silently discarded; valid errors are shown briefly in the UI.

### CORS & Media Loading

The browser's CORS policy applies. Media URLs must be from servers that allow cross-origin requests, or from the same origin. Servers must support HTTP Range requests for proper seeking.

### Offline Support

A service worker (`sw.js`) precaches all static assets on first visit. Subsequent visits and media playback work offline. The service worker uses a cache-first strategy and clears old caches automatically on update.

## Deployment

1. Place the following files on your web server in the same directory:
   - `index.html`, `style.css`, `sw.js`, `manifest.json`
   - `favicon.svg`, `scan2play_icon_192x192.png`, `scan2play_icon_512x512.png`
   - `js/scan2play.js`, `js/jsQR/jsQR.js`, `js/qrcodejs/qrcode.min.js`
   - `icons/` — all SVG icon files (including `bookmark-regular-full.svg` and `trash-can-regular-full.svg`)
   - `resolve/index.php` — optional, enables redirect resolution
2. Ensure the server sends proper CORS headers for media files:
   ```
   Access-Control-Allow-Origin: *
   Access-Control-Allow-Methods: GET, OPTIONS, HEAD
   Access-Control-Allow-Headers: Content-Type, Range
   Accept-Ranges: bytes
   ```
3. No build step required.

## Third-Party Libraries

- **jsQR** by Cosmo Wolfe — Apache 2.0 License. See `js/jsQR/` for license details.
- **qrcodejs** by davidshimjs — MIT License. See `js/qrcodejs/` for license details.

## Security

- **URL Validation** — Only http/https protocols allowed. JavaScript URLs and data: schemes are rejected.
- **Redirect Resolver** — Blocks private/loopback IP ranges, validates referer, enforces rate limiting.
- **No Tracking** — All processing is client-side. No user data is sent to any third party.
- **CORS Protection** — Browser enforces cross-origin restrictions on media loading.

## License

Licensed under Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)

© 2026 remark.no
Contact: info@remark.no
Repository: https://github.com/herbert-van-vliet/scan2play

See [LICENSE](LICENSE) file for full terms.
