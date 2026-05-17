## Telegram Mini App — Monetag Rewarded Ads

User Telegram er bot button thekay webapp open korbe: `https://yoursite.com/?id=<telegram_chat_id>`. Ad dekhle point pabe, point withdraw korte parbe. Admin panel theke shob kichu control hobe.

### Pages / Routes

```
/                  -> Mini app (reads ?id=chat_id from URL)
/withdraw          -> Withdraw request form
/history           -> Ad watch + withdraw history
/admin             -> Admin login (password: 76737)
/admin/dashboard   -> Admin settings + withdraw approvals
```

### Mini App (`/`)

- URL theke `?id=` (telegram chat id) read kore — na thakle error dekhabe ("Please open from Telegram bot")
- First time chat_id ashle DB te user create hobe (points=0)
- Big "Watch Ad & Earn" button
- Live balance display + earned points per ad (admin er set kora value)
- Monetag SDK load: `<script src='//libtl.com/sdk.js' data-zone='9518673' data-sdk='show_9518673'>` — zone id admin panel theke dynamic
- Button click → `show_9518673()` call → ad complete hole server function call kore point add (server side validate kore double-click/spam rokhbe — minimum 30s gap)
- Bottom nav: Earn | Withdraw | History | Referral link (optional)
- Telegram WebApp SDK (`telegram-web-app.js`) — theme color, haptic feedback, close button

### Withdraw (`/withdraw`)

- Available methods admin panel theke (bKash, Nagad, Binance Pay, USDT-BEP20 etc.)
- Form: method select + account number/wallet + amount
- Min withdraw amount admin controlled
- Submit → DB te `pending` status e save → admin approve korle status update

### Admin Panel (`/admin`)

- Simple password login (76737) — session localStorage e store
- Password admin panel theke change kora jabe

**Dashboard tabs:**

1. **Settings**
   - Monetag SDK zone id (default: `show_9518673`)
   - Monetag data-zone (default: `9518673`)
   - Admin Telegram chat id (notifications jaby ekhane)
   - Bot token (optional — withdraw approve hole user ke notify korar jonno)
   - Points per ad watch
   - Min withdraw amount
   - Admin password

2. **Withdraw Methods** — add/edit/delete methods (name, icon, min amount, instructions)

3. **Withdraw Requests** — pending list, approve/reject button (approve hole user balance theke deduct + bot notify)

4. **Users** — list, search by chat_id, manual point adjust, ban

### Database (Lovable Cloud)

```
users           (chat_id PK, points, total_earned, banned, created_at)
ad_watches      (id, chat_id, points, watched_at) — anti-fraud log
withdraw_requests (id, chat_id, method, account, amount, status, created_at, processed_at)
withdraw_methods (id, name, icon, min_amount, instructions, enabled)
settings         (key PK, value) — single key-value table for all admin settings
```

RLS: Public read disabled. Shob mutation server functions diye hobe (chat_id verify + rate limit).

### Server Functions

- `getUser(chatId)` — auto-create if not exists, return balance + settings
- `claimAdReward(chatId, nonce)` — server-side cooldown check (min 30s), add points
- `submitWithdraw(chatId, method, account, amount)` — validate balance, create request, notify admin via bot
- `adminLogin(password)` — returns session token
- `adminUpdateSettings`, `adminListWithdraws`, `adminApproveWithdraw`, `adminListUsers` etc. — all check admin session

### Anti-Fraud

- Server side ad watch validation (timestamp gap minimum 30s between claims)
- 1 chat_id e daily max ad limit (admin configurable)
- Withdraw amount ≤ balance check server side

### Defaults (admin pore change korte parbe)

- Points per ad: 10
- Min withdraw: 1000 points
- Daily ad limit: 100
- Withdraw methods: bKash, Nagad, Binance Pay (USDT)

### Tech

- Lovable Cloud (Postgres + RLS + server functions)
- TanStack Start routes
- Tailwind + shadcn UI (dark theme, Telegram-style)
- Monetag SDK loaded dynamically with admin-set zone id
- Telegram WebApp JS for native feel

### User Flow

```
Telegram bot button "Open App"
   ↓
https://app.com/?id=123456789
   ↓
Auto-register user → show balance
   ↓
Click "Watch Ad" → Monetag ad → +10 points
   ↓
Go to Withdraw → submit request → admin notified
   ↓
Admin approves → bot sends confirmation message
```

Next step: Lovable Cloud enable korbo, database schema banabo, tarpor mini app + admin panel build korbo. Approve korle shuru kori.