# WhoaNoise

A pure client-side Progressive Web App that generates endless procedural white noise with customizable variants (white, pink, brown, blue, violet) and a 3-band equalizer. Features native media controls for background playback.

## Features

- **5 Noise Types**: White, Pink, Brown, Blue, Violet
- **3-Band EQ**: Adjust low, mid, and high frequencies (±12 dB)
- **Media Session**: Native play/pause controls on lock screen and notification shade
- **PWA**: Installable, works offline
- **Zero Dependencies**: Pure vanilla JavaScript, no build step

---

## Quick Start

```bash
python3 -m http.server 8080
```

Open http://localhost:8080 in your browser.

---

## Testing on Android via ADB

Since PWA features require a secure context, and `localhost` is treated as secure, you can use ADB port forwarding to test on your phone without deploying to HTTPS.

### Step 1: Enable Developer Options on Your Phone

1. Go to **Settings → About phone**
2. Tap **Build number** 7 times
3. Go back to **Settings → System → Developer options**
4. Enable **USB debugging** (and **Wireless debugging** if using wireless)

### Step 2: Connect via ADB

#### Option A: USB Connection

```bash
# Connect your phone via USB, then:
adb devices
# Should show your device listed
```

#### Option B: Wireless Connection

1. On your phone: **Settings → System → Developer options → Wireless debugging**
2. Tap **Pair device with pairing code**
3. Note the IP:port and pairing code shown

```bash
# Pair with the code (one-time setup)
adb pair <IP>:<PAIRING_PORT>
# Enter the pairing code when prompted

# Connect
adb connect <IP>:<DEBUG_PORT>
# The debug port is shown on the Wireless debugging screen (different from pairing port)

# Verify
adb devices
```

### Step 3: Set Up Port Forwarding

Forward your computer's port 8080 to appear as localhost:8080 on your phone:

```bash
adb reverse tcp:8080 tcp:8080
```

### Step 4: Open on Your Phone

1. Start the server on your computer:
   ```bash
   python3 -m http.server 8080
   ```

2. On your phone's Chrome, navigate to:
   ```
   http://localhost:8080
   ```

3. The page now loads as `localhost`, which Chrome treats as a secure context — all PWA features work!

### Step 5: Install as PWA

1. Tap the three-dot menu in Chrome
2. Tap **"Install app"** or **"Add to Home Screen"**
3. The app will now launch in standalone mode from your home screen

---

## License

MIT
