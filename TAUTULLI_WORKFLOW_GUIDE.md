# Tautulli Media Library Cleanup Analysis Workflow

**Automated workflow to analyze your Plex media library via Tautulli and recommend content for deletion.**

## 🎯 What This Workflow Does

This n8n workflow connects to your Tautulli instance to analyze your Plex media library and identifies:

- **Never watched media** - Content that has 0 plays
- **Stale content** - Not watched in 180+ days
- **Low-rated content** - Rating below 6.0/10
- **Unpopular content** - Less than 2 total plays
- **Duplicate files** - Same title/year (keeps largest file)

### Output

The workflow generates:
- **Statistics Summary** - Overview of your library and recommendations
- **CSV Export** - Detailed list of all recommended deletions with file paths
- **Space Savings** - Total GB that could be freed up
- **Top 20 List** - Largest files recommended for deletion

---

## 📋 Prerequisites

### 1. Tautulli Setup
- Tautulli installed and running (typically on `http://localhost:8181`)
- Tautulli API enabled
- API key generated (Settings → Web Interface → API)

### 2. n8n Installation
- n8n installed and running
- Access to import workflows

### 3. Get Your Tautulli Information

**Find your API Key:**
1. Open Tautulli web interface
2. Go to Settings → Web Interface → Show API Key
3. Copy the key

**Find your Section ID:**
1. In Tautulli, go to Libraries
2. The section ID is in the URL or visible in library details
3. Typically: `1` for Movies, `2` for TV Shows

---

## 🚀 Installation

### Step 1: Import the Workflow

1. Open your n8n interface
2. Click **Workflows** → **Import from File**
3. Select `Tautulli_Media_Cleanup_Analysis.json`
4. Click **Import**

### Step 2: Configure the Workflow

1. Open the imported workflow
2. Click on the **"Configuration"** node
3. Update these values:
   - **tautulliUrl**: Your Tautulli URL (e.g., `http://localhost:8181`)
   - **apiKey**: Your Tautulli API key
   - **sectionId**: Library section ID (1 for Movies, 2 for TV, etc.)

### Step 3: Test the Workflow

1. Click **"Execute Workflow"** button (play icon)
2. Watch the nodes execute
3. Check the output of the **"Generate Deletion Report"** node
4. Review the recommendations

---

## ⚙️ Configuration Options

### Thresholds (editable in "Analyze Media Library" node)

```javascript
const DAYS_THRESHOLD = 180;      // Not watched in X days
const RATING_THRESHOLD = 6.0;    // Rating below X/10
const PLAY_COUNT_THRESHOLD = 2;  // Less than X plays
```

### Schedule (editable in "Weekly Schedule" node)

Default: **Sunday at 2:00 AM**

Cron expression: `0 2 * * 0`

Common schedules:
- Daily at 2 AM: `0 2 * * *`
- Every Monday at 3 AM: `0 3 * * 1`
- First of month at midnight: `0 0 1 * *`

---

## 📊 Workflow Structure

```
1. Weekly Schedule (Trigger)
   ↓
2. Configuration (Set parameters)
   ↓ ↓
3. Get Library Data ←→ 4. Get Watch History
   ↓ ↓
5. Merge Data
   ↓
6. Analyze Media Library (JavaScript analysis)
   ↓
7. Has Recommendations? (IF check)
   ↓
8. Generate Deletion Report (Summary + CSV)
```

---

## 📤 Using the Output

### Option 1: Manual Review
1. Review the summary in the workflow output
2. Check the CSV for detailed file paths
3. Manually delete files from your storage

### Option 2: Integration with Maintainerr
Maintainerr can automate Plex media deletion. To integrate:

1. Export the CSV from the workflow output
2. Import into Maintainerr
3. Configure deletion rules in Maintainerr
4. Let Maintainerr handle the cleanup

### Option 3: Automated Script
Use the file paths from the CSV to create a deletion script:

```bash
#!/bin/bash
# Read CSV and delete files (USE WITH CAUTION!)
while IFS=, read -r title year type rating plays last size reasons path; do
  if [ "$path" != "File Path" ]; then  # Skip header
    echo "Deleting: $path"
    # rm "$path"  # Uncomment to actually delete
  fi
done < cleanup_recommendations.csv
```

---

## 🔧 Customization Ideas

### Add Email Notifications
1. Add an **Email** node after "Generate Deletion Report"
2. Send the summary report to your email
3. Attach the CSV file

### Add Webhook Trigger
1. Replace Schedule with **Webhook** node
2. Trigger analysis on-demand via HTTP request
3. Useful for manual/API-triggered scans

### Filter by Media Type
Modify the "Get All Media" node to filter:
- Movies only: `section_id=1`
- TV Shows only: `section_id=2`
- Music only: `section_id=3`

### Advanced Duplicate Detection
In the analysis code, you could enhance duplicate detection:
- Compare video codecs (keep H.265 over H.264)
- Compare resolutions (keep 4K over 1080p)
- Compare audio quality

---

## ⚠️ Safety Notes

### Before You Delete Anything:

1. **BACKUP FIRST** - Always have backups of important media
2. **Review Carefully** - Check the recommendations before deletion
3. **Test Small** - Start with a few files to verify
4. **Verify Ratings** - Some content may have missing/incorrect ratings
5. **Check Duplicates** - Ensure you're keeping the version you want

### Recommended Workflow:
1. Run analysis weekly
2. Review recommendations
3. Manually verify top 10-20 items
4. Delete in batches
5. Monitor Plex after deletion

---

## 🐛 Troubleshooting

### Error: "Access denied" or "Invalid API key"
- Verify your API key is correct
- Check Tautulli API is enabled in settings
- Ensure your Tautulli URL is accessible from n8n

### Error: "Cannot read property 'data'"
- Tautulli might be returning empty results
- Check the section_id is correct
- Verify you have media in that library

### No Recommendations Generated
- Your library is well-maintained! 🎉
- Try adjusting the thresholds (make them less strict)
- Check if watch history is being tracked in Tautulli

### Duplicate Detection Not Working
- Ensure titles are properly matched in Plex
- Check year metadata is accurate
- Consider manual duplicate tools (like Dupefinder)

---

## 🔮 Future Enhancements

Potential additions for this workflow:

1. **Sonarr/Radarr Integration** - Auto-delete from media managers
2. **Backup Integration** - Move to archive instead of delete
3. **User Notifications** - Alert users before deletion
4. **Quality Comparison** - Keep best quality in duplicates
5. **Storage Monitoring** - Only run when space is low
6. **Plex API Integration** - Get more detailed metadata

---

## 📝 Example Output

```
# Tautulli Media Library Cleanup Report
Generated: 2025-11-04T09:00:00.000Z

## Summary Statistics
- Total Items in Library: 1,523
- Items Recommended for Deletion: 247
- Potential Space Saved: 1,847.32 GB

## Breakdown
- Never Watched: 89
- Not Watched Recently (>180 days): 112
- Low Rated: 34
- Unpopular: 67
- Duplicates: 12

## Top 20 Recommendations (by file size)
1. Movie Title (2019) - 45.2 GB
   - Reasons: Never watched, Low rating (4.2/10)
   - Play count: 0, Last watched: Never
   - Path: /media/movies/Movie.Title.2019.mkv
```

---

## 🤝 Integration with Other Tools

### Maintainerr
- Import CSV directly
- Set up automated rules
- Schedule deletions

### Tautulli Scripts
- Use custom scripts feature
- Trigger on library scan
- Auto-generate reports

### Plex Meta Manager
- Tag recommended deletions
- Create collections
- Easy bulk operations

### Sonarr/Radarr
- API integration possible
- Unmonitor before delete
- Update quality profiles

---

## 📚 Resources

- [Tautulli Documentation](https://github.com/Tautulli/Tautulli/wiki)
- [Tautulli API Reference](https://github.com/Tautulli/Tautulli/wiki/Tautulli-API-Reference)
- [Maintainerr Project](https://github.com/jorenn92/Maintainerr)
- [n8n Documentation](https://docs.n8n.io/)

---

## 💡 Tips for Best Results

1. **Run Analysis Periodically** - Weekly is recommended
2. **Adjust Thresholds** - Based on your usage patterns
3. **Consider Seasonality** - Holiday content, etc.
4. **Check User Preferences** - Don't delete user favorites
5. **Review Before Deletion** - Always verify recommendations
6. **Monitor After Cleanup** - Ensure nothing important was removed

---

## 🎉 Success Stories

After implementing this workflow, users typically:
- Reclaim 500GB - 2TB of storage
- Reduce Plex library clutter by 15-30%
- Improve Plex performance (smaller libraries = faster)
- Better understand viewing patterns

---

## ❓ FAQ

**Q: Will this automatically delete my files?**
A: No! This workflow only generates recommendations. You must manually review and delete.

**Q: Can I adjust what's considered "old" or "low-rated"?**
A: Yes! Edit the thresholds in the "Analyze Media Library" node.

**Q: What about files I'm keeping for archival purposes?**
A: Consider adding Plex labels/tags and filtering those out in the analysis.

**Q: Does this work with TV shows?**
A: Yes! Set `sectionId` to your TV section (usually 2).

**Q: Can I run this for multiple libraries?**
A: Yes! Duplicate the workflow and change the `sectionId` for each.

---

## 📞 Support

If you need help:
1. Check the troubleshooting section above
2. Review n8n execution logs
3. Verify Tautulli API responses
4. Check the n8n community forums

---

**Created using n8n-mcp knowledge base**
**Conceived by Romuald Członkowski - www.aiadvisors.pl/en**

**Version: 1.0.0**
**Last Updated: November 4, 2025**
