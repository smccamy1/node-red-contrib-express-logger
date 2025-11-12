# Persistent CSV Storage Testing Guide

This guide explains how to test the persistent CSV storage functionality that survives Node-RED restarts.

## What Was Added

The Express Logger node now includes persistent storage for CSV data with these features:

### **Automatic Data Persistence**
- CSV log entries are automatically saved to a JSON file on disk
- Data is preserved across Node-RED restarts and deployments
- Periodic saves every 100 entries or 5 minutes (whichever comes first)
- Final save when Node-RED shuts down

### **Configurable Storage**
- **Data Storage File**: Where persistent data is saved (default: `{userDir}/logs/express-logger-data.json`)
- **Max Stored Entries**: Maximum entries to keep (default: 50,000)
- **Automatic Cleanup**: Old entries are removed when limit is reached

## Testing the Persistence

### **1. Basic Functionality Test**

1. Deploy the updated Express Logger node
2. Configure it with CSV export enabled
3. Generate some HTTP traffic to your Node-RED instance
4. Check the data storage file:
   ```bash
   # Default location (adjust for your userDir)
   cat ~/.node-red/logs/express-logger-data.json
   ```

### **2. Restart Persistence Test**

1. Deploy the node and generate some traffic
2. Export to CSV and note the number of entries
3. Restart Node-RED completely
4. Deploy the node again 
5. Export to CSV again - you should see the same entries from before plus any new ones

### **3. Large Dataset Test**

1. Configure `Max Stored Entries` to a smaller value (e.g., 100)
2. Generate more than 100 requests
3. Check that old entries are removed and only the most recent ones are kept
4. Verify the data file doesn't grow beyond the limit

## Configuration Examples

### **Default Configuration**
```json
{
  "enableCsvExport": true,
  "csvExportPath": "logs/exports",
  "csvDataFile": "logs/express-logger-data.json",
  "maxPersistentEntries": 50000
}
```

### **High-Volume Configuration**
```json
{
  "enableCsvExport": true,
  "csvExportPath": "logs/exports", 
  "csvDataFile": "logs/express-logger-data.json",
  "maxPersistentEntries": 100000
}
```

### **Minimal Storage Configuration**
```json
{
  "enableCsvExport": true,
  "csvExportPath": "logs/exports",
  "csvDataFile": "logs/express-logger-data.json", 
  "maxPersistentEntries": 5000
}
```

## Data File Structure

The persistent data file contains:

```json
{
  "lastUpdated": "2025-11-11T16:50:20.484Z",
  "entryCount": 1234,
  "entries": [
    {
      "timestamp": "2025-11-11T16:45:12.345Z",
      "method": "GET",
      "url": "/",
      "statusCode": 200,
      "responseTime": 45,
      "ip": "127.0.0.1",
      "userAgent": "Mozilla/5.0...",
      "isEditorRequest": false,
      "isDashboardRequest": false,
      "hasRefreshIndicators": false,
      "connectionIssues": ""
    }
  ]
}
```

## Troubleshooting

### **Data Not Persisting**
- Check file permissions on the data storage directory
- Verify the configured path is writable
- Look for error messages in Node-RED logs

### **High Memory Usage**
- Reduce `maxPersistentEntries` value
- Monitor the data file size
- Check if periodic saves are working (look for log messages)

### **Performance Issues**
- The automatic save happens every 100 entries - increase if needed
- Consider placing data file on fast storage (SSD)
- Monitor Node-RED logs for save timing information

## Manual Testing Commands

### **Check Data File**
```bash
# View data file (formatted)
cat ~/.node-red/logs/express-logger-data.json | jq .

# Check file size
ls -lh ~/.node-red/logs/express-logger-data.json

# Monitor changes
tail -f ~/.node-red/logs/express-logger-data.json
```

### **Generate Test Traffic**
```bash
# Simple load test
for i in {1..50}; do
  curl -s http://localhost:1880/ > /dev/null
  echo "Request $i completed"
done
```

### **Monitor Node-RED Logs**
```bash
# Look for persistence-related messages
tail -f ~/.node-red/logs/node-red.log | grep -i "csv\|persist\|save"
```

## Benefits

1. **No Data Loss**: HTTP logs survive Node-RED restarts and deployments
2. **Historical Analysis**: Accumulate long-term traffic data
3. **Automatic Management**: No manual intervention required
4. **Configurable Retention**: Control storage usage
5. **Performance Optimized**: Periodic saves reduce I/O impact

This persistent storage ensures your CSV export functionality maintains historical data even when your Node-RED instance is restarted for updates or maintenance!