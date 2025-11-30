let hls;
const video = document.getElementById('video');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const errorEl = document.getElementById('error');
const qualityEl = document.getElementById('quality');
const urlInput = document.getElementById('urlInput');
const resolutionEl = document.getElementById('resolution');
const bitrateEl = document.getElementById('bitrate');
const levelsEl = document.getElementById('levels');

const statsOverlay = document.getElementById('statsOverlay');
const statsIds = {
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

const seekFeedback = document.getElementById('seekFeedback');
let seekFeedbackTimeout;

const secs = s => (isFinite(s) ? s.toFixed(2) + 's' : '—');

function getFrameStats() {
    try {
        if (video.getVideoPlaybackQuality) {
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
    if (video.requestVideoFrameCallback) {
        video.requestVideoFrameCallback(onVideoFrame);
    }
}

if (video.requestVideoFrameCallback) {
    video.requestVideoFrameCallback(onVideoFrame);
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

function updateFullscreenIcon() {
    const icon = fullscreenBtn.querySelector('i');
    const isFullscreen = document.fullscreenElement || 
                        document.webkitFullscreenElement || 
                        document.mozFullScreenElement ||
                        document.msFullscreenElement;
    
    if (isFullscreen) {
        icon.className = 'fas fa-compress';
    } else {
        icon.className = 'fas fa-expand';
    }
}

setInterval(() => {
    if (!statsOverlay.classList.contains('active')) return;

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

document.getElementById('streamStarter').addEventListener('click', loadStream);

function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

const videoSource = getUrlParameter('video_m3u8_src') || '';
urlInput.value = videoSource;

function showError(message) {
    errorEl.textContent = message;
    errorEl.classList.add('show');
    setTimeout(() => errorEl.classList.remove('show'), 5000);
}

function updateStatus(text, active = false) {
    statusText.textContent = text;
    if (active) {
        statusDot.classList.add('active');
        document.getElementById('video').classList.add('unset-ratio');
        document.getElementById('loadingOverlay').classList.remove('active');
    } else {
        statusDot.classList.remove('active');
        document.getElementById('video').classList.remove('unset-ratio');
        document.getElementById('loadingOverlay').classList.add('active');
    }
}

function showLoading(show) {
    const loadingOverlayEl = document.getElementById('loadingOverlay');
    if (show) {
        loadingOverlayEl.classList.add('active');
    } else {
        loadingOverlayEl.classList.remove('active');
    }
}

function loadStream() {
    const url = urlInput.value.trim();
    
    if (!url) {
        showError('Please enter a valid M3U8 URL');
        return;
    }

    errorEl.classList.remove('show');
    updateStatus('Loading...', false);
    showLoading(true);
    resolutionEl.textContent = '-';
    bitrateEl.textContent = '-';
    levelsEl.textContent = '-';

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
            levelsEl.textContent = data.levels.length;
            qualityEl.textContent = `${data.levels.length} quality levels`;
            statsIds.videoId.textContent = url.split('/').pop().split('?')[0] || 'Stream';
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
            resolutionEl.textContent = `${level.height}p`;
            bitrateEl.textContent = `${Math.round(level.bitrate / 1000)} kbps`;
            qualityEl.textContent = `${level.height}p @ ${Math.round(level.bitrate / 1000)} kbps`;
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
}

if (videoSource) {
    loadStream();
}

video.addEventListener('playing', () => updateStatus('Stream Active', true));
video.addEventListener('pause', () => updateStatus('Paused', false));
video.addEventListener('waiting', () => updateStatus('Buffering...', false));
video.addEventListener('play', () => {
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(()=>{});
});

const videoWrapper = document.querySelector('.video-wrapper');
const playPauseBtn = document.getElementById('playPauseBtn');
const backwardBtn = document.getElementById('backwardBtn');
const forwardBtn = document.getElementById('forwardBtn');
const volumeBtn = document.getElementById('volumeBtn');
const volumeBar = document.getElementById('volumeBar');
const progressContainer = document.getElementById('progressContainer');
const progressFilled = document.getElementById('progressFilled');
const progressBuffer = document.getElementById('progressBuffer');
const currentTimeEl = document.getElementById('currentTime');
const durationEl = document.getElementById('duration');
const infoBtn = document.getElementById('infoBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsMenu = document.getElementById('settingsMenu');
const fullscreenBtn = document.getElementById('fullscreenBtn');

video.addEventListener('play', () => {
    playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
    videoWrapper.classList.add('playing');
});

video.addEventListener('pause', () => {
    playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
    videoWrapper.classList.remove('playing');
});

playPauseBtn.addEventListener('click', () => {
    if (video.paused) {
        video.play();
    } else {
        video.pause();
    }
});

backwardBtn.addEventListener('click', () => {
    video.currentTime = Math.max(0, video.currentTime - 15);
    showSeekFeedback(-15);
});

forwardBtn.addEventListener('click', () => {
    video.currentTime = Math.min(video.duration, video.currentTime + 15);
    showSeekFeedback(+15);
});

volumeBar.addEventListener('input', (e) => {
    video.volume = e.target.value / 100;
    updateVolumeIcon();
});

volumeBtn.addEventListener('click', () => {
    video.muted = !video.muted;
    updateVolumeIcon();
});

function updateVolumeIcon() {
    const icon = volumeBtn.querySelector('i');
    const volume = video.muted ? 0 : video.volume * 100;
    
    if (volume === 0) {
        icon.className = 'fas fa-volume-mute';
    } else if (volume < 50) {
        icon.className = 'fas fa-volume-down';
    } else {
        icon.className = 'fas fa-volume-up';
    }
}

video.addEventListener('timeupdate', () => {
    if (!video.duration) return;
    
    const percent = (video.currentTime / video.duration) * 100;
    progressFilled.style.width = percent + '%';
    
    currentTimeEl.textContent = formatTime(video.currentTime);
    durationEl.textContent = formatTime(video.duration);
    
    if (video.buffered.length > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        const bufferPercent = (bufferedEnd / video.duration) * 100;
        progressBuffer.style.width = bufferPercent + '%';
    }
});

progressContainer.addEventListener('click', (e) => {
    const rect = progressContainer.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    video.currentTime = percent * video.duration;
});

settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    settingsMenu.classList.toggle('active');
});

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
        settingsMenu.classList.remove('active');
    });
});

infoBtn.addEventListener('click', () => {
    statsOverlay.classList.toggle('active');
});

fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
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
});

document.addEventListener('fullscreenchange', updateFullscreenIcon);
document.addEventListener('webkitfullscreenchange', updateFullscreenIcon);
document.addEventListener('mozfullscreenchange', updateFullscreenIcon);
document.addEventListener('MSFullscreenChange', updateFullscreenIcon);

setInterval(updateFullscreenIcon, 1000);

document.addEventListener('click', (e) => {
    if (!e.target.closest('.settings-wrapper')) {
        settingsMenu.classList.remove('active');
    }
});

document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    
    switch(e.code) {
        case 'Space':
            e.preventDefault();
            playPauseBtn.click();
            break;
        case 'ArrowLeft':
            e.preventDefault();
            video.currentTime = Math.max(0, video.currentTime - 15);
            showSeekFeedback(-15);
            break;
        case 'ArrowRight':
            e.preventDefault();
            video.currentTime = Math.min(video.duration, video.currentTime + 15);
            showSeekFeedback(+15);
            break;
        case 'KeyF':
            e.preventDefault();
            fullscreenBtn.click();
            break;
        case 'KeyM':
            e.preventDefault();
            volumeBtn.click();
            break;
        case 'KeyI':
            e.preventDefault();
            infoBtn.click();
            break;
    }
});

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

urlInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        loadStream();
    }
});

videoWrapper.addEventListener('click', () => {
    videoWrapper.focus();
});

document.addEventListener('DOMContentLoaded', () => {
    videoWrapper.setAttribute('tabindex', '0');
    videoWrapper.focus();
});

videoWrapper.addEventListener('fullscreenchange', () => {
    setTimeout(() => {
        videoWrapper.focus();
    }, 100);
});

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