# Auth Flow Blueprint — Stock Intelligence SaaS

**Phiên bản:** v1.0  
**Góc nhìn:** Senior Software Engineer (10+ năm kinh nghiệm)  
**Mục tiêu:** Thiết kế authentication & authorization flow production-ready cho Stock Intelligence SaaS, bao gồm JWT lifecycle, refresh token rotation, RBAC, API key management và session security.

---

# 1. Auth Architecture Overview

```text
┌──────────────────────────────────────────────────────────┐
│                      API Gateway                         │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │ JWT Verify  │  │ API Key Auth │  │ Rate Limiter     │ │
│  └──────┬─────┘  └──────┬───────┘  └────────┬─────────┘ │
└─────────┼───────────────┼────────────────────┼───────────┘
          │               │                    │
     ┌────▼────┐     ┌────▼────┐          ┌────▼────┐
     │ /me/*   │     │ /dev/*  │          │ /public │
     │ User API│     │ Dev API │          │ No auth │
     └─────────┘     └─────────┘          └─────────┘
```

---

# 2. Auth Methods

| API Surface | Auth Method | Token Location |
|---|---|---|
| `/api/v1/public/*` | None | — |
| `/api/v1/me/*` | JWT Bearer | `Authorization: Bearer <token>` |
| `/api/v1/dev/*` | API Key | `X-API-Key: <key>` |

---

# 3. JWT Token Design

## Access Token

```ts
type AccessTokenPayload = {
  sub: string;              // user UUID
  email: string;
  tier: "FREE" | "PRO" | "API";
  roles: string[];
  iat: number;              // issued at
  exp: number;              // expires at
};
```

### Specifications

| Property | Value |
|---|---|
| Algorithm | RS256 |
| Expiry | 15 minutes |
| Storage (client) | Memory only (not localStorage) |
| Refresh | Via refresh token |
| Revocation | Short TTL + blacklist for emergencies |

---

## Refresh Token

```ts
type RefreshToken = {
  tokenId: string;          // UUID
  userId: string;           // user UUID
  familyId: string;         // rotation family
  expiresAt: string;        // ISO8601
  createdAt: string;
};
```

### Specifications

| Property | Value |
|---|---|
| Expiry | 7 days |
| Storage (client) | HttpOnly, Secure, SameSite=Strict cookie |
| Storage (server) | PostgreSQL `refresh_tokens` table |
| Rotation | Yes — new refresh token on each use |
| Family tracking | Yes — detect reuse attacks |

---

# 4. Authentication Flows

## 4.1 Registration

```text
Client                    Auth Service              Database
  │                           │                        │
  │──POST /auth/register────►│                        │
  │  {email, password}        │                        │
  │                           │──validate input───────►│
  │                           │──check duplicate──────►│
  │                           │──hash password────────►│
  │                           │──create user──────────►│
  │                           │──create subscription──►│ (FREE tier)
  │                           │──generate tokens──────►│
  │◄──{accessToken}───────────│                        │
  │◄──Set-Cookie: refreshToken│                        │
  │                           │──publish user.created─►│ (event bus)
```

## 4.2 Login

```text
Client                    Auth Service              Database
  │                           │                        │
  │──POST /auth/login────────►│                        │
  │  {email, password}        │                        │
  │                           │──find user─────────────►│
  │                           │──verify password───────►│
  │                           │──generate tokens───────►│
  │                           │──store refresh token───►│
  │◄──{accessToken}───────────│                        │
  │◄──Set-Cookie: refreshToken│                        │
```

## 4.3 Token Refresh (with Rotation)

```text
Client                    Auth Service              Database
  │                           │                        │
  │──POST /auth/refresh──────►│                        │
  │  Cookie: refreshToken     │                        │
  │                           │──find token────────────►│
  │                           │──check expiry──────────►│
  │                           │──check family──────────►│
  │                           │──revoke old token──────►│
  │                           │──generate new pair─────►│
  │                           │──store new refresh─────►│
  │◄──{accessToken}───────────│                        │
  │◄──Set-Cookie: newRefresh  │                        │
```

### Refresh Token Reuse Detection

```text
IF refresh token is already used:
  → Token reuse detected (theft attempt)
  → Revoke ALL tokens in the family
  → Force user to re-login
  → Log security event
```

## 4.4 Logout

```text
Client                    Auth Service              Database
  │                           │                        │
  │──POST /auth/logout───────►│                        │
  │  Cookie: refreshToken     │                        │
  │                           │──revoke refresh token──►│
  │                           │──blacklist access token►│ (Redis, TTL = remaining exp)
  │◄──Clear-Cookie────────────│                        │
```

---

# 5. API Key Management

## Key Generation

```text
Client                    Auth Service              Database
  │                           │                        │
  │──POST /me/api-keys───────►│                        │
  │  (JWT auth required)      │                        │
  │                           │──check tier (PRO/API)──►│
  │                           │──generate key───────────│
  │                           │──hash key──────────────►│ (store hash only)
  │◄──{apiKey: "sk_live_..."}─│                        │
  │  (shown once, never again)│                        │
```

## Key Format

```text
sk_live_<32 random hex chars>
sk_test_<32 random hex chars>
```

## Key Verification Flow

```text
Request with X-API-Key ──► Hash key ──► Lookup in DB ──► Check status ──► Allow/Deny
                                                         └─► Check quota
                                                         └─► Rate limit
```

---

# 6. RBAC (Role-Based Access Control)

## Roles

| Role | Description |
|---|---|
| `USER` | Standard registered user |
| `PRO` | Premium subscriber |
| `API_USER` | API access customer |
| `ADMIN` | Platform administrator |

## Permission Matrix

| Resource | `USER` | `PRO` | `API_USER` | `ADMIN` |
|---|---|---|---|---|
| Public market data | ✅ | ✅ | ✅ | ✅ |
| Delayed quotes | ✅ | ✅ | ✅ | ✅ |
| Realtime quotes | ❌ | ✅ | ✅ | ✅ |
| Watchlists (max 3) | ✅ | — | — | ✅ |
| Watchlists (unlimited) | ❌ | ✅ | — | ✅ |
| Signals & scores | Basic | Full | Full | ✅ |
| AI Summary | ❌ | ✅ | ✅ | ✅ |
| Screener | ❌ | ✅ | — | ✅ |
| Portfolio insights | ❌ | ✅ | — | ✅ |
| API access | ❌ | ❌ | ✅ | ✅ |
| Admin panel | ❌ | ❌ | ❌ | ✅ |

## Guard Implementation

```typescript
// NestJS guard pattern
@UseGuards(JwtAuthGuard, TierGuard)
@RequireTier('PRO')
@Get('ai-summary')
async getAISummary(@Param('symbol') symbol: string) { ... }
```

---

# 7. Security Rules

## Password

- Minimum 8 characters
- Bcrypt hash (cost factor 12)
- No password in logs/responses

## Tokens

- Access token: memory only, never localStorage
- Refresh token: HttpOnly cookie only
- API key: shown once at creation, stored as hash
- All tokens have expiry

## Rate Limiting

| Endpoint | Limit |
|---|---|
| `/auth/login` | 5 per minute per IP |
| `/auth/register` | 3 per minute per IP |
| `/auth/refresh` | 10 per minute per user |
| `/me/*` | 100 per minute per user |
| `/dev/*` | Based on tier quota |

## Headers

```text
X-Request-Id: <uuid>              # Correlation ID (always)
X-RateLimit-Limit: 100            # Max requests
X-RateLimit-Remaining: 95         # Remaining
X-RateLimit-Reset: 1619459134     # Reset timestamp
```

---

# 8. Database Schema (Auth-specific)

```prisma
model User {
  id            String         @id @default(uuid())
  email         String         @unique
  passwordHash  String         @map("password_hash")
  status        UserStatus     @default(ACTIVE)
  createdAt     DateTime       @default(now()) @map("created_at")
  updatedAt     DateTime       @updatedAt @map("updated_at")

  refreshTokens RefreshToken[]
  apiKeys       ApiKey[]
  subscription  Subscription?

  @@map("users")
}

model RefreshToken {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  familyId  String   @map("family_id")
  tokenHash String   @unique @map("token_hash")
  used      Boolean  @default(false)
  expiresAt DateTime @map("expires_at")
  createdAt DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([familyId])
  @@map("refresh_tokens")
}
```

---

# 9. Auth Events

| Event | Trigger |
|---|---|
| `user.created` | Registration |
| `user.updated` | Profile change |
| `user.login` | Successful login |
| `user.login.failed` | Failed login attempt |
| `token.refreshed` | Token refresh |
| `token.reuse.detected` | Potential theft |
| `api_key.created` | API key generated |
| `api_key.revoked` | API key revoked |

---

# 10. Final Thesis

Auth phải:

1. **Stateless verification** — JWT verify không hit DB
2. **Secure by default** — HttpOnly cookies, short TTL
3. **Detect theft** — Refresh token rotation + family tracking
4. **Support monetization** — Tier-based access built-in
5. **Audit everything** — Every auth event logged
6. **Never leak** — No tokens in URLs, logs, or error responses
