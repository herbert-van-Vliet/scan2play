# scan2play

A lightweight, client-side NFC- and QR-enabled audio player for scanning and playing audio content from NFC tags or QR codes embedded in physical books or materials.

## Features

- **NFC Tag Scanning** — Tap the large NFC icon to activate scanning. Continuously reads NFC tags without requiring repeated button presses.
- **QR Code Scanning** — Tap the QR icon to open a camera viewfinder. Automatically detects QR codes containing URLs and loads them for playback.
- **URL-Based Playback** — Extracts URLs from NFC tags and plays audio directly.
- **M3U Playlist Support** — Automatically parses M3U/M3U8 playlists and loads all tracks.
- **Smart Metadata** — Extracts track titles from ID3 tags (MP3); falls back gracefully to filename extraction with formatting (removes leading numbers, replaces hyphens with spaces, applies proper case).
- **Animated Waveform Visualizer** — Smooth wave animation that syncs with playback (pauses when audio is paused).
- **Playback Controls** — Previous/restart, play/pause, next track (multi-track playlists only).
- **Shuffle** — Shuffle playlist once on load via `?shuffle=1` parameter, or toggle via button.
- **Repeat** — Repeat playlist (jump to track 1 when end reached) via `?repeat=1` parameter, or toggle via button.
- **Session Memory** — Remembers all scanned/played tracks in the current session.
- **Dark Mode** — Optimized dark theme with high contrast.
- **Direct URL Playback** — Use `?url=...` query parameter to auto-play audio on page load.
- **Configurable Wait Time** — Set delay between tracks with `?wait=<seconds>` parameter (default: 0).
- **Pure Client-Side** — No backend required. All processing happens in the browser.
- **URL Validation** — Only accepts `http://` and `https://` URLs. Silently rejects unsafe input.

## Usage

### Scanning NFC Tags

1. Open the app on an Android device (Chrome or Edge with Web NFC API support).
2. Tap the large NFC icon to activate scanning.
3. Hold your NFC-tagged page near the device to read the tag.
4. The player automatically extracts the URL and loads the track.

NFC tags can include query parameters for shuffle, repeat, and wait time:
- `https://example.com/audio.mp3?shuffle=1&repeat=1&wait=2`

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

If the URL points to an M3U/M3U8 file, the app automatically:
- Parses all tracks in the playlist
- Loads them into the session
- Optionally shuffles (if `shuffle=1`)
- Starts playing the first track
- Enables next/previous navigation

Example:
```
https://player.metafor.no/?url=https://example.com/playlist.m3u
```

## Supported Audio Formats

**Audio:** MP3, WAV, FLAC, AAC, M4A, OGG, WMA
**Playlists:** M3U, M3U8

## NFC Tag Setup

Write NFC tags with a URL payload using an NFC writing app (e.g., NFC Tools for Android):

- **Record Type:** Text or URL
- **Content:** A complete URL pointing to audio or a playlist
  - Example: `https://example.com/song.mp3`
  - Example: `https://example.com/playlist.m3u`
  - Example: `https://example.com/song.mp3?shuffle=1&repeat=1&wait=2`

## Browser Compatibility

- ✅ **Android Chrome/Edge** — Full support with Web NFC API and QR camera scanning
- ⚠️ **iOS** — NFC reading available on iOS 13.1+, but Web NFC API not publicly supported. QR scanning works via camera on iOS 14.3+.
- ✅ **Desktop** — Direct URL mode works on all modern browsers (no scanning). QR scanning works if a camera is available.

**Device Detection:** If NFC is not supported, the app displays "NFC is not supported on this device. Please scan a QR code." instead of "Tap to scan..."

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

## Playback Behavior

- **Manual track changes** (prev/next buttons) — Play immediately
- **Track end** — Waits for configured wait time (default: 0 seconds), then advances to next track
- **Single track with repeat enabled** — Repeats the same track when it ends
- **Playlist with repeat enabled** — Jumps back to track 1 when playlist ends
- **Playlist with shuffle enabled** — Playlist is shuffled once on load

## Technical Details

### Metadata Extraction

1. **Audio (MP3)** — Attempts to read ID3v2 tags from the file.
2. **Fallback** — Extracts filename from URL path, removes leading numbers, replaces hyphens with spaces, and applies proper case.
3. **Silent Failure** — If metadata extraction fails, the app gracefully falls back without error messages.

### Session Tracking

The player maintains a session history of all scanned/played tracks in browser memory. Closing the page clears the history.

### URL Validation

- Only `http://` and `https://` URLs are accepted.
- All other schemes (e.g., `javascript:`, `data:`) are rejected.
- Invalid URLs are silently discarded; valid errors are shown briefly in the UI.

### CORS & Media Loading

The browser's CORS policy applies. Audio URLs must be from servers that allow cross-origin audio requests, or from the same origin. Server must support HTTP Range requests for proper seeking in audio files.

## Deployment

1. Place `index.html`, `jsQR.min.js`, `sw.js`, `manifest.json`, `scan2play_icon_192x192.png`, and `scan2play_icon_512x512.png` on your web server.
2. Update the domain in your NFC tag URLs and documentation.
3. Ensure server sends proper CORS headers for audio files:
   ```
   Access-Control-Allow-Origin: *
   Access-Control-Allow-Methods: GET, OPTIONS, HEAD
   Access-Control-Allow-Headers: Content-Type, Range
   Accept-Ranges: bytes
   ```
4. No build step required—minimal file set with inline CSS and JavaScript.

## Security

- **URL Validation** — Only http/https protocols allowed. JavaScript URLs and data: schemes are rejected.
- **No Server Communication** — All processing is client-side. No user data is sent anywhere.
- **CORS Protection** — Browser enforces cross-origin restrictions on media loading.

## License

Licensed under Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)

© 2026 REMARK Van-Vliet
Contact: info@remark.no
Repository: https://github.com/herbert-van-vliet/scan2play

See [LICENSE](LICENSE) file for full terms.
