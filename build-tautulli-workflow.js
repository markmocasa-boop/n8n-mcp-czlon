// Build Tautulli Media Analysis Workflow
const fs = require('fs');
const path = require('path');

console.log('🔍 Building Tautulli Media Analysis Workflow...\n');

console.log('📦 Nodes used in this workflow:');
console.log('  ✅ Schedule Trigger: Run workflow on a schedule');
console.log('  ✅ HTTP Request: Fetch data from Tautulli API');
console.log('  ✅ Code: Custom JavaScript for media analysis');
console.log('  ✅ IF: Conditional logic for filtering');
console.log('  ✅ Set: Configure workflow parameters');
console.log('  ✅ Merge: Combine multiple data sources');

// Build the workflow
const workflow = {
  "name": "Tautulli Media Library Cleanup Analysis",
  "nodes": [
    {
      "parameters": {
        "rule": {
          "interval": [
            {
              "field": "cronExpression",
              "expression": "0 2 * * 0"
            }
          ]
        }
      },
      "id": "schedule-trigger",
      "name": "Weekly Schedule",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1.2,
      "position": [250, 300]
    },
    {
      "parameters": {
        "url": "={{$json.tautulliUrl}}/api/v2",
        "authentication": "predefinedCredentialType",
        "nodeCredentialType": "tautulliApi",
        "sendQuery": true,
        "queryParameters": {
          "parameters": [
            {
              "name": "apikey",
              "value": "={{$json.apiKey}}"
            },
            {
              "name": "cmd",
              "value": "get_library_media_info"
            },
            {
              "name": "section_id",
              "value": "={{$json.sectionId}}"
            },
            {
              "name": "length",
              "value": "10000"
            }
          ]
        },
        "options": {}
      },
      "id": "get-library",
      "name": "Get All Media from Library",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [470, 300]
    },
    {
      "parameters": {
        "url": "={{$json.tautulliUrl}}/api/v2",
        "sendQuery": true,
        "queryParameters": {
          "parameters": [
            {
              "name": "apikey",
              "value": "={{$json.apiKey}}"
            },
            {
              "name": "cmd",
              "value": "get_history"
            },
            {
              "name": "length",
              "value": "10000"
            }
          ]
        },
        "options": {}
      },
      "id": "get-history",
      "name": "Get Watch History",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [470, 500]
    },
    {
      "parameters": {
        "jsCode": `// Tautulli Media Analysis Script
// Analyzes media library for cleanup recommendations

const libraryData = $input.first().json.response.data.data || [];
const historyData = $input.all()[1].json.response.data.data || [];

// Configuration
const DAYS_THRESHOLD = 180; // Consider unwatched if not viewed in 180 days
const RATING_THRESHOLD = 6.0; // Consider low-rated if below 6.0
const PLAY_COUNT_THRESHOLD = 2; // Consider unpopular if played less than this

const now = Date.now();
const daysToMs = days => days * 24 * 60 * 60 * 1000;

// Build watch history map
const watchHistory = {};
historyData.forEach(watch => {
  const ratingKey = watch.rating_key;
  if (!watchHistory[ratingKey]) {
    watchHistory[ratingKey] = {
      lastWatched: 0,
      playCount: 0,
      users: new Set()
    };
  }
  const watchTime = watch.stopped * 1000; // Convert to ms
  if (watchTime > watchHistory[ratingKey].lastWatched) {
    watchHistory[ratingKey].lastWatched = watchTime;
  }
  watchHistory[ratingKey].playCount++;
  watchHistory[ratingKey].users.add(watch.user);
});

// Analyze each media item
const recommendations = [];
const duplicates = {};

libraryData.forEach(item => {
  const ratingKey = item.rating_key;
  const title = item.title || item.grandparent_title || 'Unknown';
  const year = item.year || 'Unknown';
  const rating = parseFloat(item.rating || 0);
  const fileSize = parseInt(item.file_size || 0);
  const history = watchHistory[ratingKey] || { lastWatched: 0, playCount: 0, users: new Set() };

  const daysSinceWatch = history.lastWatched
    ? Math.floor((now - history.lastWatched) / daysToMs(1))
    : 9999;

  const analysis = {
    ratingKey,
    title,
    year,
    mediaType: item.media_type,
    rating,
    playCount: history.playCount,
    lastWatched: history.lastWatched ? new Date(history.lastWatched).toISOString() : 'Never',
    daysSinceWatch,
    fileSize: (fileSize / (1024 ** 3)).toFixed(2) + ' GB',
    fileSizeBytes: fileSize,
    filePath: item.file,
    reasons: []
  };

  // Check for issues
  let deleteRecommended = false;

  if (history.playCount === 0) {
    analysis.reasons.push('Never watched');
    deleteRecommended = true;
  } else if (daysSinceWatch > DAYS_THRESHOLD) {
    analysis.reasons.push(\`Not watched in \${daysSinceWatch} days\`);
    deleteRecommended = true;
  }

  if (rating < RATING_THRESHOLD && rating > 0) {
    analysis.reasons.push(\`Low rating (\${rating}/10)\`);
    deleteRecommended = true;
  }

  if (history.playCount < PLAY_COUNT_THRESHOLD && history.playCount > 0) {
    analysis.reasons.push(\`Unpopular (only \${history.playCount} plays)\`);
    deleteRecommended = true;
  }

  // Check for duplicates (same title and year)
  const duplicateKey = \`\${title}|\${year}\`;
  if (!duplicates[duplicateKey]) {
    duplicates[duplicateKey] = [];
  }
  duplicates[duplicateKey].push(analysis);

  if (deleteRecommended) {
    analysis.deleteRecommended = true;
    recommendations.push(analysis);
  }
});

// Find and mark duplicates
Object.keys(duplicates).forEach(key => {
  const items = duplicates[key];
  if (items.length > 1) {
    // Sort by quality/size - keep the best one
    items.sort((a, b) => b.fileSizeBytes - a.fileSizeBytes);

    // Mark all except the first (largest) as duplicates
    items.forEach((item, index) => {
      if (index > 0) {
        item.reasons.push(\`Duplicate (keeping larger version)\`);
        item.deleteRecommended = true;
        item.isDuplicate = true;
        if (!recommendations.find(r => r.ratingKey === item.ratingKey)) {
          recommendations.push(item);
        }
      }
    });
  }
});

// Calculate statistics
const stats = {
  totalItems: libraryData.length,
  neverWatched: recommendations.filter(r => r.playCount === 0).length,
  notWatchedRecently: recommendations.filter(r => r.daysSinceWatch > DAYS_THRESHOLD && r.playCount > 0).length,
  lowRated: recommendations.filter(r => r.reasons.some(reason => reason.includes('Low rating'))).length,
  unpopular: recommendations.filter(r => r.reasons.some(reason => reason.includes('Unpopular'))).length,
  duplicates: recommendations.filter(r => r.isDuplicate).length,
  totalRecommendedForDeletion: recommendations.length,
  potentialSpaceSaved: recommendations.reduce((sum, r) => sum + r.fileSizeBytes, 0)
};

stats.potentialSpaceSavedGB = (stats.potentialSpaceSaved / (1024 ** 3)).toFixed(2) + ' GB';

// Sort by file size (delete largest first to save most space)
recommendations.sort((a, b) => b.fileSizeBytes - a.fileSizeBytes);

return [{
  json: {
    statistics: stats,
    recommendations,
    timestamp: new Date().toISOString()
  }
}];`
      },
      "id": "analyze-media",
      "name": "Analyze Media Library",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [690, 400]
    },
    {
      "parameters": {
        "conditions": {
          "number": [
            {
              "value1": "={{$json.statistics.totalRecommendedForDeletion}}",
              "operation": "larger",
              "value2": 0
            }
          ]
        }
      },
      "id": "check-recommendations",
      "name": "Has Recommendations?",
      "type": "n8n-nodes-base.if",
      "typeVersion": 2,
      "position": [910, 400]
    },
    {
      "parameters": {
        "jsCode": `// Generate deletion report
const data = $input.first().json;
const stats = data.statistics;
const recommendations = data.recommendations;

// Create CSV content for easy import into other tools
const csvLines = ['Title,Year,Type,Rating,Play Count,Last Watched,Days Since Watch,File Size,Reasons,File Path'];

recommendations.forEach(item => {
  const line = [
    \`"\${item.title.replace(/"/g, '""')}"\`,
    item.year,
    item.mediaType,
    item.rating,
    item.playCount,
    item.lastWatched,
    item.daysSinceWatch,
    item.fileSize,
    \`"\${item.reasons.join('; ')}"\`,
    \`"\${item.filePath.replace(/"/g, '""')}"\`
  ].join(',');
  csvLines.push(line);
});

const csvContent = csvLines.join('\\n');

// Create summary report
const summary = \`
# Tautulli Media Library Cleanup Report
Generated: \${data.timestamp}

## Summary Statistics
- Total Items in Library: \${stats.totalItems}
- Items Recommended for Deletion: \${stats.totalRecommendedForDeletion}
- Potential Space Saved: \${stats.potentialSpaceSavedGB}

## Breakdown
- Never Watched: \${stats.neverWatched}
- Not Watched Recently (>\${DAYS_THRESHOLD} days): \${stats.notWatchedRecently}
- Low Rated: \${stats.lowRated}
- Unpopular: \${stats.unpopular}
- Duplicates: \${stats.duplicates}

## Top 20 Recommendations (by file size)
\${recommendations.slice(0, 20).map((item, i) =>
  \`\${i + 1}. \${item.title} (\${item.year}) - \${item.fileSize}
   - Reasons: \${item.reasons.join(', ')}
   - Play count: \${item.playCount}, Last watched: \${item.lastWatched}
   - Path: \${item.filePath}\`
).join('\\n\\n')}

## Next Steps
1. Review the full CSV export for detailed recommendations
2. Use Maintainerr or similar tools to process the deletion list
3. Consider backing up before deletion
4. Run this analysis periodically to keep library optimized
\`;

return [{
  json: {
    summary,
    csvContent,
    statistics: stats,
    recommendations
  }
}];`
      },
      "id": "generate-report",
      "name": "Generate Deletion Report",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [1130, 300]
    },
    {
      "parameters": {
        "mode": "combine",
        "combinationMode": "multiplex",
        "options": {}
      },
      "id": "merge-data",
      "name": "Merge Library & History",
      "type": "n8n-nodes-base.merge",
      "typeVersion": 3,
      "position": [690, 300]
    },
    {
      "parameters": {
        "assignments": {
          "assignments": [
            {
              "id": "config-url",
              "name": "tautulliUrl",
              "value": "http://localhost:8181",
              "type": "string"
            },
            {
              "id": "config-key",
              "name": "apiKey",
              "value": "YOUR_TAUTULLI_API_KEY",
              "type": "string"
            },
            {
              "id": "config-section",
              "name": "sectionId",
              "value": "1",
              "type": "string"
            }
          ]
        },
        "options": {}
      },
      "id": "config-node",
      "name": "Configuration",
      "type": "n8n-nodes-base.set",
      "typeVersion": 3.3,
      "position": [250, 400],
      "notes": "Update these values:\\n- tautulliUrl: Your Tautulli URL\\n- apiKey: Your Tautulli API key\\n- sectionId: Library section ID (1 for Movies, 2 for TV, etc.)"
    }
  ],
  "connections": {
    "Weekly Schedule": {
      "main": [
        [
          {
            "node": "Configuration",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Configuration": {
      "main": [
        [
          {
            "node": "Get All Media from Library",
            "type": "main",
            "index": 0
          },
          {
            "node": "Get Watch History",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Get All Media from Library": {
      "main": [
        [
          {
            "node": "Merge Library & History",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Get Watch History": {
      "main": [
        [
          {
            "node": "Merge Library & History",
            "type": "main",
            "index": 1
          }
        ]
      ]
    },
    "Merge Library & History": {
      "main": [
        [
          {
            "node": "Analyze Media Library",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Analyze Media Library": {
      "main": [
        [
          {
            "node": "Has Recommendations?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Has Recommendations?": {
      "main": [
        [
          {
            "node": "Generate Deletion Report",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  },
  "pinData": {},
  "settings": {
    "executionOrder": "v1"
  },
  "staticData": null,
  "tags": [],
  "triggerCount": 0,
  "updatedAt": "2025-11-04T09:00:00.000Z",
  "versionId": "1"
};

// Save the workflow
const outputPath = path.join(__dirname, 'Tautulli_Media_Cleanup_Analysis.json');
fs.writeFileSync(outputPath, JSON.stringify(workflow, null, 2));

console.log('\\n✅ Workflow template created successfully!');
console.log(`📄 Saved to: ${outputPath}`);
console.log('\\n📋 Workflow Overview:');
console.log('  1. Schedule Trigger: Runs weekly (Sunday at 2 AM)');
console.log('  2. Configuration: Set your Tautulli URL and API key');
console.log('  3. Get Library Data: Fetches all media from Tautulli');
console.log('  4. Get Watch History: Fetches viewing history');
console.log('  5. Analyze Media: Identifies unwatched, unpopular, low-rated, and duplicate content');
console.log('  6. Generate Report: Creates summary and CSV export');
console.log('\\n🎯 What it analyzes:');
console.log('  - Never watched media');
console.log('  - Media not watched in 180+ days');
console.log('  - Low-rated content (< 6.0/10)');
console.log('  - Unpopular content (< 2 plays)');
console.log('  - Duplicate files (keeps largest)');
console.log('\\n📊 Output includes:');
console.log('  - Statistics summary');
console.log('  - CSV file with all recommendations');
console.log('  - Potential space savings');
console.log('  - File paths for deletion');
console.log('\\n🚀 Next Steps:');
console.log('  1. Import this workflow into n8n');
console.log('  2. Update the Configuration node with your Tautulli details');
console.log('  3. Test run manually first');
console.log('  4. Review the output and adjust thresholds if needed');
console.log('  5. Integrate with Maintainerr or deletion scripts');
