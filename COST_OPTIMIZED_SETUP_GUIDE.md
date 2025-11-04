# Cost-Optimized AI Video Workflow Setup Guide

## 💰 Cost Comparison

### Original Workflow Costs (per video):
- **Seedance via Wavespeed**: ~$0.30-0.50 per 10s clip × 3 = **$0.90-1.50**
- **Fal AI Sound**: ~$0.10-0.20 per generation = **$0.10-0.20**
- **Fal AI FFmpeg**: ~$0.05 per render = **$0.05**
- **Total per video**: **$1.05-1.75**
- **Cost for 30 videos/month**: **$31.50-52.50**

### New Workflow Costs (per video):
- **Replicate SVD**: ~$0.005-0.015 per clip × 3 = **$0.015-0.045**
- **Sound**: FREE (music library) = **$0.00**
- **FFmpeg**: FREE (local processing) = **$0.00**
- **Total per video**: **$0.015-0.045**
- **Cost for 30 videos/month**: **$0.45-1.35**

### **Total Savings**: ~95-97% cost reduction! 🎉

---

## 🛠 Setup Instructions

### 1. Get Replicate API Key (Required)

1. Go to [replicate.com](https://replicate.com)
2. Sign up for free account
3. Get your API token from account settings
4. Add to n8n credentials:
   - Credential Type: `HTTP Header Auth`
   - Name: `replicateApi`
   - Header Name: `Authorization`
   - Value: `Token YOUR_API_KEY_HERE`

**Pricing**: Pay-as-you-go, ~$0.005-0.015 per 10-second video

---

### 2. Install FFmpeg (Required for stitching)

FFmpeg must be installed on your n8n server:

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install ffmpeg wget -y
```

**MacOS:**
```bash
brew install ffmpeg wget
```

**Docker (add to Dockerfile):**
```dockerfile
RUN apk add --no-cache ffmpeg wget
```

**Verify installation:**
```bash
ffmpeg -version
```

---

### 3. Setup Free Music Library (Optional but recommended)

Instead of AI-generated sound, use royalty-free music:

#### Option A: Local Music Files
1. Download royalty-free music from:
   - [Pixabay Audio](https://pixabay.com/music/)
   - [YouTube Audio Library](https://www.youtube.com/audiolibrary)
   - [Freesound.org](https://freesound.org)
2. Save to `/tmp/n8n-music/` folder
3. Modify FFmpeg command to add background music:

```bash
ffmpeg -f concat -safe 0 -i "$TEMP_DIR/concat.txt" \
  -i "/tmp/n8n-music/background.mp3" \
  -c:v libx264 -preset fast -crf 23 \
  -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2" \
  -c:a aac -b:a 128k -shortest \
  -r 30 "$TEMP_DIR/final.mp4" -y
```

#### Option B: Use Replicate Audio Model (small cost)
If you want AI-generated sounds, add this node before stitching:

```json
{
  "name": "Generate Sound (Replicate AudioCraft)",
  "type": "n8n-nodes-base.httpRequest",
  "parameters": {
    "url": "https://api.replicate.com/v1/predictions",
    "method": "POST",
    "jsonBody": "{\n  \"version\": \"audiocraft-v1\",\n  \"input\": {\n    \"prompt\": \"{{ $json.sound_description }}\",\n    \"duration\": 30\n  }\n}"
  }
}
```

Cost: ~$0.01-0.02 per sound

---

### 4. Video Storage Options

The workflow creates a video file locally. Choose one:

#### Option A: Upload to Google Drive (FREE)
Add Google Drive node after stitching:
- Node: `Google Drive - Upload File`
- File path: `{{ $('Stitch Videos with FFmpeg').item.json.stdout.trim() }}`

#### Option B: Upload to Cloudinary (FREE tier)
1. Sign up at [cloudinary.com](https://cloudinary.com) (free tier: 25GB)
2. Add HTTP Request node:
```json
{
  "url": "https://api.cloudinary.com/v1_1/YOUR_CLOUD_NAME/video/upload",
  "method": "POST",
  "body": {
    "file": "{{ $binary.data }}",
    "upload_preset": "YOUR_PRESET"
  }
}
```

#### Option C: Keep Local (for testing)
Videos saved in `/tmp/n8n-video-*/final.mp4`

---

### 5. Alternative Video Models on Replicate

If Stable Video Diffusion quality isn't good enough, try these:

#### AnimateDiff (Cheaper, faster):
```json
{
  "version": "animatediff-v1",
  "input": {
    "prompt": "{{ $json.description }}",
    "num_frames": 16,
    "guidance_scale": 7.5
  }
}
```
Cost: ~$0.003 per video

#### Zeroscope (Better quality):
```json
{
  "version": "zeroscope-v2-xl",
  "input": {
    "prompt": "{{ $json.description }}",
    "num_frames": 24,
    "fps": 8
  }
}
```
Cost: ~$0.02 per video

---

### 6. Import Workflow to n8n

1. Copy the contents of `modified-video-workflow.json`
2. In n8n, go to **Workflows** → **Import from File**
3. Paste the JSON
4. Update these values:
   - Google Sheets document ID
   - Replicate API credentials
   - Social media credentials (Blotato)

---

## 🎯 Workflow Changes Summary

| Component | Original | New | Savings |
|-----------|----------|-----|---------|
| Video Gen | Seedance ($0.30/clip) | Replicate SVD ($0.01/clip) | 95% |
| Sound | Fal AI ($0.15) | Free Music Library | 100% |
| Stitching | Fal AI FFmpeg ($0.05) | Local FFmpeg | 100% |
| **Total** | **$1.05-1.75** | **$0.015-0.045** | **~97%** |

---

## 🔧 Troubleshooting

### FFmpeg not found
```bash
# Check if installed
which ffmpeg

# Install if missing
sudo apt install ffmpeg -y
```

### Replicate API errors
- Check your API key is correct
- Verify you have credits: https://replicate.com/account/billing
- First prediction might take 60-90 seconds (cold start)

### Videos not stitching
- Ensure all 3 video URLs are valid
- Check FFmpeg logs in node output
- Verify temp directory has write permissions

### Out of memory
If stitching fails with memory errors:
```bash
# Add this to FFmpeg node command
export TEMP_DIR="/tmp/n8n-video-$(date +%s)"
```

---

## 📊 Performance Expectations

- **Video generation**: 30-60 seconds per clip (cold start), 15-30s (warm)
- **Stitching**: 5-10 seconds locally
- **Total workflow**: ~2-3 minutes per complete video
- **Quality**: Good for social media (TikTok, Instagram Reels, YouTube Shorts)

---

## 🚀 Next Steps

1. Test with a single video first
2. Verify costs in Replicate dashboard
3. Adjust quality settings if needed (change `crf` value in FFmpeg)
4. Scale up to scheduled runs once working

---

Conceived by Romuald Członkowski - [www.aiadvisors.pl/en](https://www.aiadvisors.pl/en)
