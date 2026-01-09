/**
 * WhoaNoise - Main Application
 * Procedural white noise generator with EQ and media controls
 */

const STORAGE_KEY = 'whoanoise-state';

class WhoaNoise {
    constructor() {
        // Audio state
        this.audioContext = null;
        this.noiseNode = null;
        this.gainNode = null;
        this.eqLow = null;
        this.eqMid = null;
        this.eqHigh = null;
        this.isPlaying = false;
        this.currentNoiseType = 'white';

        // Silent audio element for Media Session anchoring on mobile
        this.mediaElement = null;

        // DOM elements
        this.playButton = document.getElementById('playButton');
        this.playLabel = document.getElementById('playLabel');
        this.noiseGrid = document.getElementById('noiseGrid');
        this.lowSlider = document.getElementById('lowSlider');
        this.midSlider = document.getElementById('midSlider');
        this.highSlider = document.getElementById('highSlider');
        this.lowValue = document.getElementById('lowValue');
        this.midValue = document.getElementById('midValue');
        this.highValue = document.getElementById('highValue');

        // Bind methods
        this.togglePlay = this.togglePlay.bind(this);
        this.handleNoiseSelect = this.handleNoiseSelect.bind(this);

        // Install hint element
        this.installHint = document.getElementById('installHint');

        // Initialize
        this.init();
    }

    async init() {
        // Load saved state before setting up UI
        this.loadState();

        // Set up event listeners
        this.playButton.addEventListener('click', this.togglePlay);
        this.noiseGrid.addEventListener('click', this.handleNoiseSelect);

        // EQ sliders
        this.lowSlider.addEventListener('input', () => this.updateEQ('low'));
        this.midSlider.addEventListener('input', () => this.updateEQ('mid'));
        this.highSlider.addEventListener('input', () => this.updateEQ('high'));

        // Register service worker
        if ('serviceWorker' in navigator) {
            try {
                await navigator.serviceWorker.register('sw.js');
                console.log('Service Worker registered');
            } catch (error) {
                console.log(`Service Worker registration failed: ${error}`);
            }
        }

        // Update initial slider displays from current values
        this.updateSliderDisplay('low', parseFloat(this.lowSlider.value));
        this.updateSliderDisplay('mid', parseFloat(this.midSlider.value));
        this.updateSliderDisplay('high', parseFloat(this.highSlider.value));

        // Set up iOS install hint
        this.setupInstallHint();
    }

    async initAudio() {
        if (this.audioContext) return;

        // Create audio context
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

        // Load the noise processor worklet
        await this.audioContext.audioWorklet.addModule('noise-processor.js');

        // Create noise generator node
        this.noiseNode = new AudioWorkletNode(this.audioContext, 'noise-processor');

        // Send current noise type to the processor (in case user selected before playing)
        this.noiseNode.port.postMessage({
            type: 'setNoiseType',
            noiseType: this.currentNoiseType
        });

        // Create gain node for volume control
        this.gainNode = this.audioContext.createGain();
        this.gainNode.gain.value = 0.5;

        // Create 3-band EQ
        // Low shelf filter (affects frequencies below 320Hz)
        this.eqLow = this.audioContext.createBiquadFilter();
        this.eqLow.type = 'lowshelf';
        this.eqLow.frequency.value = 320;
        this.eqLow.gain.value = 0;

        // Mid peaking filter (centered at 1kHz)
        this.eqMid = this.audioContext.createBiquadFilter();
        this.eqMid.type = 'peaking';
        this.eqMid.frequency.value = 1000;
        this.eqMid.Q.value = 0.5;
        this.eqMid.gain.value = 0;

        // High shelf filter (affects frequencies above 3.2kHz)
        this.eqHigh = this.audioContext.createBiquadFilter();
        this.eqHigh.type = 'highshelf';
        this.eqHigh.frequency.value = 3200;
        this.eqHigh.gain.value = 0;

        // Connect the audio graph
        this.noiseNode
            .connect(this.eqLow)
            .connect(this.eqMid)
            .connect(this.eqHigh)
            .connect(this.gainNode)
            .connect(this.audioContext.destination);

        // Apply current slider values
        this.updateEQ('low');
        this.updateEQ('mid');
        this.updateEQ('high');
    }

    async togglePlay() {
        if (!this.isPlaying) {
            await this.start();
        } else {
            this.stop();
        }
    }

    async start() {
        try {
            await this.initAudio();

            // Resume context if suspended (required for autoplay policies)
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            // Create silent audio element to anchor Media Session on mobile
            if (!this.mediaElement) {
                this.mediaElement = document.createElement('audio');
                // Tiny silent audio (data URI of minimal valid audio)
                this.mediaElement.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
                this.mediaElement.loop = true;
            }
            await this.mediaElement.play();

            this.isPlaying = true;
            this.updatePlayButton();
            this.setupMediaSession();

        } catch (error) {
            console.error('Failed to start audio:', error);
        }
    }

    stop() {
        if (this.audioContext && this.audioContext.state === 'running') {
            this.audioContext.suspend();
        }

        // Pause the media element
        if (this.mediaElement) {
            this.mediaElement.pause();
        }

        this.isPlaying = false;
        this.updatePlayButton();
        this.updateMediaMetadata();
    }

    updatePlayButton() {
        this.playButton.classList.toggle('playing', this.isPlaying);
        this.playLabel.textContent = this.isPlaying ? 'Stop' : 'Play';
        // Force Safari to repaint (fixes iOS rendering bug with classList.toggle)
        void this.playButton.offsetWidth;
    }

    handleNoiseSelect(event) {
        const button = event.target.closest('.noise-btn');
        if (!button) return;

        const noiseType = button.dataset.type;
        if (noiseType === this.currentNoiseType) return;

        // Update active state
        this.noiseGrid.querySelectorAll('.noise-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        button.classList.add('active');

        // Update noise type
        this.currentNoiseType = noiseType;

        // Tell the audio worklet to change noise type
        if (this.noiseNode) {
            this.noiseNode.port.postMessage({
                type: 'setNoiseType',
                noiseType: noiseType
            });
        }

        // Update media session metadata
        this.updateMediaMetadata();

        // Persist state
        this.saveState();
    }

    updateEQ(band) {
        const slider = this[`${band}Slider`];
        const value = parseFloat(slider.value);

        this.updateSliderDisplay(band, value);

        // Apply to filter if audio is initialized
        const filter = this[`eq${band.charAt(0).toUpperCase() + band.slice(1)}`];
        if (filter) {
            filter.gain.setValueAtTime(value, this.audioContext.currentTime);
        }

        // Persist state
        this.saveState();
    }

    updateSliderDisplay(band, value) {
        const display = this[`${band}Value`];
        const sign = value > 0 ? '+' : '';
        display.textContent = `${sign}${value} dB`;
    }

    setupMediaSession() {
        if (!('mediaSession' in navigator)) return;

        this.updateMediaMetadata();

        // Set up action handlers
        navigator.mediaSession.setActionHandler('play', () => {
            this.start();
        });

        navigator.mediaSession.setActionHandler('pause', () => {
            this.stop();
        });

        navigator.mediaSession.setActionHandler('stop', () => {
            this.stop();
        });

        // Previous/Next to cycle through noise types
        const noiseTypes = ['white', 'pink', 'brown', 'blue', 'violet'];

        navigator.mediaSession.setActionHandler('previoustrack', () => {
            const currentIndex = noiseTypes.indexOf(this.currentNoiseType);
            const previousIndex = (currentIndex - 1 + noiseTypes.length) % noiseTypes.length;
            this.selectNoiseType(noiseTypes[previousIndex]);
        });

        navigator.mediaSession.setActionHandler('nexttrack', () => {
            const currentIndex = noiseTypes.indexOf(this.currentNoiseType);
            const nextIndex = (currentIndex + 1) % noiseTypes.length;
            this.selectNoiseType(noiseTypes[nextIndex]);
        });
    }

    selectNoiseType(noiseType) {
        const button = this.noiseGrid.querySelector(`[data-type="${noiseType}"]`);
        if (button) {
            button.click();
        }
    }

    updateMediaMetadata() {
        if (!('mediaSession' in navigator)) return;

        const noiseNames = {
            white: 'White Noise',
            pink: 'Pink Noise',
            brown: 'Brown Noise',
            blue: 'Blue Noise',
            violet: 'Violet Noise'
        };

        navigator.mediaSession.metadata = new MediaMetadata({
            title: noiseNames[this.currentNoiseType],
            artist: 'WhoaNoise',
            album: 'Procedural Noise Generator'
        });

        navigator.mediaSession.playbackState = this.isPlaying ? 'playing' : 'paused';
    }

    setupInstallHint() {
        if (!this.installHint) return;

        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches
            || window.navigator.standalone;

        if (isStandalone) {
            // Already installed, hide the hint
            this.installHint.style.display = 'none';
        } else if (isIOS) {
            // iOS doesn't have automatic install prompts, show instructions
            this.installHint.innerHTML = 'Tap <strong>Share</strong> → <strong>Add to Home Screen</strong> to install';
        }
    }

    saveState() {
        const state = {
            noiseType: this.currentNoiseType,
            eq: {
                low: parseFloat(this.lowSlider.value),
                mid: parseFloat(this.midSlider.value),
                high: parseFloat(this.highSlider.value)
            }
        };
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (e) {
            console.warn(`Failed to save state: ${e}`);
        }
    }

    loadState() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (!saved) return;

            const state = JSON.parse(saved);

            // Restore noise type
            if (state.noiseType) {
                this.currentNoiseType = state.noiseType;
                // Update UI to reflect saved noise type
                this.noiseGrid.querySelectorAll('.noise-btn').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.type === state.noiseType);
                });
            }

            // Restore EQ values
            if (state.eq) {
                if (typeof state.eq.low === 'number') {
                    this.lowSlider.value = state.eq.low;
                }
                if (typeof state.eq.mid === 'number') {
                    this.midSlider.value = state.eq.mid;
                }
                if (typeof state.eq.high === 'number') {
                    this.highSlider.value = state.eq.high;
                }
            }
        } catch (e) {
            console.warn(`Failed to load state: ${e}`);
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new WhoaNoise();
});
