# Dating Dynamics Instagram Content Generator - Setup Guide

## 📊 Options Comparison

I've created **TWO workflows** for you. Choose based on your needs:

| Feature | Static Carousel | Animated Video (RECOMMENDED) |
|---------|----------------|------------------------------|
| **File** | `instagram-dating-carousel-workflow.json` | `instagram-dating-animated-workflow.json` |
| **Format** | 4 static images | 20-second animated video |
| **Cost per post** | ~$0.001 | ~$0.001 |
| **Best for** | Instagram carousel posts | Instagram Reels, TikTok, YouTube Shorts |
| **Engagement** | Good | **Better** (video > static) |
| **Setup complexity** | Simple | Medium (requires FFmpeg + ImageMagick) |
| **Platforms** | Instagram only | Instagram, TikTok, YouTube Shorts, Facebook |
| **Video effects** | None | Smooth transitions, zoom animations, fades |

### 🏆 Winner: Animated Video Workflow
**Why?** Same cost, better engagement, works on more platforms, looks more professional!

---

## 💰 Cost Breakdown

### Total Cost Per Post: ~$0.001-0.005 (essentially FREE!)

| Component | Tool | Cost |
|-----------|------|------|
| Text Generation | GPT-4o-mini | $0.0001 per request |
| Image Creation | ImageMagick (local) | FREE |
| Video Animation | FFmpeg (local) | FREE |
| Total | | **~$0.001 per video** |

**For 60 posts/month**: ~$0.06-0.30 total (99.9% cheaper than AI video generation!)

---

## 🛠 Setup Instructions

### 1. Install Required Software

#### On Ubuntu/Debian:
```bash
sudo apt update
sudo apt install ffmpeg imagemagick fonts-liberation -y
```

#### On MacOS:
```bash
brew install ffmpeg imagemagick
```

#### On Docker (add to Dockerfile):
```dockerfile
RUN apk add --no-cache \
    ffmpeg \
    imagemagick \
    fontconfig \
    ttf-dejavu
```

**Verify installation:**
```bash
ffmpeg -version
convert -version
```

---

### 2. Setup AI Text Generation

The workflow uses n8n's LangChain nodes. You need:

**Option A: OpenAI (Recommended - Best Quality)**
- Cost: ~$0.0001 per generation
- Model: GPT-4o-mini
- Setup: Add OpenAI API key in n8n credentials

**Option B: Anthropic Claude (Good Alternative)**
- Cost: ~$0.0003 per generation
- Model: Claude 3 Haiku
- Setup: Add Anthropic API key

**Option C: Free Alternative (Groq)**
- Cost: FREE (rate limited)
- Model: Llama 3.1 70B
- Setup: Get free API key from groq.com

---

### 3. Configure Social Media Posting

#### Blotato Setup (Easiest):
1. Sign up at [blotato.com](https://blotato.com)
2. Connect your Instagram, TikTok accounts
3. Get API key from Blotato dashboard
4. Add to n8n Blotato credentials

#### Alternative - Direct APIs:
- **Instagram**: Use Meta Graph API (requires Facebook Business account)
- **TikTok**: Use TikTok for Developers API
- **YouTube Shorts**: Use YouTube Data API v3

---

### 4. Setup Google Sheets Logging (Optional)

1. Create a Google Sheet with these columns:
   - `timestamp`
   - `title`
   - `test_type`
   - `video_url`
   - `status`

2. Connect Google Sheets in n8n:
   - Add Google OAuth2 credentials
   - Update sheet ID in workflow nodes

---

### 5. Import Workflow

1. Choose your workflow:
   - **Animated Video** (recommended): `instagram-dating-animated-workflow.json`
   - **Static Carousel**: `instagram-dating-carousel-workflow.json`

2. In n8n:
   - Go to **Workflows** → **Import from File**
   - Upload the JSON file
   - Update these values:
     - AI API credentials (OpenAI/Anthropic/Groq)
     - Blotato account IDs
     - Google Sheet ID (if using)

3. Test run manually before enabling schedule

---

## 🎨 Customization Options

### Change Colors
Edit the bash node color codes:
```bash
# Panel 1 (Her statement) - Pink
BG_COLOR="#FF6B9D"

# Panel 2 (Poor response) - Red
BG_COLOR="#C44569"

# Panel 3 (Good response) - Blue
BG_COLOR="#4A90E2"

# Panel 4 (Lesson) - Dark
BG_COLOR="#2C3E50"
```

### Change Video Duration
Each panel shows for 5 seconds. To change:
```bash
# In FFmpeg command, change -t values:
-loop 1 -t 5 -i "$TEMP_DIR/panel1.png"  # Change 5 to desired seconds
```

### Change Fonts
```bash
# Replace Arial with other fonts:
-font "Helvetica-Bold"
-font "Impact"
-font "DejaVu-Sans-Bold"
```

### Add Background Music
Download royalty-free music and add to FFmpeg:
```bash
ffmpeg ... \
  -i "/path/to/background.mp3" \
  -c:a aac -b:a 128k -shortest \
  ...
```

### Change Video Resolution
Default is 1080x1920 (vertical). To change:
```bash
# For square (Instagram grid):
-size 1080x1080

# For horizontal (YouTube):
-size 1920x1080
```

---

## 📱 Content Examples

The AI will generate scenarios like:

### Example 1: The "I'm Fine" Test
- **Her**: "I'm fine, you can go out with your friends"
- **Poor Response**: "Okay cool, see you later!"
- **Good Response**: "Are you sure? I can tell something's bothering you"
- **Lesson**: "I'm fine" often means the opposite. She's testing if you're emotionally aware.

### Example 2: The Plans Test
- **Her**: "What are we doing this weekend?"
- **Poor Response**: "I don't know, what do you want to do?"
- **Good Response**: "I was thinking we could try that new restaurant, then maybe a movie. Sound good?"
- **Lesson**: She wants to see leadership and decisiveness, not indecision.

### Example 3: The Jealousy Test
- **Her**: "My ex just texted me"
- **Poor Response**: "What did he want?? Are you going to meet him??"
- **Good Response**: "Oh yeah? Well, I'm the lucky one now 😏"
- **Lesson**: She's testing your confidence. Jealousy shows insecurity.

---

## 🎯 Content Strategy Tips

### Best Posting Times:
- **Instagram**: 11am-1pm, 7pm-9pm
- **TikTok**: 6am-10am, 7pm-11pm
- **Schedule**: Twice daily (workflow default)

### Content Themes to Rotate:
1. Fitness tests ("You're going to the gym AGAIN?")
2. Compliance tests ("Can you do X for me?")
3. Emotional intelligence tests (crying, upset, "bad day")
4. Interest tests ("I'm busy this week")
5. Value tests ("What do you do for fun?")
6. Jealousy tests (mentioning other guys)
7. Decision-making tests ("Where should we go?")
8. Availability tests (last-minute plans)

### Hashtag Strategy:
The AI generates hashtags, but you can customize:
- **Niche**: #datingadvice #relationshipadvice #datingtips
- **Audience**: #menspsychology #masculinity #dating101
- **Trending**: #redpill #highvalueman #dating2025
- **General**: #relationships #love #dating

---

## 🚀 Advanced Features

### Add Custom Topics
Modify the AI prompt to focus on specific scenarios:
```
"Generate a scenario about [SPECIFIC TOPIC]"

Examples:
- "Generate a scenario about first date conversations"
- "Generate a scenario about texting mistakes men make"
- "Generate a scenario about workplace attraction dynamics"
```

### Multi-Language Support
Add language to the prompt:
```
"Generate in Spanish/French/German..."
```

### Batch Generation
Modify the workflow to generate multiple posts at once:
- Add loop node after AI generation
- Generate 5-10 scenarios in one run
- Save to queue for later posting

---

## 🔧 Troubleshooting

### FFmpeg Error: "Font not found"
```bash
# Install fonts
sudo apt install fonts-liberation ttf-dejavu -y

# Or specify full font path:
-font "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
```

### ImageMagick: "Not authorized"
Edit ImageMagick policy file:
```bash
sudo nano /etc/ImageMagick-6/policy.xml

# Change this line:
<policy domain="path" rights="none" pattern="@*"/>
# To:
<policy domain="path" rights="read|write" pattern="@*"/>
```

### Video Too Large for Instagram
Instagram Reels max size: 100MB. Reduce quality:
```bash
# Change -crf 23 to higher number (lower quality, smaller file):
-crf 28  # Good quality, smaller size
```

### AI Generates Inappropriate Content
Add content filter to AI prompt:
```
"Keep all content professional, educational, and appropriate for social media. Avoid explicit or offensive language."
```

---

## 📊 Expected Results

### Engagement Rates (Typical):
- **Static carousel**: 2-4% engagement
- **Animated video**: 4-8% engagement (2x better!)

### Video Performance:
- **Instagram Reels**: Best performance (algorithm favors Reels)
- **TikTok**: Good reach, especially with trending sounds
- **YouTube Shorts**: Growing platform, good discoverability

### Growth Timeline:
- **Week 1-4**: 100-500 followers (building foundation)
- **Month 2-3**: 1,000-5,000 followers (if consistent + good content)
- **Month 4+**: Potential viral posts, faster growth

**Key**: Consistency is everything! Post 1-2x daily.

---

## 💡 Monetization Ideas

Once you grow your audience:

1. **Affiliate Marketing**: Dating courses, relationship books
2. **Digital Products**: Your own dating guides, ebooks
3. **Coaching**: 1-on-1 dating coaching sessions
4. **Sponsored Posts**: Brands pay $100-1000+ per post
5. **YouTube**: Ad revenue from Shorts
6. **Patreon**: Premium content for subscribers

---

## 🎬 Next Steps

1. ✅ Install FFmpeg + ImageMagick
2. ✅ Import workflow to n8n
3. ✅ Add AI API credentials
4. ✅ Test run manually
5. ✅ Review first video
6. ✅ Adjust colors/fonts if needed
7. ✅ Enable schedule trigger
8. ✅ Monitor performance
9. ✅ Scale up!

---

## 📞 Need Help?

If you need custom modifications or help setting up:
- Check n8n community forum
- Review FFmpeg documentation
- Test with manual workflow runs first

---

Conceived by Romuald Członkowski - [www.aiadvisors.pl/en](https://www.aiadvisors.pl/en)
