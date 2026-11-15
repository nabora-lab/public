# Drive Video Gallery (Vercel ready)

## Files jo GitHub mein honi chahiye
```
api/index.js
public/index.html
public/admin.html
public/style.css
package.json
vercel.json
server.js        (sirf local/Render ke liye, Vercel ko zaroorat nahi)
```

## Vercel par
1. Repo import karein. Framework Preset: **Other**. Build/Output settings khali rakhein.
2. **Settings → Environment Variables**: `ADMIN_PASSWORD` = apna password. Phir **Redeploy**.
3. Website: `https://aapki-site.vercel.app`  |  Admin: `https://aapki-site.vercel.app/admin`

## Videos save karne ke 2 tareeqe
**A) Admin panel (Upstash Redis, free):** Vercel project → **Storage → Create/Connect → Upstash Redis (Marketplace)**. Connect karte hi variables khud lag jate hain. Redeploy karein. Ab admin se add/delete hamesha save rahega.

**B) Bina Upstash:** `api/index.js` ke upar `SEED` list mein video ka ID likh kar GitHub par commit karein. Site khud update ho jati hai.

## Drive sharing
Har video: Share → **Anyone with the link → Viewer**.
