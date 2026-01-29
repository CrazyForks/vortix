# Product Hunt Launch Kit

## Basic Info

**Product Name:** Vortix

**Tagline (60 chars max):**
> Terminal VPN manager with real-time telemetry & leak detection

**Website:** https://github.com/Harry-kp/vortix

**Pricing:** Free (Open Source - MIT License)

---

## Topics/Tags
- Developer Tools
- Open Source
- Terminal
- Privacy
- macOS

---

## Short Description (260 chars max)

A keyboard-driven TUI to manage WireGuard & OpenVPN connections. See real-time throughput, latency, and jitter. Detect IPv6/DNS leaks automatically. Built-in kill switch. No GUI bloat — just fast, secure VPN management from your terminal.

---

## Full Description

**Vortix** is a terminal UI for managing VPN connections with features you won't find in GUI clients:

### 🔒 Security First
- **Kill Switch** — Firewall integration blocks all traffic if VPN drops
- **Leak Detection** — Real-time IPv6 and DNS leak monitoring
- **Secure Storage** — Profiles stored with chmod 600 permissions

### 📊 Advanced Telemetry
- Real-time throughput graphs
- Latency, jitter, and packet loss metrics
- Exit IP geolocation (city, country, ISP)

### ⚡ Fast & Lightweight
- No Electron, no GUI bloat
- Keyboard-driven — no mouse needed
- Instant profile switching with hotkeys (1-9)

### 🔧 Multi-Protocol
- WireGuard support
- OpenVPN support
- Auto-detects .conf and .ovpn files

**Perfect for:** Security professionals, developers, remote workers, and anyone who lives in the terminal.

---

## Maker's First Comment (Post this after launch)

Hey Product Hunt! 👋

I built Vortix because I was frustrated with existing VPN tools:

**The problem:**
- GUI clients like Tunnelblick use too much RAM and screen space
- CLI tools like `wg show` lack real-time telemetry
- No single tool showed me leak status, throughput, AND latency together

**Why terminal?**
- I live in the terminal (tmux + neovim life)
- TUIs are fast, keyboard-driven, and resource-light
- VPN management shouldn't require a 200MB Electron app

**What makes Vortix different:**
- Real-time graphs for throughput, latency, jitter
- Automatic IPv6 and DNS leak detection
- Kill switch that actually works (PF firewall integration)
- One-key profile switching

It's open source (MIT), written in Rust, and currently supports macOS. Linux support is coming in v0.2!

Try it:
```
cargo install vortix
```

Or use the installer:
```
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/Harry-kp/vortix/releases/latest/download/vortix-installer.sh | sh
```

Would love your feedback! 🚀

---

## Images Needed

1. **Thumbnail (240x240)** — Logo or app icon
2. **Gallery Images (1270x760 recommended):**
   - Main dashboard screenshot
   - Leak detection panel
   - Kill switch in action
   - Profile switching demo
3. **GIF/Video** — Use your existing `demo.gif`

### Where to find your demo GIF:
`assets/demo.gif` — already in your repo!

---

## Launch Checklist

### Before Launch
- [ ] Create Product Hunt account (if not already)
- [ ] Prepare 240x240 thumbnail/logo
- [ ] Have 3-5 gallery screenshots ready
- [ ] Upload demo.gif as main media
- [ ] Schedule launch (Tuesday-Thursday best, 12:01 AM PT)
- [ ] Notify friends/community to upvote early

### On Launch Day
- [ ] Post your maker comment immediately
- [ ] Reply to every comment within 1-2 hours
- [ ] Share on Twitter/X with #ProductHunt
- [ ] Post in relevant Discord/Slack communities
- [ ] Update GitHub README with "Featured on Product Hunt" badge

### After Launch
- [ ] Thank everyone who commented
- [ ] Add Product Hunt badge to README:
```markdown
[![Product Hunt](https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=YOUR_POST_ID)](https://www.producthunt.com/posts/vortix)
```

---

## Suggested Launch Time

**Best days:** Tuesday, Wednesday, Thursday
**Best time:** 12:01 AM Pacific Time (midnight)

This gives you a full 24 hours on the homepage and catches both US and European audiences.

---

## Quick Links to Include

- GitHub: https://github.com/Harry-kp/vortix
- Install: `cargo install vortix`
- Demo: https://github.com/Harry-kp/vortix#readme (GIF in README)
- Roadmap: https://github.com/Harry-kp/vortix/blob/main/ROADMAP.md

