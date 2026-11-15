# 🚀 MyApps.hub - App Showcase & Distribution Platform (with Google Drive Cloud Storage)

A modern full-stack web platform designed for developers and creators to showcase, manage, and distribute applications (.apk, .exe, .zip, etc.) with direct downloads, real-time analytics, and automated **Google Drive Cloud Storage** synchronization.

---

## 🌟 What's New: Automated Google Drive Storage Integration

Your platform is now equipped with seamless **Google Drive API Cloud Storage**:
1. **Automated Upload**: When you upload an app package (.apk, .exe, etc.) or screenshot in the Admin panel, it automatically streams directly to your Google Drive folder and sets public download permissions.
2. **Automated Deletion**: When you delete an app from the website, the server automatically issues a delete command to Google Drive, **immediately freeing up your Google Drive storage space**.
3. **Automated Update**: When you upload a new version of an app, the old file on Google Drive is deleted and replaced with the new one.
4. **Local Fallback**: If Google Drive is not connected yet, files automatically store locally in `server/uploads/`.

---

## 🔑 Default Admin Credentials

| Field | Value |
|---|---|
| **Portal URL** | [http://localhost:5000/admin/login](http://localhost:5000/admin/login) |
| **Username** | `admin` |
| **Password** | `admin123` |

---

## ☁️ How to Connect Your Google Drive (3 Quick Steps)

You can connect your Google Drive directly from **Admin Settings** ([http://localhost:5000/admin/settings](http://localhost:5000/admin/settings)):

### Step 1: Create a Service Account (Free)
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (or choose an existing one).
3. Search for **Google Drive API** in the top search bar and click **Enable**.
4. Go to **APIs & Services → Credentials** → click **Create Credentials** → **Service Account**.
5. Give it a name (e.g. `myapps-storage`) and click **Done**.

### Step 2: Download your JSON Key
1. Click on the newly created Service Account email.
2. Go to the **Keys** tab → click **Add Key → Create new key** → select **JSON** → click **Create**.
3. A `.json` file will download to your computer.

### Step 3: Share your Google Drive Folder with the Service Account
1. Open [Google Drive](https://drive.google.com/) with your personal Google account.
2. Create a folder (e.g., `MyApps_Uploads`).
3. Right-click the folder → **Share** → paste your Service Account email (e.g. `myapps-storage@...iam.gserviceaccount.com`).
4. Set permission to **Editor** and click **Send**.
5. Copy the Folder ID from the URL bar (e.g. `drive.google.com/drive/folders/`**`1aBcDeFg...`**).

### Step 4: Paste & Connect
1. Open your MyAppsWeb Admin Settings: [http://localhost:5000/admin/settings](http://localhost:5000/admin/settings).
2. Paste the JSON key (or click *Upload key .json file*) and enter your Folder ID.
3. Click **Save & Connect Google Drive**.
4. That's it! All app uploads and deletions are now 100% automated with your Google Drive!

---

## 🚀 Running the Platform

- **Production Mode (Running now on port 5000):**
  ```powershell
  npm start
  ```
  Visit: **`http://localhost:5000`**

- **Development Mode (Live hot-reload):**
  ```powershell
  # Terminal 1
  npm run server

  # Terminal 2
  npm run client
  ```

- **Rebuild Frontend:**
  ```powershell
  npm run build:client
  ```
