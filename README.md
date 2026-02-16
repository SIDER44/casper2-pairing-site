# casper2-pairing-site
# 🌐 Casper2 WhatsApp Pairing Site

A beautiful, professional session pairing website for WhatsApp bots. Get session credentials easily via QR code or pairing code!

---

## ✨ **FEATURES**

- ✅ **QR Code Method** - Scan with WhatsApp
- ✅ **Pairing Code Method** - Enter phone number
- ✅ **Beautiful UI** - Modern, animated design
- ✅ **Session Download** - Get credentials instantly
- ✅ **Auto Cleanup** - Sessions auto-delete after 5 minutes
- ✅ **Mobile Responsive** - Works on all devices
- ✅ **Secure** - Session data not stored permanently

---

## 📥 **DEPLOYMENT**

### **Option 1: Deploy to Render** (Recommended)

1. **Create GitHub Repository**
   - Upload all files from `pairing-site` folder:
     - `package.json`
     - `server.js`
     - `public/index.html`
     - `public/style.css`
     - `public/script.js`

2. **Go to Render.com**
   - Click **"New +"** → **"Web Service"**
   - Connect your GitHub repository
   - Configure:
     - **Build Command:** `npm install --legacy-peer-deps`
     - **Start Command:** `npm start`
     - **Instance Type:** Free

3. **Deploy!**
   - Click "Create Web Service"
   - Wait 3-5 minutes
   - Visit your Render URL

---

### **Option 2: Deploy to Vercel**

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Deploy**
   ```bash
   cd pairing-site
   vercel
   ```

3. **Follow prompts**
   - Vercel will deploy automatically
   - Get your live URL

---

### **Option 3: Run Locally**

1. **Install Dependencies**
   ```bash
   cd pairing-site
   npm install --legacy-peer-deps
   ```

2. **Start Server**
   ```bash
   npm start
   ```

3. **Visit**
   ```
   http://localhost:3000
   ```

---

## 🎯 **HOW TO USE**

### **For Bot Users:**

1. Visit your pairing site URL
2. Choose pairing method:
   - **QR Code:** Scan with WhatsApp
   - **Pairing Code:** Enter phone number
3. Wait for connection
4. Download `creds.json`
5. Place in your bot's `auth_info` folder
6. Start your bot!

---

### **For Bot Owners:**

1. Deploy the pairing site
2. Share the URL with users
3. Users get their own session credentials
4. No need to share your QR code!

---

## 📁 **FILE STRUCTURE**

```
pairing-site/
├── package.json          # Dependencies
├── server.js             # Backend server
├── public/
│   ├── index.html        # Main page
│   ├── style.css         # Styling
│   └── script.js         # Frontend logic
└── sessions/             # Temporary sessions (auto-created)
```

---

## ⚙️ **CONFIGURATION**

### **Environment Variables** (Optional)

```env
PORT=3000                 # Server port (default: 3000)
```

### **Session Cleanup**

Sessions automatically delete after **5 minutes** of inactivity.

To change the cleanup time, edit `server.js`:

```javascript
// Line 18
if (now - session.createdAt > 300000) { // 5 minutes (300000ms)
```

Change `300000` to your desired time in milliseconds.

---

## 🔒 **SECURITY**

- ✅ Sessions stored temporarily (5 min max)
- ✅ Auto-cleanup prevents data accumulation
- ✅ No database - everything in memory
- ✅ Each session has unique ID
- ✅ Files downloaded securely

**⚠️ Warning:** Never share your credentials with anyone!

---

## 🎨 **CUSTOMIZATION**

### **Change Colors**

Edit `public/style.css`:

```css
:root {
    --primary: #25D366;      /* WhatsApp green */
    --secondary: #128C7E;    /* Dark green */
    --bg-dark: #0a0e27;      /* Background */
}
```

### **Change Title**

Edit `public/index.html`:

```html
<h1>Casper2 Pairing</h1>
```

### **Change Logo**

Replace the SVG in `public/index.html` (header section).

---

## 🚀 **FEATURES BREAKDOWN**

### **QR Code Method**
- Generates QR code using Baileys
- Converts to data URL for display
- Auto-refreshes on connection
- Beautiful animated loading

### **Pairing Code Method**
- Requests 8-digit code
- Display formatted code
- Step-by-step instructions
- Phone number validation

### **Download System**
- Downloads `creds.json` file
- Contains all auth credentials
- Ready to use in bot
- Automatic filename

---

## 📱 **MOBILE SUPPORT**

- ✅ Fully responsive design
- ✅ Touch-friendly buttons
- ✅ Mobile-optimized QR codes
- ✅ Works on all screen sizes

---

## 🐛 **TROUBLESHOOTING**

### **QR Code Not Generating**

1. Check server logs
2. Ensure Baileys is installed
3. Try restarting the server
4. Check internet connection

### **Pairing Code Not Working**

1. Verify phone number format (no + or -)
2. Check if WhatsApp is latest version
3. Try QR code method instead

### **Download Not Working**

1. Check if session is connected
2. Wait for success screen
3. Check browser download settings
4. Try different browser

---

## 🔄 **UPDATES**

### v1.0.0 (Current)
- ✅ QR code pairing
- ✅ Pairing code method
- ✅ Session download
- ✅ Auto cleanup
- ✅ Beautiful UI
- ✅ Mobile responsive

---

## 💡 **TIPS**

1. **Deploy publicly** - Share URL with bot users
2. **Keep updated** - Update Baileys regularly
3. **Monitor logs** - Check for errors
4. **Use HTTPS** - Render provides SSL automatically
5. **Test locally first** - Ensure everything works

---

## 🤝 **SUPPORT**

Having issues?

1. Check server logs
2. Verify Baileys version
3. Test with latest WhatsApp
4. Check internet connection

---

## 📜 **LICENSE**

MIT License - Free to use and modify!

---

## 🎯 **CREDITS**

- Built with [Baileys](https://github.com/WhiskeySockets/Baileys)
- Made for Casper2 Bot community
- Inspired by popular pairing sites

---

## ⭐ **ENJOY YOUR PAIRING SITE!**

Deploy it and start generating sessions! 🚀

Made with ❤️ for the WhatsApp Bot community

---

**Last Updated:** February 2026  
**Version:** 1.0.0  
**Status:** Active
