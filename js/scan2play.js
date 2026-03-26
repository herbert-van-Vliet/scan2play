// scan2play.js
// (c) 2026, info@remark.no
// v1.2.1

const ICONS = {
  'icon-nfc':         './icons/nfc-symbol-brands-solid-full.svg',
  'icon-qr':          './icons/qrcode-solid-full.svg',
  'icon-play':        './icons/play-solid-full.svg',
  'icon-pause':       './icons/pause-solid-full.svg',
  'icon-backward':    './icons/backward-step-solid-full.svg',
  'icon-forward':     './icons/forward-step-solid-full.svg',
  'icon-shuffle':     './icons/shuffle-solid-full.svg',
  'icon-repeat':      './icons/repeat-solid-full.svg',
  'icon-share':       './icons/arrow-up-right-from-square-solid-full.svg',
  'icon-share-nodes': './icons/share-nodes-solid-full.svg',
  'icon-bookmark':    './icons/bookmark-regular-full.svg',
  'icon-trash':       './icons/trash-can-regular-full.svg'
};

async function loadIcon(id, path) {
  try {
    const response = await fetch(path);
    const text = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    const symbol = document.createElementNS('http://www.w3.org/2000/svg', 'symbol');
    symbol.setAttribute('id', id);
    symbol.setAttribute('viewBox', svg.getAttribute('viewBox'));
    symbol.innerHTML = svg.innerHTML;
    document.getElementById('icon-sprite').appendChild(symbol);
  } catch (err) {
    console.error('Failed to load icon:', id, err);
  }
}

Promise.all(Object.entries(ICONS).map(([id, path]) => loadIcon(id, path)));

const RESOLVER_URL = `${window.location.origin}/resolve/`;
let resolverAvailable = false;

fetch(`${RESOLVER_URL}?url=${encodeURIComponent(window.location.origin)}`)
  .then(r => { if (r.ok) resolverAvailable = true; })
  .catch(() => {})
  .finally(() => console.log('Resolver available:', resolverAvailable));

const state = {
  playlist: [],
  originalPlaylist: [],
  currentTrackIndex: 0,
  sessionTracks: [],
  shuffleEnabled: false,
  repeatEnabled: false,
  visualizerActive: true,
  ndefReader: null,
  waitTime: 0,
  sourceUrl: null
};

const dom = {
  scanBtn: document.getElementById('scanBtn'),
  nfcLog: document.getElementById('nfcLog'),
  playerSection: document.getElementById('playerSection'),
  trackTitle: document.getElementById('trackTitle'),
  trackCounter: document.getElementById('trackCounter'),
  visualizer: document.getElementById('visualizer'),
  audioPlayer: document.getElementById('audioPlayer'),
  audioContainer: document.getElementById('audioContainer'),
  playPauseBtn: document.getElementById('playPauseBtn'),
  prevBtn: document.getElementById('prevBtn'),
  nextBtn: document.getElementById('nextBtn'),
  shuffleBtn: document.getElementById('shuffleBtn'),
  repeatBtn: document.getElementById('repeatBtn'),
  errorMessage: document.getElementById('errorMessage'),
  helpModal: document.getElementById('helpModal'),
  modalClose: document.getElementById('modalClose'),
  controlsWrapper: document.getElementById('controlsWrapper'),
  progressBar: document.getElementById('progressBar'),
  progressFill: document.getElementById('progressFill'),
  progressDot: document.getElementById('progressDot'),
  videoPlayer: document.getElementById('videoPlayer'),
  mediaWrapper: document.getElementById('mediaWrapper'),
  shareBtn: document.getElementById('shareBtn'),
  shareModal: document.getElementById('shareModal'),
  shareModalClose: document.getElementById('shareModalClose'),
  shareQrCode: document.getElementById('shareQrCode'),
  shareUrl: document.getElementById('shareUrl'),
  shareUrlFeedback: document.getElementById('shareUrlFeedback'),
  bookmarkBtn: document.getElementById('bookmarkBtn'),
  bookmarkModal: document.getElementById('bookmarkModal'),
  bookmarkList: document.getElementById('bookmarkList'),
  qrBtn: document.getElementById('qrBtn'),
  qrOverlay: document.getElementById('qrOverlay'),
  qrVideo: document.getElementById('qrVideo'),
  qrCanvas: document.getElementById('qrCanvas'),
  qrStatus: document.getElementById('qrStatus'),
  qrClose: document.getElementById('qrClose')
};

const utils = {
  isValidUrl(url) {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  },

  isAudioUrl(url) {
    const exts = ['.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg', '.wma'];
    return exts.some(ext => url.toLowerCase().includes(ext));
  },

  isVideoUrl(url) {
    const exts = ['.mp4', '.webm', '.ogv', '.mov'];
    return exts.some(ext => url.toLowerCase().includes(ext));
  },

  shuffleArray(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  },

  async extractTitle(url) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = pathname.substring(pathname.lastIndexOf('/') + 1).split('?')[0];
      let title = decodeURIComponent(filename.replace(/\.[^.]+$/, '')) || 'Unknown';
      
      title = title.replace(/-/g, ' ').replace(/^\d+\s*/, '').trim();
      title = title.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      
      return title || 'Unknown';
    } catch {
      return 'Unknown';
    }
  },

  async parsePlaylist(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const text = await response.text();
      const tracks = [];
      
      text.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.startsWith('http')) {
          if (utils.isValidUrl(trimmed)) {
            tracks.push(trimmed);
          }
        }
      });
      
      return tracks;
    } catch (error) {
      console.error('Playlist parse error:', error);
      ui.showError('Failed to load playlist');
      return [];
    }
  }
};

const ui = {
  showError(message, showModal = false) {
    const icon = showModal ? ' ⓘ' : '';
    dom.errorMessage.innerHTML = message + icon;
    dom.errorMessage.classList.add('active');
    dom.errorMessage.style.cursor = showModal ? 'pointer' : 'default';
    setTimeout(() => dom.errorMessage.classList.remove('active'), 5000);
  },

  updateNfcLog(id, url) {
    dom.nfcLog.textContent = `Scanned.
${id}
${url}`;
    dom.nfcLog.classList.add('active');
  },

  async updateTrackDisplay() {
    if (state.playlist.length === 0) return;
    
    const track = state.playlist[state.currentTrackIndex];
    const title = await utils.extractTitle(track);
    dom.trackTitle.textContent = title;

    const total = state.playlist.length;
    if (total > 1) {
      dom.nextBtn.style.display = 'flex';
      dom.trackCounter.textContent = `${state.currentTrackIndex + 1} / ${total}`;
      dom.trackCounter.classList.add('active');
      dom.nextBtn.style.display = 'block';
      dom.prevBtn.style.display = 'block';
    } else {
      dom.nextBtn.style.display = 'none';
      dom.prevBtn.style.display = 'none';
      dom.trackCounter.classList.remove('active');
    }

    dom.nfcLog.style.display = 'none';
  },

  updateButtonStates() {
    dom.shuffleBtn.classList.toggle('active', state.shuffleEnabled);
    dom.repeatBtn.classList.toggle('active', state.repeatEnabled);
  },

  toggleDim() {
    state.visualizerActive = !state.visualizerActive;
    document.querySelectorAll('.dimmable').forEach(el => el.classList.toggle('dim'));
  }
};

const player = {
  async loadAndPlay(url, autoPlay = false, options = {}) {
    console.log('loadAndPlay called with:', { url, autoPlay, options });
    
    if (!utils.isValidUrl(url)) {
      console.error('Invalid URL:', url);
      ui.showError('Invalid URL');
      return;
    }

    state.sourceUrl = url;

    const urlObj = new URL(url);
    if (urlObj.searchParams.has('wait')) {
      state.waitTime = parseInt(urlObj.searchParams.get('wait'), 10) || 0;
      console.log('Wait time from URL:', state.waitTime);
    }

    if (url.toLowerCase().endsWith('.m3u') || url.toLowerCase().endsWith('.m3u8')) {
      console.log('Parsing playlist from:', url);
      state.playlist = await utils.parsePlaylist(url);
      console.log('Playlist loaded, tracks:', state.playlist.length);
      if (state.playlist.length === 0) {
        console.error('Playlist is empty');
        ui.showError('Failed to load playlist');
        return;
      }
    } else {
      state.playlist = [url];
      console.log('Single track loaded:', url);
    }

    state.originalPlaylist = [...state.playlist];
    state.currentTrackIndex = 0;

    if (options.shuffle) {
      state.playlist = utils.shuffleArray(state.playlist);
      console.log('Playlist shuffled');
    }
    
    state.shuffleEnabled = options.shuffle || false;
    state.repeatEnabled = options.repeat || false;

    state.playlist.forEach(track => {
      if (!state.sessionTracks.includes(track)) {
        state.sessionTracks.push(track);
      }
    });

    console.log('Session tracks:', state.sessionTracks.length);
    ui.updateButtonStates();
    dom.playerSection.classList.add('active');
    dom.controlsWrapper.classList.add('active');
    await ui.updateTrackDisplay();
    this.playTrack(state.currentTrackIndex, autoPlay);
  },

  playTrack(index, autoPlay = false) {
    if (index < 0 || index >= state.playlist.length) {
      console.warn('Invalid track index:', index);
      return;
    }
    
    state.currentTrackIndex = index;
    const trackUrl = state.playlist[index];
    
    console.log('Playing track', index + 1, 'of', state.playlist.length, ':', trackUrl);

    if (utils.isVideoUrl(trackUrl)) {
      dom.playerSection.style.display = 'none';
      dom.videoPlayer.style.display = 'block';
      dom.videoPlayer.src = trackUrl;
      if (autoPlay) {
        console.log('Auto-playing video in 3 seconds...');
        setTimeout(() => dom.videoPlayer.play(), 3000);
      }
    } else {
      dom.videoPlayer.style.display = 'none';
      dom.videoPlayer.src = '';
      dom.playerSection.classList.add('active');
      dom.audioContainer.style.display = 'block';
      dom.audioPlayer.src = trackUrl;
      dom.visualizer.classList.add('visualizer-paused');
      if (autoPlay) {
        console.log('Auto-playing in 3 seconds...');
        setTimeout(() => dom.audioPlayer.play(), 3000);
      }
    }

    ui.updateTrackDisplay();
    dom.playPauseBtn.innerHTML = '<svg class="icon"><use href="#icon-play"/></svg>';
  },

  currentMedia() {
    const trackUrl = state.playlist[state.currentTrackIndex] || '';
    return utils.isVideoUrl(trackUrl) ? dom.videoPlayer : dom.audioPlayer;
  },

  updateProgress() {
    const media = this.currentMedia();
    if (!media.duration || media.duration === Infinity) return;
    const percent = (media.currentTime / media.duration) * 100;
    dom.progressFill.style.width = percent + '%';
    dom.progressDot.style.left = percent + '%';
  },

  async startScanning() {
    if (!('NDEFReader' in window)) {
      console.error('NFC not supported on this device');
      ui.showError('NFC is not supported on this device.\nPlease scan a QR code.', true);
      return;
    }

    console.log('Starting NFC scan...');
    
    state.ndefReader = null;

    dom.nfcLog.style.display = 'block';
    dom.scanBtn.classList.add('scanning');
    dom.nfcLog.textContent = 'Scanning...';
    dom.nfcLog.classList.add('active');

    try {
      const reader = new NDEFReader();
      state.ndefReader = reader;

      await reader.scan();
      console.log('NFC reader initialized and scanning...');

      reader.onreading = (event) => {
        const tagId = event.serialNumber || 'Unknown';
        console.log('NFC tag detected. ID:', tagId);
        
        let foundUrl = null;

        event.message.records.forEach(record => {
          if (!foundUrl) {
            if (record.recordType === 'text') {
              const text = new TextDecoder().decode(record.data);
              console.log('Text record found:', text);
              if (text.startsWith('http://') || text.startsWith('https://')) {
                foundUrl = text;
              }
            } else if (record.recordType === 'url') {
              foundUrl = new TextDecoder().decode(record.data);
              console.log('URL record found:', foundUrl);
            }
          }
        });

        if (foundUrl) {
          console.log('Loading URL from NFC tag:', foundUrl);
          ui.updateNfcLog(tagId, foundUrl);
          this.loadAndPlay(foundUrl, true);
        } else {
          console.warn('No URL found in NFC tag');
          ui.showError('No URL found in tag', false);
        }
      };

      reader.onreadingerror = () => {
        console.error('NFC read error');
        ui.showError('Error reading NFC tag', true);
        dom.scanBtn.classList.remove('scanning');
      };

    } catch (error) {
      console.error('NFC scan error:', error);
      ui.showError(error.message || 'NFC scan failed', true);
      dom.scanBtn.classList.remove('scanning');
    }
  }
};

function handleScannedUrl(url) {
  const parsed = new URL(url);
  if (parsed.origin === window.location.origin && parsed.searchParams.has('url')) {
    const innerUrl = parsed.searchParams.get('url');
    const options = {
      shuffle: parsed.searchParams.get('shuffle') === '1',
      repeat:  parsed.searchParams.get('repeat')  === '1'
    };
    if (parsed.searchParams.has('wait')) {
      state.waitTime = parseInt(parsed.searchParams.get('wait'), 10) || 0;
    }
    console.log('Same-origin player URL detected, extracting:', innerUrl, options);
    player.loadAndPlay(innerUrl, true, options);
  } else {
    player.loadAndPlay(url, true);
  }
}

const qr = {
  animFrame: null,
  stream: null,
  scanning: false,
  lastTick: 0,
  TICK_INTERVAL: 200,
  SCAN_WIDTH: 640,
  useNative: false,
  detector: null,

  async start() {
    if (!jsQR && !('BarcodeDetector' in window)) {
      ui.showError('QR scanner not available');
      return;
    }
    try {
      if ('BarcodeDetector' in window) {
        const supported = await BarcodeDetector.getSupportedFormats();
        if (supported.includes('qr_code')) {
          this.detector = new BarcodeDetector({ formats: ['qr_code'] });
          this.useNative = true;
          console.log('Using native BarcodeDetector');
        }
      }
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      dom.qrVideo.srcObject = this.stream;
      dom.qrOverlay.classList.add('active');
      dom.qrStatus.textContent = 'Scanning for QR code...';
      this.scanning = true;
      this.scan();
    } catch (err) {
      console.error('QR camera error:', err);
      ui.showError('Camera access denied');
    }
  },

  scan() {
    const canvas = dom.qrCanvas;
    const video = dom.qrVideo;
    const ctx = this.useNative ? null : canvas.getContext('2d', { willReadFrequently: true });

    const tick = (timestamp) => {
      if (!this.scanning) return;
      this.animFrame = requestAnimationFrame(tick);

      if (timestamp - this.lastTick < this.TICK_INTERVAL) return;
      this.lastTick = timestamp;

      if (video.readyState !== video.HAVE_ENOUGH_DATA) return;

      if (this.useNative) {
        this.detector.detect(video)
          .then(codes => {
            if (!this.scanning) return;
            if (codes.length > 0) {
              const url = codes[0].rawValue.trim();
              console.log('QR code detected (native):', url);
              this.handleCode(url);
            }
          })
          .catch(() => {});
      } else {
        const scale = Math.min(1, this.SCAN_WIDTH / video.videoWidth);
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth'
        });
        if (code) {
          console.log('QR code detected (jsQR):', code.data);
          this.handleCode(code.data.trim());
        }
      }
    };
    this.animFrame = requestAnimationFrame(tick);
  },

  handleCode(url) {
    if (!utils.isValidUrl(url)) {
      dom.qrStatus.textContent = 'QR code found, but no valid URL';
      return;
    }
    this.stop();
    if (resolverAvailable) {
      dom.qrStatus.textContent = 'Resolving URL...';
      fetch(`${RESOLVER_URL}?url=${encodeURIComponent(url)}`)
        .then(response => response.ok ? response.text() : Promise.reject(response.status))
        .then(resolvedUrl => {
          console.log('Resolved URL:', resolvedUrl);
          handleScannedUrl(resolvedUrl.trim());
        })
        .catch(err => {
          console.warn('Redirect resolve failed, using original URL:', err);
          handleScannedUrl(url);
        });
    } else {
      handleScannedUrl(url);
    }
  },

  stop() {
    this.scanning = false;
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    dom.qrVideo.srcObject = null;
    dom.qrOverlay.classList.remove('active');
  }
};

dom.scanBtn.addEventListener('click', () => player.startScanning());
dom.qrBtn.addEventListener('click', () => qr.start());
dom.qrClose.addEventListener('click', () => qr.stop());

[dom.playPauseBtn, dom.prevBtn, dom.nextBtn, dom.shuffleBtn, dom.repeatBtn, dom.shareBtn, dom.bookmarkBtn].forEach(btn => {
  btn.addEventListener('click', e => e.stopPropagation());
});

dom.playPauseBtn.addEventListener('click', () => {
  const media = player.currentMedia();
  if (media.paused) {
    media.play();
    dom.playPauseBtn.innerHTML = '<svg class="icon"><use href="#icon-pause"/></svg>';
    dom.visualizer.classList.remove('visualizer-paused');
  } else {
    media.pause();
    dom.playPauseBtn.innerHTML = '<svg class="icon"><use href="#icon-play"/></svg>';
    dom.visualizer.classList.add('visualizer-paused');
  }
});

dom.prevBtn.addEventListener('click', () => {
  const media = player.currentMedia();
  const wasPlaying = !media.paused;
  if (state.currentTrackIndex > 0) {
    player.playTrack(state.currentTrackIndex - 1);
  } else {
    media.currentTime = 0;
  }
  if (wasPlaying) {
    player.currentMedia().play();
  }
});

dom.nextBtn.addEventListener('click', () => {
  const wasPlaying = !player.currentMedia().paused;
  if (state.currentTrackIndex < state.playlist.length - 1) {
    player.playTrack(state.currentTrackIndex + 1);
  } else {
    player.playTrack(0);
  }
  if (wasPlaying) {
    player.currentMedia().play();
  }
});

dom.shuffleBtn.addEventListener('click', () => {
  state.shuffleEnabled = !state.shuffleEnabled;
  
  if (state.shuffleEnabled && state.playlist.length > 1) {
    const currentTrack = state.playlist[state.currentTrackIndex];
    const otherTracks = state.originalPlaylist.filter(track => track !== currentTrack);
    const shuffled = utils.shuffleArray(otherTracks);
    state.playlist = [currentTrack, ...shuffled];
    state.currentTrackIndex = 0;
    console.log('Playlist shuffled');
  } else if (!state.shuffleEnabled) {
    const currentTrack = state.playlist[state.currentTrackIndex];
    state.playlist = [...state.originalPlaylist];
    state.currentTrackIndex = state.playlist.indexOf(currentTrack);
    ui.updateTrackDisplay();
    console.log('Playlist restored to original order');
  }
  
  ui.updateButtonStates();
});

dom.repeatBtn.addEventListener('click', () => {
  state.repeatEnabled = !state.repeatEnabled;
  ui.updateButtonStates();
});

dom.visualizer.addEventListener('click', (e) => {
  e.stopPropagation();
  dom.playerSection.click();
});

dom.playerSection.addEventListener('click', () => ui.toggleDim());

dom.errorMessage.addEventListener('click', () => {
  if (dom.errorMessage.style.cursor === 'pointer') {
    dom.helpModal.classList.add('active');
  }
});

dom.modalClose.addEventListener('click', () => {
  dom.helpModal.classList.remove('active');
});

dom.helpModal.addEventListener('click', (e) => {
  if (e.target === dom.helpModal) {
    dom.helpModal.classList.remove('active');
  }
});

dom.audioPlayer.addEventListener('play', () => {
  dom.playPauseBtn.innerHTML = '<svg class="icon"><use href="#icon-pause"/></svg>';
  dom.visualizer.classList.remove('visualizer-paused');
});

dom.audioPlayer.addEventListener('pause', () => {
  dom.playPauseBtn.innerHTML = '<svg class="icon"><use href="#icon-play"/></svg>';
  dom.visualizer.classList.add('visualizer-paused');
});

dom.audioPlayer.addEventListener('timeupdate', () => player.updateProgress());
dom.audioPlayer.addEventListener('durationchange', () => player.updateProgress());

dom.audioPlayer.addEventListener('ended', () => {
  if (state.currentTrackIndex < state.playlist.length - 1) {
    setTimeout(() => { player.playTrack(state.currentTrackIndex + 1); dom.audioPlayer.play(); }, state.waitTime * 1000);
  } else if (state.repeatEnabled) {
    setTimeout(() => { player.playTrack(0); dom.audioPlayer.play(); }, state.waitTime * 1000);
  } else {
    player.playTrack(0);
  }
});

dom.videoPlayer.addEventListener('play', () => {
  dom.playPauseBtn.innerHTML = '<svg class="icon"><use href="#icon-pause"/></svg>';
});

dom.videoPlayer.addEventListener('pause', () => {
  dom.playPauseBtn.innerHTML = '<svg class="icon"><use href="#icon-play"/></svg>';
});

dom.videoPlayer.addEventListener('ended', () => {
  if (state.currentTrackIndex < state.playlist.length - 1) {
    setTimeout(() => { player.playTrack(state.currentTrackIndex + 1); dom.videoPlayer.play(); }, state.waitTime * 1000);
  } else if (state.repeatEnabled) {
    setTimeout(() => { player.playTrack(0); dom.videoPlayer.play(); }, state.waitTime * 1000);
  } else {
    player.playTrack(0);
  }
});

dom.progressBar.addEventListener('click', (e) => {
  e.stopPropagation();
  const media = player.currentMedia();
  if (!media.duration || media.duration === Infinity) return;
  const rect = dom.progressBar.getBoundingClientRect();
  const percent = (e.clientX - rect.left) / rect.width;
  media.currentTime = percent * media.duration;
});

const BOOKMARK_KEY = 'scan2play_bookmarks';

function bookmarkGetAll() {
  try { return JSON.parse(localStorage.getItem(BOOKMARK_KEY)) || []; }
  catch { return []; }
}

function bookmarkSave(list) {
  localStorage.setItem(BOOKMARK_KEY, JSON.stringify(list));
}

function bookmarkStripUrl(url) {
  try {
    const parsed = new URL(url);
    // If it has a ?url= param, return just that inner URL
    if (parsed.searchParams.has('url')) {
      return parsed.searchParams.get('url');
    }
    return url;
  } catch {
    return url;
  }
}

function bookmarkDisplayLabel(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname + parsed.pathname;
  } catch {
    return url;
  }
}

function bookmarkRender() {
  const list = bookmarkGetAll();
  dom.bookmarkList.innerHTML = '';
  list.forEach((url, index) => {
    const li = document.createElement('li');
    li.className = 'bookmark-item';

    const label = document.createElement('span');
    label.className = 'bookmark-label';
    label.textContent = bookmarkDisplayLabel(url);
    label.addEventListener('click', () => {
      dom.bookmarkModal.classList.remove('active');
      player.loadAndPlay(url, true);
    });

    const del = document.createElement('button');
    del.className = 'bookmark-delete';
    del.innerHTML = '<svg class="icon icon-sm"><use href="#icon-trash"/></svg>';
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      const updated = bookmarkGetAll().filter((_, i) => i !== index);
      bookmarkSave(updated);
      if (updated.length === 0) {
        dom.bookmarkModal.classList.remove('active');
      } else {
        bookmarkRender();
      }
    });

    li.appendChild(label);
    li.appendChild(del);
    dom.bookmarkList.appendChild(li);
  });
}

dom.bookmarkBtn.addEventListener('click', () => {
  if (state.sourceUrl) {
    const stripped = bookmarkStripUrl(state.sourceUrl);
    const list = bookmarkGetAll();
    if (!list.includes(stripped)) {
      list.unshift(stripped);
      bookmarkSave(list);
    }
  }
  bookmarkRender();
  dom.bookmarkModal.classList.add('active');
});

dom.bookmarkModal.addEventListener('click', (e) => {
  if (e.target === dom.bookmarkModal) {
    dom.bookmarkModal.classList.remove('active');
  }
});

dom.shareBtn.addEventListener('click', () => {
  if (!state.sourceUrl) return;
  const params = new URLSearchParams({ url: state.sourceUrl });
  if (state.shuffleEnabled) params.set('shuffle', '1');
  if (state.repeatEnabled) params.set('repeat', '1');
  if (state.waitTime > 0) params.set('wait', state.waitTime);
  const playerUrl = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
  dom.shareQrCode.innerHTML = '';
  new QRCode(dom.shareQrCode, {
    text: playerUrl,
    width: 200,
    height: 200,
    colorDark: '#000000',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.M
  });
  dom.shareUrl.textContent = playerUrl;
  dom.shareModal.classList.add('active');
});

function copyShareUrl() {
  if (!navigator.clipboard) return;
  const url = dom.shareUrl.textContent;
  if (!url) return;
  navigator.clipboard.writeText(url)
    .then(() => flashShareUrl('URL copied.'))
    .catch(() => flashShareUrl('Could not copy URL.'));
}

function flashShareUrl(message) {
  dom.shareUrlFeedback.textContent = message;
  setTimeout(() => { dom.shareUrlFeedback.textContent = ''; }, 2000);
}

dom.shareQrCode.addEventListener('click', (e) => {
  e.stopPropagation();
  copyShareUrl();
});

dom.shareUrl.addEventListener('click', (e) => {
  e.stopPropagation();
  copyShareUrl();
});

dom.shareModalClose.addEventListener('click', (e) => {
  e.stopPropagation();
  dom.shareModal.classList.remove('active');
});

dom.shareModal.addEventListener('click', (e) => {
  if (e.target === dom.shareModal) {
    dom.shareModal.classList.remove('active');
  }
});

const params = new URLSearchParams(window.location.search);

if (!('NDEFReader' in window)) {
  dom.scanBtn.style.display = 'none';
  dom.nfcLog.style.display = 'none';
}

if (params.has('wait')) {
  state.waitTime = parseInt(params.get('wait'), 10) || 0;
}
if (params.has('url')) {
  const url = params.get('url');
  const options = {
    shuffle: params.has('shuffle') && params.get('shuffle') === '1',
    repeat: params.has('repeat') && params.get('repeat') === '1'
  };
  if (utils.isValidUrl(url)) {
    player.loadAndPlay(url, false, options);
  } else {
    ui.showError('Invalid URL parameter');
  }
}
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}
