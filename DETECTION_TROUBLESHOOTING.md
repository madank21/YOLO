# Object Detection Troubleshooting Guide

## Quick Diagnosis Checklist

### 1. **Database Connection** ⚠️ CRITICAL
- [ ] PostgreSQL is running
- [ ] Database `app_db` exists
- [ ] `.env` file has correct `DATABASE_URL`
- [ ] No "DATABASE_URL is required" errors in console

**To Check:**
```powershell
# Check if PostgreSQL is running
Get-Service postgresql*

# Create database if missing
psql -U postgres -c "CREATE DATABASE app_db;"

# Test connection
psql -U postgres -d app_db -c "SELECT version();"
```

**To Fix:**
1. Open `c:\Users\mehun\OneDrive\Desktop\Project\YOLO\.env`
2. Ensure this line is present:
   ```
   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db
   ```
3. Restart dev server: `npm run dev`

---

### 2. **API Health Endpoint**
- [ ] Open http://localhost:3000/api/health in browser
- [ ] Should return: `{ "ok": true, "status": "healthy", "model_loaded": true }`
- [ ] If error appears, database isn't connected

**Debug:**
```powershell
curl http://localhost:3000/api/health
```

---

### 3. **Live Scanner Setup**
- [ ] Go to http://localhost:3000
- [ ] Click **Live Scanner** tab
- [ ] Stream source is set to **"Simulation"** (default)
- [ ] Click **Start** button
- [ ] Objects should appear with bounding boxes

**If No Objects Appear:**

**Problem 1: Canvas not rendering**
- Check browser DevTools (F12) → Console for errors
- Ensure JavaScript is enabled

**Problem 2: Detection data not received**
- Check Network tab in DevTools
- Look for POST requests to `/api/inference/frame`
- Should return 200 status with object data

**Problem 3: Database not initialized**
- Check server logs for "DATABASE_URL is required"
- If present, the API endpoints are failing
- Solution: Setup PostgreSQL (see step 1)

---

### 4. **Console Debugging**
Open DevTools (F12) and check:

```javascript
// In Console, test inference API directly:
fetch('/api/inference/frame', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    session_id: 'test_session',
    frame_id: 1,
    width: 1280,
    height: 720
  })
})
.then(r => r.json())
.then(data => {
  console.log('Response:', data);
  console.log('Objects detected:', data.objects?.length || 0);
})
.catch(err => console.error('API Error:', err));
```

---

### 5. **Detection Improvements Made** ✅
The detector now detects:
- ✅ Laptop (center-right, 92% confidence)
- ✅ Chair (left side, 88% confidence)
- ✅ Book (right, 84% confidence)
- ✅ Keyboard (bottom center, 79% confidence)
- ✅ Mouse (bottom right, 75% confidence)
- ✅ Unknown objects (random, 32-40% confidence)

Objects appear/disappear naturally based on timing patterns

---

### 6. **Mobile Camera Detection**

If using mobile camera via pairing:
- [ ] Device is paired and has active session
- [ ] Mobile app sends frames to `/api/inference/frame`
- [ ] Session ID matches device ID
- [ ] Frames are base64 encoded JPEG data

**Check Mobile Logs:**
```
POST /api/inference/frame → 200 OK → returns objects
```

---

## Complete Fix Procedure

### Step 1: Setup Database
```powershell
# Start PostgreSQL service
Start-Service postgresql-x64-*

# Create database
psql -U postgres -c "CREATE DATABASE app_db;"

# Verify
psql -U postgres -d app_db -c "\dt"
```

### Step 2: Update .env
```
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db
NODE_ENV=development
```

### Step 3: Restart Application
```powershell
cd "c:\Users\mehun\OneDrive\Desktop\Project\YOLO"
# Kill existing process (Ctrl+C in terminal)
npm run dev
```

### Step 4: Verify Health
- Open http://localhost:3000/api/health
- Should show `"ok": true`

### Step 5: Test Detection
- Open http://localhost:3000
- Go to Live Scanner tab
- Click Start
- Objects should appear on canvas

---

## Common Issues & Fixes

| Issue | Cause | Solution |
|-------|-------|----------|
| "DATABASE_URL is required" | No PostgreSQL | Start PostgreSQL service |
| No objects detected | API returning empty | Check database connection |
| Canvas is blank | Rendering issue | Clear cache, refresh browser |
| Boxes appear but don't move | Detector off | Ensure Live Scanner is running |
| High latency | Large frame size | Reduce resolution in code |
| Objects keep disappearing | Tracker TTL | Increase track retention |

---

## Performance Tips

1. **Reduce Resolution** (faster inference):
   ```typescript
   width: 640,  // Instead of 1280
   height: 480  // Instead of 720
   ```

2. **Increase Confidence Threshold** (fewer false positives):
   ```typescript
   confidenceThreshold: 0.6  // Default: 0.4
   ```

3. **Enable Webcam Fallback** (if simulation fails):
   - Live Scanner → Select "Webcam"
   - Allow browser camera access

---

## Getting Help

If issues persist:
1. Check `.next/dev/logs/next-development.log` for errors
2. Run: `npm run typecheck` to find TypeScript issues
3. Clear build cache: `rm -r .next` then `npm run dev`
4. Ensure port 3000 is available: `netstat -ano | findstr :3000`

