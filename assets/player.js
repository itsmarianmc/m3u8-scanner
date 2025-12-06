let hls;
let video;
let statusDot;
let statusText;
let errorEl;
let qualityEl;
let urlInput;

let statsOverlay;
let statsIds = {};

let seekFeedback;
let seekFeedbackTimeout;

const secs = s => (isFinite(s) ? s.toFixed(2) + 's' : '—');

let videoWrapper;
let playPauseBtn;
let backwardBtn;
let forwardBtn;
let volumeBtn;
let volumeBar;
let progressContainer;
let progressFilled;
let progressBuffer;
let currentTimeEl;
let durationEl;
let infoBtn;
let settingsBtn;
let settingsMenu;
let fullscreenBtn;
let pipBtn;
let defaultControlsToggle;

let contextMenu;
let loopEnabled = false;
let isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
let mouseX = 0;
let mouseY = 0;

function getFrameStats() {
    try {
        if (video && video.getVideoPlaybackQuality) {
            const q = video.getVideoPlaybackQuality();
            return {
                decoded: q.totalVideoFrames ?? '—',
                dropped: q.droppedVideoFrames ?? 0
            };
        }
    } catch(e) {}
    return {decoded: '—', dropped: '—'};
}

function detectCodec() {
    if (hls && hls.levels && hls.levels.length > 0) {
        const level = hls.levels[hls.currentLevel];
        if (level && level.videoCodec) {
            return level.videoCodec + (level.audioCodec ? ' / ' + level.audioCodec : '');
        }
    }
    return 'HLS Stream';
}

function getBufferHealth() {
    try {
        if (!video) return 0;
        const b = video.buffered;
        if (!b || b.length === 0) return 0;
        for (let i = 0; i < b.length; i++) {
            if (video.currentTime >= b.start(i) && video.currentTime <= b.end(i)) {
                return b.end(i) - video.currentTime;
            }
        }
        return b.end(b.length - 1) - video.currentTime;
    } catch(e) { return 0; }
}

let audioCtx, analyser, dataArray;
function setupAudioAnalysis() {
    try {
        if (audioCtx) return;
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const src = audioCtx.createMediaElementSource(video);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        src.connect(analyser);
        analyser.connect(audioCtx.destination);
        dataArray = new Uint8Array(analyser.fftSize);
    } catch(e) {
        audioCtx = null;
    }
}

function estimateLUFS() {
    if (!analyser) return '—';
    analyser.getByteTimeDomainData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
        const v = (dataArray[i] - 128) / 128;
        sum += v * v;
    }
    const rms = Math.sqrt(sum / dataArray.length);
    const dbfs = 20 * Math.log10(rms || 1e-8);
    return dbfs.toFixed(1) + ' dBFS';
}

let lastFrameTimestamp = null;
let fpsEstimate = 0;

function onVideoFrame(now, metadata) {
    if (lastFrameTimestamp !== null) {
        const delta = (now - lastFrameTimestamp) / 1000;
        if (delta > 0) fpsEstimate = 1 / delta;
    }
    lastFrameTimestamp = now;
    if (video && video.requestVideoFrameCallback) {
        video.requestVideoFrameCallback(onVideoFrame);
    }
}

function showSeekFeedback(seconds) {
    clearTimeout(seekFeedbackTimeout);
    
    const isForward = seconds > 0;
    const iconSvg = `
        <svg fill="#fff" width="60" height="60" viewBox="0 0 66 32" style="transform: ${isForward ? 'scaleX(-1)' : 'none'}">
            <path class="skparr1" d="M 18 4 L 6 16 L 18 28" stroke="currentColor" stroke-width="4" stroke-linecap="round" fill="none"></path>
            <path class="skparr2" d="M 40 4 L 28 16 L 40 28" stroke="currentColor" stroke-width="4" stroke-linecap="round" fill="none"></path>
            <path class="skparr3" d="M 62 4 L 50 16 L 62 28" stroke="currentColor" stroke-width="4" stroke-linecap="round" fill="none"></path>
        </svg>
        <div class="seek-text" style=""><span>${isForward ? '+10' : '-10'}</span></div>
    `;
    
    seekFeedback.innerHTML = iconSvg;
    seekFeedback.className = 'seek-feedback show ' + (isForward ? 'forward' : 'backward');
    
    seekFeedbackTimeout = setTimeout(() => {
        seekFeedback.classList.remove('show');
    }, 600);
}

function showVolumeFeedback(volumeChange) {
    clearTimeout(seekFeedbackTimeout);
    
    const isUp = volumeChange > 0;
    const currentVolume = Math.round((video.muted ? 0 : video.volume) * 100);
    let volumeIcon = '';
    
    if (video.muted || currentVolume === 0) {
        volumeIcon = '<svg height="26" viewBox="0 0 24 24" width="26" fill="#fff"><path d="M11.60 2.08L11.48 2.14L3.91 6.68C3.02 7.21 2.28 7.97 1.77 8.87C1.26 9.77 1.00 10.79 1 11.83V12.16L1.01 12.56C1.07 13.52 1.37 14.46 1.87 15.29C2.38 16.12 3.08 16.81 3.91 17.31L11.48 21.85C11.63 21.94 11.80 21.99 11.98 21.99C12.16 22.00 12.33 21.95 12.49 21.87C12.64 21.78 12.77 21.65 12.86 21.50C12.95 21.35 13 21.17 13 21V3C12.99 2.83 12.95 2.67 12.87 2.52C12.80 2.37 12.68 2.25 12.54 2.16C12.41 2.07 12.25 2.01 12.08 2.00C11.92 1.98 11.75 2.01 11.60 2.08ZM4.94 8.4V8.40L11 4.76V19.23L4.94 15.6C4.38 15.26 3.92 14.80 3.58 14.25C3.24 13.70 3.05 13.07 3.00 12.43L3 12.17V11.83C2.99 11.14 3.17 10.46 3.51 9.86C3.85 9.25 4.34 8.75 4.94 8.4ZM21.29 8.29L19 10.58L16.70 8.29L16.63 8.22C16.43 8.07 16.19 7.99 15.95 8.00C15.70 8.01 15.47 8.12 15.29 8.29C15.12 8.47 15.01 8.70 15.00 8.95C14.99 9.19 15.07 9.43 15.22 9.63L15.29 9.70L17.58 12L15.29 14.29C15.19 14.38 15.12 14.49 15.06 14.61C15.01 14.73 14.98 14.87 14.98 15.00C14.98 15.13 15.01 15.26 15.06 15.39C15.11 15.51 15.18 15.62 15.28 15.71C15.37 15.81 15.48 15.88 15.60 15.93C15.73 15.98 15.86 16.01 15.99 16.01C16.12 16.01 16.26 15.98 16.38 15.93C16.50 15.87 16.61 15.80 16.70 15.70L19 13.41L21.29 15.70L21.36 15.77C21.56 15.93 21.80 16.01 22.05 15.99C22.29 15.98 22.53 15.88 22.70 15.70C22.88 15.53 22.98 15.29 22.99 15.05C23.00 14.80 22.93 14.56 22.77 14.36L22.70 14.29L20.41 12L22.70 9.70C22.80 9.61 22.87 9.50 22.93 9.38C22.98 9.26 23.01 9.12 23.01 8.99C23.01 8.86 22.98 8.73 22.93 8.60C22.88 8.48 22.81 8.37 22.71 8.28C22.62 8.18 22.51 8.11 22.39 8.06C22.26 8.01 22.13 7.98 22.00 7.98C21.87 7.98 21.73 8.01 21.61 8.06C21.49 8.12 21.38 8.19 21.29 8.29Z"></path></svg>';
    } else if (currentVolume < 50) {
        volumeIcon = '<svg height="26" viewBox="0 0 24 24" width="26" fill="#fff"><path d="M 11.60 2.08 L 11.48 2.14 L 3.91 6.68 C 3.02 7.21 2.28 7.97 1.77 8.87 C 1.26 9.77 1.00 10.79 1 11.83 V 12.16 L 1.01 12.56 C 1.07 13.52 1.37 14.46 1.87 15.29 C 2.38 16.12 3.08 16.81 3.91 17.31 L 11.48 21.85 C 11.63 21.94 11.80 21.99 11.98 21.99 C 12.16 22.00 12.33 21.95 12.49 21.87 C 12.64 21.78 12.77 21.65 12.86 21.50 C 12.95 21.35 13 21.17 13 21 V 3 C 12.99 2.83 12.95 2.67 12.87 2.52 C 12.80 2.37 12.68 2.25 12.54 2.16 C 12.41 2.07 12.25 2.01 12.08 2.00 C 11.92 1.98 11.75 2.01 11.60 2.08 Z"></path><path d=" M 15.53 7.05 C 15.35 7.22 15.25 7.45 15.24 7.70 C 15.23 7.95 15.31 8.19 15.46 8.38 L 15.53 8.46 L 15.70 8.64 C 16.09 9.06 16.39 9.55 16.61 10.08 L 16.70 10.31 C 16.90 10.85 17 11.42 17 12 L 16.99 12.24 C 16.96 12.73 16.87 13.22 16.70 13.68 L 16.61 13.91 C 16.36 14.51 15.99 15.07 15.53 15.53 C 15.35 15.72 15.25 15.97 15.26 16.23 C 15.26 16.49 15.37 16.74 15.55 16.92 C 15.73 17.11 15.98 17.21 16.24 17.22 C 16.50 17.22 16.76 17.12 16.95 16.95 C 17.6 16.29 18.11 15.52 18.46 14.67 L 18.59 14.35 C 18.82 13.71 18.95 13.03 18.99 12.34 L 19 12 C 18.99 11.19 18.86 10.39 18.59 9.64 L 18.46 9.32 C 18.15 8.57 17.72 7.89 17.18 7.3 L 16.95 7.05 L 16.87 6.98 C 16.68 6.82 16.43 6.74 16.19 6.75 C 15.94 6.77 15.71 6.87 15.53 7.05" transform="translate(18, 12) scale(1) translate(-18,-12)"></path><path d="M18.36 4.22C18.18 4.39 18.08 4.62 18.07 4.87C18.05 5.12 18.13 5.36 18.29 5.56L18.36 5.63L18.66 5.95C19.36 6.72 19.91 7.60 20.31 8.55L20.47 8.96C20.82 9.94 21 10.96 21 11.99L20.98 12.44C20.94 13.32 20.77 14.19 20.47 15.03L20.31 15.44C19.86 16.53 19.19 17.52 18.36 18.36C18.17 18.55 18.07 18.80 18.07 19.07C18.07 19.33 18.17 19.59 18.36 19.77C18.55 19.96 18.80 20.07 19.07 20.07C19.33 20.07 19.59 19.96 19.77 19.77C20.79 18.75 21.61 17.54 22.16 16.20L22.35 15.70C22.72 14.68 22.93 13.62 22.98 12.54L23 12C22.99 10.73 22.78 9.48 22.35 8.29L22.16 7.79C21.67 6.62 20.99 5.54 20.15 4.61L19.77 4.22L19.70 4.15C19.51 3.99 19.26 3.91 19.02 3.93C18.77 3.94 18.53 4.04 18.36 4.22 Z" transform="translate(22, 12) scale(0) translate(-22,-12)"></path></svg>';
    }  else {
        volumeIcon = '<svg height="26" viewBox="0 0 24 24" width="26" fill="#fff"><path d="M 11.60 2.08 L 11.48 2.14 L 3.91 6.68 C 3.02 7.21 2.28 7.97 1.77 8.87 C 1.26 9.77 1.00 10.79 1 11.83 V 12.16 L 1.01 12.56 C 1.07 13.52 1.37 14.46 1.87 15.29 C 2.38 16.12 3.08 16.81 3.91 17.31 L 11.48 21.85 C 11.63 21.94 11.80 21.99 11.98 21.99 C 12.16 22.00 12.33 21.95 12.49 21.87 C 12.64 21.78 12.77 21.65 12.86 21.50 C 12.95 21.35 13 21.17 13 21 V 3 C 12.99 2.83 12.95 2.67 12.87 2.52 C 12.80 2.37 12.68 2.25 12.54 2.16 C 12.41 2.07 12.25 2.01 12.08 2.00 C 11.92 1.98 11.75 2.01 11.60 2.08 Z"></path><path d=" M 15.53 7.05 C 15.35 7.22 15.25 7.45 15.24 7.70 C 15.23 7.95 15.31 8.19 15.46 8.38 L 15.53 8.46 L 15.70 8.64 C 16.09 9.06 16.39 9.55 16.61 10.08 L 16.70 10.31 C 16.90 10.85 17 11.42 17 12 L 16.99 12.24 C 16.96 12.73 16.87 13.22 16.70 13.68 L 16.61 13.91 C 16.36 14.51 15.99 15.07 15.53 15.53 C 15.35 15.72 15.25 15.97 15.26 16.23 C 15.26 16.49 15.37 16.74 15.55 16.92 C 15.73 17.11 15.98 17.21 16.24 17.22 C 16.50 17.22 16.76 17.12 16.95 16.95 C 17.6 16.29 18.11 15.52 18.46 14.67 L 18.59 14.35 C 18.82 13.71 18.95 13.03 18.99 12.34 L 19 12 C 18.99 11.19 18.86 10.39 18.59 9.64 L 18.46 9.32 C 18.15 8.57 17.72 7.89 17.18 7.3 L 16.95 7.05 L 16.87 6.98 C 16.68 6.82 16.43 6.74 16.19 6.75 C 15.94 6.77 15.71 6.87 15.53 7.05" transform="translate(18, 12) scale(1) translate(-18,-12)"></path><path d="M18.36 4.22C18.18 4.39 18.08 4.62 18.07 4.87C18.05 5.12 18.13 5.36 18.29 5.56L18.36 5.63L18.66 5.95C19.36 6.72 19.91 7.60 20.31 8.55L20.47 8.96C20.82 9.94 21 10.96 21 11.99L20.98 12.44C20.94 13.32 20.77 14.19 20.47 15.03L20.31 15.44C19.86 16.53 19.19 17.52 18.36 18.36C18.17 18.55 18.07 18.80 18.07 19.07C18.07 19.33 18.17 19.59 18.36 19.77C18.55 19.96 18.80 20.07 19.07 20.07C19.33 20.07 19.59 19.96 19.77 19.77C20.79 18.75 21.61 17.54 22.16 16.20L22.35 15.70C22.72 14.68 22.93 13.62 22.98 12.54L23 12C22.99 10.73 22.78 9.48 22.35 8.29L22.16 7.79C21.67 6.62 20.99 5.54 20.15 4.61L19.77 4.22L19.70 4.15C19.51 3.99 19.26 3.91 19.02 3.93C18.77 3.94 18.53 4.04 18.36 4.22 Z" transform="translate(22, 12) scale(1) translate(-22,-12)"></path></svg>';
    }
    
    const iconSvg = `
        ${volumeIcon}
        <div class="volume-text"><span>${currentVolume}%</span></div>
    `;
    
    seekFeedback.innerHTML = iconSvg;
    seekFeedback.className = 'seek-feedback show volume-feedback';
    
    seekFeedbackTimeout = setTimeout(() => {
        seekFeedback.classList.remove('show');
    }, 600);
}

function updateFullscreenIcon() {
    if (!fullscreenBtn) return;
    
    const icon = fullscreenBtn.querySelector('i');
    const tooltip = fullscreenBtn.querySelector('.tooltip');
    
    let isFullscreen = false;
    
    if (document.fullscreenElement) {
        isFullscreen = document.fullscreenElement === videoWrapper;
    } else if (document.webkitFullscreenElement) {
        isFullscreen = document.webkitFullscreenElement === videoWrapper;
    } else if (document.mozFullScreenElement) {
        isFullscreen = document.mozFullScreenElement === videoWrapper;
    } else if (document.msFullscreenElement) {
        isFullscreen = document.msFullscreenElement === videoWrapper;
    }
    
    if (isIOS && videoWrapper.classList.contains('fs')) {
        isFullscreen = true;
    }
    
    if (isFullscreen) {
        icon.className = 'fas fa-compress';
        if (tooltip) tooltip.textContent = 'Exit Fullscreen (f)';
    } else {
        icon.className = 'fas fa-expand';
        if (tooltip) tooltip.textContent = 'Fullscreen (f)';
    }
}

function handleEscapeFullscreen() {
    setTimeout(() => {
        updateFullscreenIcon();
        
        if (videoWrapper && !document.fullscreenElement && 
            !document.webkitFullscreenElement && 
            !document.mozFullScreenElement && 
            !document.msFullscreenElement) {
            videoWrapper.classList.remove("fs");
        }
    }, 100);
}

function startStatsUpdate() {
    setInterval(() => {
        if (!statsOverlay || !statsOverlay.classList.contains('active')) return;

        try {
            statsIds.date.textContent = new Date().toLocaleString();

            const vw = video.clientWidth;
            const vh = video.clientHeight;
            const fpsText = fpsEstimate ? Math.round(fpsEstimate) + ' fps' : '—';
            statsIds.viewportFrames.textContent = `${vw}×${vh} / ${fpsText}`;

            const curW = video.videoWidth || '—';
            const curH = video.videoHeight || '—';
            statsIds.res.textContent = `${curW}×${curH}`;

            statsIds.codecs.textContent = detectCodec();

            const vol = (video.muted ? 0 : video.volume) * 100;
            statsIds.volumeStats.textContent = `${Math.round(vol)}% / ${video.muted ? 'muted' : 'unmuted'}`;

            if (hls && hls.bandwidthEstimate) {
                const kbps = hls.bandwidthEstimate / 1024;
                statsIds.connSpeed.textContent = kbps.toFixed(0) + ' kB/s';
                const pct = Math.min(100, Math.round((kbps / 2000) * 100));
                statsIds.connBar.style.width = pct + '%';
            } else {
                statsIds.connSpeed.textContent = '—';
                statsIds.connBar.style.width = '0%';
            }

            const bufferSec = getBufferHealth();
            statsIds.bufferHealth.textContent = secs(bufferSec);
            const bufferPct = Math.min(100, Math.round((bufferSec / 30) * 100));
            statsIds.bufferBar.style.width = bufferPct + '%';

            if (hls && hls.levels && hls.levels.length > 0) {
                const level = hls.levels[hls.currentLevel];
                statsIds.netActivity.textContent = `${Math.round(level.bitrate / 1024)} kbps`;
            } else {
                statsIds.netActivity.textContent = '—';
            }

            if (!audioCtx) setupAudioAnalysis();
            statsIds.lufs.textContent = estimateLUFS();

            statsIds.color.textContent = 'bt709 (assumed)';

            const fs = getFrameStats();
            statsIds.framesDecoded.textContent = fs.decoded;
            statsIds.framesDropped.textContent = fs.dropped;

            if (!statsIds.videoId.textContent || statsIds.videoId.textContent === '—') {
                const srcName = urlInput.value.split('/').pop().split('?')[0] || 'Stream';
                statsIds.videoId.textContent = srcName;
            }
        } catch(err) {
            console.warn('Stats update error', err);
        }
    }, 333);
}

function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

const videoSource = getUrlParameter('video_m3u8_src') || '';

function showError(message) {
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.classList.add('show');
    setTimeout(() => errorEl.classList.remove('show'), 5000);
}

function updateStatus(text, active = false) {
    if (!statusText || !statusDot) return;
    statusText.textContent = text;
    if (active) {
        statusDot.classList.add('active');
        document.getElementById('video').classList.add('unset-ratio');
        document.getElementById('loadingOverlay').classList.remove('active');
    } else {
        statusDot.classList.remove('active');
        document.getElementById('video').classList.remove('unset-ratio');
        if (text === 'Buffering...') {
            document.getElementById('loadingOverlay').classList.add('active');
        } else {
            document.getElementById('loadingOverlay').classList.remove('active');
        }
    }
}

function showLoading(show) {
    const loadingOverlayEl = document.getElementById('loadingOverlay');
    if (!loadingOverlayEl) return;
    
    if (show) {
        loadingOverlayEl.classList.add('active');
    } else {
        loadingOverlayEl.classList.remove('active');
    }
}

function loadStream() {
    if (!urlInput || !video) return;
    
    const url = urlInput.value.trim();
    
    if (!url) {
        showError('Please enter a valid M3U8 URL');
        return;
    }

    if (errorEl) errorEl.classList.remove('show');
    updateStatus('Loading...', false);
    showLoading(true);

    if (hls) {
        hls.destroy();
    }

    if (Hls.isSupported()) {
        hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
        });

        hls.loadSource(url);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, function(event, data) {
            showLoading(false);
            if (qualityEl) qualityEl.textContent = `${data.levels.length} quality levels`;
            if (statsIds.videoId) statsIds.videoId.textContent = url.split('/').pop().split('?')[0] || 'Stream';
            video.play().catch(e => {
                console.log('Autoplay prevented:', e);
            });
        });

        hls.on(Hls.Events.ERROR, function(event, data) {
            if (data.fatal) {
                showLoading(false);
                switch(data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        showError('Network error loading stream');
                        updateStatus('Error', false);
                        break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        showError('Media error - attempting recovery...');
                        hls.recoverMediaError();
                        break;
                    default:
                        showError('Fatal error loading stream');
                        updateStatus('Error', false);
                        break;
                }
            }
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, function(event, data) {
            const level = hls.levels[data.level];
            if (qualityEl) qualityEl.textContent = `${level.height}p @ ${Math.round(level.bitrate / 1000)} kbps`;
        });

    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url;
        video.addEventListener('loadedmetadata', function() {
            showLoading(false);
            video.play().catch(e => console.log('Autoplay prevented:', e));
        });
        video.addEventListener('error', function() {
            showError('Error loading stream');
            showLoading(false);
            updateStatus('Error', false);
        });
    } else {
        showError('Your browser does not support HLS');
        showLoading(false);
        updateStatus('Not Supported', false);
    }
    
    video.volume = 0.25;
    updateVolumeIcon();
}

function isPiPSupported() {
    return document.pictureInPictureEnabled && 
           !video.disablePictureInPicture &&
           video.requestPictureInPicture;
}

function updatePipButton() {
    if (!pipBtn || !isPiPSupported()) {
        if (pipBtn) pipBtn.style.display = 'none';
        return;
    }
    
    const icon = pipBtn.querySelector('i');
    if (document.pictureInPictureElement === video) {
        icon.className = 'fas fa-times-circle';
        if (pipBtn.querySelector('.tooltip')) {
            pipBtn.querySelector('.tooltip').textContent = 'Exit Picture-in-Picture (Ctrl+P)';
        }
    } else {
        icon.className = 'fas fa-picture-in-picture';
        if (pipBtn.querySelector('.tooltip')) {
            pipBtn.querySelector('.tooltip').textContent = 'Picture-in-Picture (Ctrl+P)';
        }
    }
}

async function togglePictureInPicture() {
    if (!isPiPSupported() || !video) return;
    
    try {
        if (document.pictureInPictureElement === video) {
            await document.exitPictureInPicture();
        } else {
            await video.requestPictureInPicture();
        }
        updatePipButton();
        
        const feedback = document.createElement('div');
        feedback.className = 'pip-feedback show';
        if (document.pictureInPictureElement === video) {
            feedback.innerHTML = '<i class="fas fa-picture-in-picture"></i> Picture-in-Picture Active';
        } else {
            feedback.innerHTML = '<i class="fas fa-times"></i> Picture-in-Picture Exited';
        }
        videoWrapper.appendChild(feedback);
        setTimeout(() => feedback.remove(), 2000);
    } catch (error) {
        console.error('PiP error:', error);
    }
}

function checkPipStatus() {
    updatePipButton();
}

function toggleDefaultControls() {
    if (!defaultControlsToggle || !videoWrapper || !video) return;
    
    if (defaultControlsToggle.checked) {
        videoWrapper.classList.add('default-controls');
        video.setAttribute('controls', 'true');
    } else {
        videoWrapper.classList.remove('default-controls');
        video.removeAttribute('controls');
    }
}

function updateVolumeIcon() {
    if (!volumeBtn || !video) return;
    
    const icon = volumeBtn.querySelector('i');
    const volume = video.muted ? 0 : video.volume * 100;
    const tooltip = volumeBtn.querySelector('.tooltip');
    
    if (volume === 0 || video.muted) {
        icon.className = 'fas fa-volume-mute';
        if (tooltip) tooltip.textContent = 'Unmute (m)';
    } else if (volume < 50) {
        icon.className = 'fas fa-volume-down';
        if (tooltip) tooltip.textContent = 'Mute (m)';
    } else {
        icon.className = 'fas fa-volume-up';
        if (tooltip) tooltip.textContent = 'Mute (m)';
    }
}

function formatTime(time) {
    if (isNaN(time)) return '00:00';
    
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
}

function initializeContextMenu() {
    contextMenu = document.getElementById('contextMenu');
    if (!contextMenu) return;
    
    document.addEventListener('mousemove', function(e) {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });
    
    videoWrapper.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        mouseX = e.clientX;
        mouseY = e.clientY;
        showContextMenu(mouseX, mouseY);
    });
    
    document.addEventListener('click', function(e) {
        if (contextMenu && !contextMenu.contains(e.target) && !videoWrapper.contains(e.target)) {
            hideContextMenu();
        }
    });
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && contextMenu.classList.contains('active')) {
            hideContextMenu();
        }
    });
    
    document.querySelectorAll('.context-item').forEach(item => {
        item.addEventListener('click', function() {
            const action = this.dataset.action;
            handleContextAction(action);
            hideContextMenu();
        });
    });
}

function showContextMenu(x, y) {
    if (!contextMenu) return;
    
    const menuWidth = contextMenu.offsetWidth || 220;
    const menuHeight = contextMenu.offsetHeight || 300;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    let posX = x;
    let posY = y;
    
    if (x + menuWidth > windowWidth) {
        posX = windowWidth - menuWidth - 10;
    }
    
    if (y + menuHeight > windowHeight) {
        posY = windowHeight - menuHeight - 10;
    }
    
    posX = Math.max(10, Math.min(posX, windowWidth - menuWidth - 10));
    posY = Math.max(10, Math.min(posY, windowHeight - menuHeight - 10));
    
    contextMenu.style.left = posX + 'px';
    contextMenu.style.top = posY + 'px';
    contextMenu.classList.add('active');
}

function hideContextMenu() {
    if (contextMenu) {
        contextMenu.classList.remove('active');
    }
}

function handleContextAction(action) {
    switch(action) {
        case 'loop':
            loopEnabled = !loopEnabled;
            video.loop = loopEnabled;
            
            const loopItem = document.querySelector('.context-item[data-action="loop"]');
            const loopCheck = loopItem.querySelector('.context-check i');
            loopCheck.style.display = loopEnabled ? 'block' : 'none';
            
            showTemporaryMessage(loopEnabled ? 'Loop enabled' : 'Loop disabled');
            break;
            
        case 'snapshot':
            captureVideoFrame();
            break;
            
        case 'pip':
            if (isPiPSupported()) {
                togglePictureInPicture();
            } else {
                showTemporaryMessage('Picture-in-Picture not supported');
            }
            break;
            
        case 'stats':
            const isActive = statsOverlay.classList.contains('active');
            if (isActive) {
                statsOverlay.classList.remove('active');
            } else {
                statsOverlay.classList.add('active');
            }
            
            const statsItem = document.querySelector('.context-item[data-action="stats"]');
            const statsCheck = statsItem.querySelector('.context-check i');
            statsCheck.style.display = !isActive ? 'block' : 'none';
            break;
            
        case 'fullscreen':
            if (fullscreenBtn) fullscreenBtn.click();
            break;
            
        case 'reset':
            video.currentTime = 0;
            video.playbackRate = 1;
            showTemporaryMessage('Player reset');
            break;
    }
}

function captureVideoFrame() {
    try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob(function(blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `snapshot_${Date.now()}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showTemporaryMessage('Snapshot saved');
        }, 'image/png');
    } catch (error) {
        console.error('Error capturing frame:', error);
        showTemporaryMessage('Error capturing frame');
    }
}

function showTemporaryMessage(message) {
    const messageEl = document.createElement('div');
    messageEl.className = 'pip-feedback show';
    messageEl.innerHTML = `<i class="fas fa-info-circle"></i> ${message}`;
    videoWrapper.appendChild(messageEl);
    
    setTimeout(() => {
        if (messageEl.parentNode) {
            messageEl.parentNode.removeChild(messageEl);
        }
    }, 2000);
}

function setupIOSFullscreenDetection() {
    if (!isIOS) return;
    
    video.addEventListener('webkitbeginfullscreen', function() {
        videoWrapper.classList.add("fs");
        updateFullscreenIcon();
        console.log('iOS: Entered fullscreen');
    });
    
    video.addEventListener('webkitendfullscreen', function() {
        videoWrapper.classList.remove("fs");
        updateFullscreenIcon();
        console.log('iOS: Exited fullscreen');
    });
}

function initializePlayer() {
    video = document.getElementById('video');
    statusDot = document.getElementById('statusDot');
    statusText = document.getElementById('statusText');
    errorEl = document.getElementById('error');
    qualityEl = document.getElementById('quality');
    urlInput = document.getElementById('urlInput');
    
    statsOverlay = document.getElementById('statsOverlay');
    statsIds = {
        videoId: document.getElementById('videoId'),
        viewportFrames: document.getElementById('viewportFrames'),
        res: document.getElementById('res'),
        codecs: document.getElementById('codecs'),
        volumeStats: document.getElementById('volumeStats'),
        connSpeed: document.getElementById('connSpeed'),
        connBar: document.getElementById('connBar'),
        bufferHealth: document.getElementById('bufferHealth'),
        bufferBar: document.getElementById('bufferBar'),
        netActivity: document.getElementById('netActivity'),
        lufs: document.getElementById('lufs'),
        color: document.getElementById('color'),
        date: document.getElementById('date'),
        framesDecoded: document.getElementById('framesDecoded'),
        framesDropped: document.getElementById('framesDropped')
    };
    
    seekFeedback = document.getElementById('seekFeedback');
    
    videoWrapper = document.querySelector('.video-wrapper');
    playPauseBtn = document.getElementById('playPauseBtn');
    backwardBtn = document.getElementById('backwardBtn');
    forwardBtn = document.getElementById('forwardBtn');
    volumeBtn = document.getElementById('volumeBtn');
    volumeBar = document.getElementById('volumeBar');
    progressContainer = document.getElementById('progressContainer');
    progressFilled = document.getElementById('progressFilled');
    progressBuffer = document.getElementById('progressBuffer');
    currentTimeEl = document.getElementById('currentTime');
    durationEl = document.getElementById('duration');
    infoBtn = document.getElementById('infoBtn');
    settingsBtn = document.getElementById('settingsBtn');
    settingsMenu = document.getElementById('settingsMenu');
    fullscreenBtn = document.getElementById('fullscreenBtn');
    pipBtn = document.getElementById('pipBtn');
    defaultControlsToggle = document.getElementById('defaultControlsToggle');
    
    urlInput.value = videoSource;
    
    if (video) {
        video.addEventListener('playing', () => {
            updateStatus('Stream Active', true);
            showLoading(false);
        });
        video.addEventListener('pause', () => {
            updateStatus('Paused', false);
            showLoading(false);
        });
        video.addEventListener('waiting', () => {
            updateStatus('Buffering...', false);
            showLoading(true);
        });
        video.addEventListener('play', () => {
            showLoading(false);
            if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(()=>{});
        });
        
        video.addEventListener('play', () => {
            if (playPauseBtn) {
                playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
                if (playPauseBtn.querySelector('.tooltip')) {
                    playPauseBtn.querySelector('.tooltip').textContent = 'Pause (space)';
                }
            }
            if (videoWrapper) videoWrapper.classList.add('playing');
        });
        
        video.addEventListener('pause', () => {
            if (playPauseBtn) {
                playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
                if (playPauseBtn.querySelector('.tooltip')) {
                    playPauseBtn.querySelector('.tooltip').textContent = 'Play (space)';
                }
            }
            if (videoWrapper) videoWrapper.classList.remove('playing');
        });
        
        video.addEventListener('timeupdate', () => {
            if (!video.duration) return;
            
            const percent = (video.currentTime / video.duration) * 100;
            if (progressFilled) progressFilled.style.width = percent + '%';
            
            if (currentTimeEl) currentTimeEl.textContent = formatTime(video.currentTime);
            if (durationEl) durationEl.textContent = formatTime(video.duration);
            
            if (video.buffered.length > 0 && progressBuffer) {
                const bufferedEnd = video.buffered.end(video.buffered.length - 1);
                const bufferPercent = (bufferedEnd / video.duration) * 100;
                progressBuffer.style.width = bufferPercent + '%';
            }
        });
        
        if (video.requestVideoFrameCallback) {
            video.requestVideoFrameCallback(onVideoFrame);
        }
    }
    
    if (playPauseBtn) {
        playPauseBtn.addEventListener('click', () => {
            if (video.paused) {
                video.play();
            } else {
                video.pause();
            }
        });
    }
    
    if (backwardBtn) {
        backwardBtn.addEventListener('click', () => {
            video.currentTime = Math.max(0, video.currentTime - 10);
            showSeekFeedback(-15);
        });
    }
    
    if (forwardBtn) {
        forwardBtn.addEventListener('click', () => {
            video.currentTime = Math.min(video.duration, video.currentTime + 10);
            showSeekFeedback(+15);
        });
    }
    
    if (volumeBar) {
        volumeBar.addEventListener('input', (e) => {
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            video.volume = isMobile ? 1 : e.target.value / 100;
            if (volumeBar) volumeBar.value = video.volume * 100;
            updateVolumeIcon();
            showVolumeFeedback(video.volume - (video.volume === 1 ? 0 : e.target.value / 100));
        });
    }
    
    if (volumeBtn) {
        volumeBtn.addEventListener('click', () => {
            video.muted = !video.muted;
            updateVolumeIcon();
        });
    }
    
    if (progressContainer) {
        progressContainer.addEventListener('click', (e) => {
            const rect = progressContainer.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            video.currentTime = percent * video.duration;
        });
    }
    
    if (settingsBtn) {
        settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (settingsMenu) settingsMenu.classList.toggle('active');
        });
    }
    
    document.querySelectorAll('.settings-item').forEach(item => {
        item.addEventListener('click', () => {
            const speed = parseFloat(item.dataset.speed);
            video.playbackRate = speed;
            
            document.querySelectorAll('.settings-item').forEach(i => {
                i.classList.remove('active');
                i.querySelector('i').style.display = 'none';
            });
            
            item.classList.add('active');
            item.querySelector('i').style.display = 'block';
            if (settingsMenu) settingsMenu.classList.remove('active');
        });
    });
    
    if (infoBtn) {
        infoBtn.addEventListener('click', () => {
            if (statsOverlay) statsOverlay.classList.toggle('active');
        });
    }
    
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', () => {
            if (!videoWrapper || !video) return;
            
            if (isIOS) {
                if (video.webkitEnterFullscreen) {
                    video.webkitEnterFullscreen();
                }
            } else {
                const isFullscreen = document.fullscreenElement || 
                                     document.webkitFullscreenElement || 
                                     document.mozFullScreenElement ||
                                     document.msFullscreenElement;
                
                if (!isFullscreen) {
                    videoWrapper.classList.add("fs");
                    if (videoWrapper.requestFullscreen) {
                        videoWrapper.requestFullscreen();
                    } else if (videoWrapper.webkitRequestFullscreen) {
                        videoWrapper.webkitRequestFullscreen();
                    } else if (videoWrapper.mozRequestFullScreen) {
                        videoWrapper.mozRequestFullScreen();
                    } else if (videoWrapper.msRequestFullscreen) {
                        videoWrapper.msRequestFullscreen();
                    }
                } else {
                    videoWrapper.classList.remove("fs");
                    if (document.exitFullscreen) {
                        document.exitFullscreen();
                    } else if (document.webkitExitFullscreen) {
                        document.webkitExitFullscreen();
                    } else if (document.mozCancelFullScreen) {
                        document.mozCancelFullScreen();
                    } else if (document.msExitFullscreen) {
                        document.msExitFullscreen();
                    }
                }
            }
        });
    }
    
    function handleFullscreenChange() {
        updateFullscreenIcon();
        const isFullscreen = document.fullscreenElement || 
                            document.webkitFullscreenElement || 
                            document.mozFullScreenElement ||
                            document.msFullscreenElement;
        
        if (!isFullscreen && videoWrapper) {
            videoWrapper.classList.remove("fs");
        }
    }
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            handleEscapeFullscreen();
        }
    });
    
    if (pipBtn) {
        pipBtn.addEventListener('click', togglePictureInPicture);
        
        video.addEventListener('enterpictureinpicture', () => {
            updatePipButton();
        });
        
        video.addEventListener('leavepictureinpicture', () => {
            updatePipButton();
        });
    }
    
    if (defaultControlsToggle) {
        defaultControlsToggle.addEventListener('change', toggleDefaultControls);
    }
    
    document.getElementById('streamStarter').addEventListener('click', loadStream);
    
    if (urlInput) {
        urlInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                loadStream();
            }
        });
    }
    
    if (videoWrapper) {
        let controlsTimeout;
        videoWrapper.addEventListener('mousemove', () => {
            videoWrapper.classList.remove('controls-hidden');
            clearTimeout(controlsTimeout);
            
            if (!video.paused) {
                controlsTimeout = setTimeout(() => {
                    videoWrapper.classList.add('controls-hidden');
                }, 3000);
            }
        });
        
        videoWrapper.addEventListener('mouseleave', () => {
            clearTimeout(controlsTimeout);
            videoWrapper.classList.add('controls-hidden');
        });
        
        videoWrapper.addEventListener('click', () => {
            videoWrapper.focus();
        });
        
        videoWrapper.setAttribute('tabindex', '0');
        videoWrapper.focus();
    }
    
    setInterval(updateFullscreenIcon, 1000);
    
    document.addEventListener('click', (e) => {
        if (settingsMenu && !e.target.closest('.settings-wrapper')) {
            settingsMenu.classList.remove('active');
        }
    });
    
    document.addEventListener('keydown', (e) => {
        if (!video || e.target.tagName === 'INPUT') return;
        
        switch(e.code) {
            case 'Space':
                e.preventDefault();
                if (playPauseBtn) playPauseBtn.click();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                video.currentTime = Math.max(0, video.currentTime - 10);
                showSeekFeedback(-15);
                break;
            case 'ArrowRight':
                e.preventDefault();
                video.currentTime = Math.min(video.duration, video.currentTime + 10);
                showSeekFeedback(+15);
                break;
            case 'ArrowUp':
                e.preventDefault();
                const volUp = Math.min(1, video.volume + 0.1);
                video.volume = volUp;
                if (volumeBar) volumeBar.value = volUp * 100;
                showVolumeFeedback(0.1);
                updateVolumeIcon();
                break;
            case 'ArrowDown':
                e.preventDefault();
                const volDown = Math.max(0, video.volume - 0.1);
                video.volume = volDown;
                if (volumeBar) volumeBar.value = volDown * 100;
                showVolumeFeedback(-0.1);
                updateVolumeIcon();
                break;
            case 'KeyF':
                e.preventDefault();
                if (fullscreenBtn) fullscreenBtn.click();
                break;
            case 'KeyM':
                e.preventDefault();
                if (volumeBtn) volumeBtn.click();
                break;
            case 'KeyI':
                e.preventDefault();
                if (infoBtn) infoBtn.click();
                break;
            case 'KeyP':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    if (pipBtn) pipBtn.click();
                }
                break;
            case 'Escape':
                break;
        }
    });
    
    updateVolumeIcon();
    updatePipButton();
    updateFullscreenIcon();
    
    setInterval(checkPipStatus, 1000);
    startStatsUpdate();
    
    initializeContextMenu();
    setupIOSFullscreenDetection();

    if (videoSource) {
        loadStream();
    }
}

document.addEventListener('DOMContentLoaded', initializePlayer);