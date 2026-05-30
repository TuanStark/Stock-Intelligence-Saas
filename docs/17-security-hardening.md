# Security Hardening Blueprint — Stock Intelligence SaaS

**Phiên bản:** v1.0  
**Góc nhìn:** Senior Software Engineer (10+ năm kinh nghiệm)  
**Mục tiêu:** Thiết kế security hardening strategy cho Stock Intelligence SaaS, bao gồm input validation, injection prevention, CORS configuration, rate limiting, secrets management, và security headers.

---

# 1. Security Principles

1. **Defense in Depth** — Nhiều lớp bảo vệ, không phụ thuộc 1 lớp.
2. **Validate Everything** — Mọi input từ client đều nguy hiểm.
3. **Least Privilege** — Chỉ cấp quyền tối thiểu cần thiết.
4. **Fail Secure** — Khi lỗi xảy ra, deny access (không default allow).
5. **No Security by Obscurity** — Không dựa vào việc "hacker không biết".
6. **Audit Trail** — Mọi action nhạy cảm phải có log.

---

# 2. Input Validation

## Zod Validation (Runtime)

Mọi API input phải validate bằng Zod TRƯỚC khi xử lý:

```typescript
// DTO with Zod validation
const CreateWatchlistSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name too long')
    .trim()
    .refine(
      (val) => !/<|>|script/i.test(val),
      'Invalid characters',
    ),
});

// NestJS integration
export class CreateWatchlistDto extends createZodDto(CreateWatchlistSchema) {}
```

## Validation Rules

| Input Type | Validation |
|---|---|
| String | Max length, trim, sanitize HTML |
| Email | Format validation, normalize |
| Number | Range check, integer/float |
| UUID | Format validation |
| URL | Protocol whitelist (https only) |
| Date | ISO8601 format, range check |
| Enum | Strict allowed values |
| Array | Max length, item validation |
| Object | Known keys only, nested validation |

---

# 3. Injection Prevention

## SQL Injection

```typescript
// ✅ SAFE: Prisma ORM (parameterized by default)
const user = await prisma.user.findUnique({
  where: { email: input.email },
});

// ✅ SAFE: Parameterized raw query
const result = await prisma.$queryRaw`
  SELECT * FROM instruments WHERE symbol = ${input.symbol}
`;

// ❌ DANGEROUS: String concatenation
const result = await prisma.$queryRawUnsafe(
  `SELECT * FROM instruments WHERE symbol = '${input.symbol}'`
);
```

### Rules

1. Never use `$queryRawUnsafe` with user input
2. Prisma handles parameterization automatically
3. For raw SQL, always use template literals (`$queryRaw`)

## XSS Prevention

```typescript
// Server-side: sanitize HTML in user content
import DOMPurify from 'isomorphic-dompurify';

function sanitizeInput(input: string): string {
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] }); // Strip all HTML
}

// Client-side: React auto-escapes by default
// ✅ SAFE: React JSX auto-escapes
<p>{userInput}</p>

// ❌ DANGEROUS: dangerouslySetInnerHTML
<div dangerouslySetInnerHTML={{ __html: userInput }} />
```

## NoSQL Injection (if using NoSQL for search)

```typescript
// ✅ SAFE: Validate input type strictly
const query = z.string().max(100).parse(input.q);
```

---

# 4. HTTP Security Headers

```typescript
// NestJS middleware using helmet
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // For Tailwind
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", process.env.API_URL],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  noSniff: true,
  frameguard: { action: 'deny' },
}));
```

## Headers Summary

| Header | Value | Purpose |
|---|---|---|
| `Content-Security-Policy` | Strict directives | Prevent XSS, injection |
| `Strict-Transport-Security` | `max-age=31536000` | Force HTTPS |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing |
| `X-Frame-Options` | `DENY` | Prevent clickjacking |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limit referrer |
| `X-XSS-Protection` | `0` | Disable (CSP is better) |

---

# 5. CORS Configuration

```typescript
// NestJS CORS
app.enableCors({
  origin: [
    process.env.WEB_URL,     // https://stockintel.com
    process.env.STAGING_URL,  // https://staging.stockintel.com
  ],
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Request-Id',
    'X-API-Key',
  ],
  credentials: true,          // For cookies (refresh token)
  maxAge: 86400,              // Preflight cache: 24 hours
});
```

### Rules

1. Never use `origin: '*'` in production
2. Whitelist specific domains
3. `credentials: true` required for cookie auth
4. Preflight cached to reduce OPTIONS requests

---

# 6. Rate Limiting

```typescript
// NestJS throttler
import { ThrottlerModule } from '@nestjs/throttler';

ThrottlerModule.forRoot([
  {
    name: 'short',
    ttl: 1000,   // 1 second
    limit: 3,    // 3 requests per second
  },
  {
    name: 'medium',
    ttl: 60000,  // 1 minute
    limit: 100,  // 100 requests per minute
  },
  {
    name: 'long',
    ttl: 3600000, // 1 hour
    limit: 1000,  // 1000 requests per hour
  },
]);
```

## Rate Limit by Endpoint

| Endpoint Category | Rate | Strategy |
|---|---|---|
| Auth (login/register) | 5/min per IP | Prevent brute force |
| Public API | 60/min per IP | Prevent abuse |
| User API | 100/min per user | Fair usage |
| Dev API | Tier-based quota | Monetization |
| WebSocket subscribe | 10/min per connection | Prevent spam |

## Response Headers

```text
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1619459134
Retry-After: 30             # Only when rate limited (429)
```

---

# 7. Secrets Management

## Rules

1. **No secrets in code** — Ever.
2. **No secrets in Docker images** — Inject at runtime.
3. **No secrets in git** — Use `.gitignore` + pre-commit hook.
4. **Environment variables** — For runtime secrets.
5. **Kubernetes Secrets** — For production.
6. **Rotation policy** — Regular rotation.

## Secret Types

| Secret | Storage | Rotation |
|---|---|---|
| DB password | K8s Secret | 90 days |
| Redis password | K8s Secret | 90 days |
| JWT signing key (RS256) | K8s Secret | On incident |
| AI provider API keys | K8s Secret | Per provider |
| Market data API keys | K8s Secret | Per provider |
| SMTP credentials | K8s Secret | 180 days |

## `.env.example` (Template Only)

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/stockintel

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Auth
JWT_PRIVATE_KEY=<base64 encoded RS256 private key>
JWT_PUBLIC_KEY=<base64 encoded RS256 public key>

# AI
OPENAI_API_KEY=sk-...
LITELLM_API_BASE=http://localhost:4000

# External
MARKET_DATA_API_KEY=...
```

---

# 8. Dependency Security

```bash
# Regular audit
pnpm audit

# Auto-fix (non-breaking)
pnpm audit --fix

# CI integration
pnpm audit --audit-level=high  # Fail CI on high+ vulnerabilities
```

### Rules

1. Run `pnpm audit` weekly
2. Update dependencies monthly
3. Pin major versions
4. Review changelogs for security patches
5. Use Dependabot / Renovate for auto-PRs

---

# 9. Data Protection

## Encryption at Rest

| Data | Encryption |
|---|---|
| Database | PostgreSQL TDE or disk encryption |
| Redis | Disk encryption |
| Object Storage | S3 SSE-S3 or SSE-KMS |
| Backups | AES-256 |

## Encryption in Transit

| Path | Protocol |
|---|---|
| Client ↔ CDN | TLS 1.3 |
| CDN ↔ API | TLS 1.3 |
| API ↔ Database | TLS |
| API ↔ Redis | TLS |
| Internal services | TLS or mTLS |

## Password Hashing

```typescript
import { hash, compare } from 'bcrypt';

const SALT_ROUNDS = 12;

// Hash password
const passwordHash = await hash(plainPassword, SALT_ROUNDS);

// Verify password
const isValid = await compare(plainPassword, passwordHash);
```

---

# 10. Security Audit Logging

| Event | Log Level | Details |
|---|---|---|
| Login success | `info` | userId, IP, userAgent |
| Login failure | `warn` | email, IP, reason |
| Password change | `info` | userId, IP |
| Token refresh | `info` | userId |
| Token reuse detected | `error` | userId, familyId |
| API key created | `info` | userId, keyPrefix |
| API key revoked | `info` | userId, keyId |
| Admin action | `info` | adminId, action, target |
| Permission denied | `warn` | userId, resource, action |
| Rate limit hit | `warn` | userId/IP, endpoint |

---

# 11. Security Checklist (Pre-Launch)

- [ ] HTTPS everywhere (no HTTP)
- [ ] Security headers configured (CSP, HSTS, etc.)
- [ ] CORS whitelist (no wildcard)
- [ ] Rate limiting enabled
- [ ] Input validation on all endpoints (Zod)
- [ ] SQL injection prevented (Prisma parameterized)
- [ ] XSS prevented (React + CSP)
- [ ] CSRF protection (SameSite cookies)
- [ ] Passwords hashed (bcrypt, cost 12)
- [ ] JWT with short TTL (15 min)
- [ ] Refresh token rotation enabled
- [ ] Sensitive data redacted in logs
- [ ] Dependencies audited
- [ ] Secrets not in code/git
- [ ] Error messages don't leak internals
- [ ] Admin endpoints protected
- [ ] Audit logging enabled
- [ ] Backup encryption enabled
- [ ] Penetration test scheduled

---

# 12. Final Thesis

Security không phải feature. Security là thuộc tính của hệ thống.

1. **Validate at the edge** — Mọi input nguy hiểm
2. **Encrypt everything** — At rest, in transit
3. **Least privilege** — Chỉ access cần thiết
4. **Audit everything** — Mọi action nhạy cảm
5. **Update regularly** — Dependencies, secrets
6. **Assume breach** — Design for detection, not just prevention
