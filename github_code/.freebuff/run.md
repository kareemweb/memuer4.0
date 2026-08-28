# Preview Run Doc

## Reproduce uncommitted artifacts
- No `.env.local` needed — the app runs without one (Gemini API key is optional).
- Dependencies are already installed in `node_modules/`.

## How to run the server
1. Ensure port 3000 is free.
2. Start Vite dev server from the project root:
   ```
   powershell -NoProfile -Command "(Start-Process -FilePath 'npm.cmd' -ArgumentList 'run','dev' -RedirectStandardOutput '<log>' -RedirectStandardError '<log>.err' -WindowStyle Hidden -PassThru).Id"
   ```
3. Wait until `http://localhost:3000` responds.
4. Register preview with the URL and pid.
