# WebSocket Protocol Blueprint — Stock Intelligence SaaS

**Phiên bản:** v1.0  
**Góc nhìn:** Senior Software Engineer (10+ năm kinh nghiệm)  
**Mục tiêu:** Thiết kế WebSocket protocol production-ready cho Stock Intelligence SaaS, bao gồm connection lifecycle, message format, subscription management, authentication, reconnection strategy và scalability.

---

# 1. WebSocket Use Cases

| Feature | Data | Update Frequency |
|---|---|---|
| Live quotes | Price, change, volume | 1-15 giây |
| Market status | Open/closed/pre-market | Khi thay đổi |
| Alert notifications | Triggered alerts | Real-time |
| Portfolio PnL | Live PnL updates | 15-30 giây |
| Market overview | Top movers, indices | 5-15 giây |

---

# 2. Protocol Principles

1. **JSON Messages** — Dễ debug, dễ parse.
2. **Subscribe/Unsubscribe** — Client chỉ nhận data cần thiết.
3. **Server-Push Primary** — Hầu hết traffic là server → client.
4. **Heartbeat** — Detect stale connections sớm.
5. **Graceful Reconnect** — Client tự reconnect với backoff.
6. **Auth Required** — Authenticated users only (trừ public quotes).

---

# 3. Connection Lifecycle

```text
Client                              Server
  │                                    │
  │──WS Connect /ws/v1 ──────────────►│
  │  (+ JWT token)                     │
  │                                    │──verify JWT
  │                                    │──check tier
  │◄──connected {sessionId, tier}──────│
  │                                    │
  │──subscribe {channel: "quotes",     │
  │   symbols: ["FPT","VCB"]}────────►│
  │                                    │──validate subscription
  │◄──subscribed {channel, symbols}────│
  │                                    │
  │◄──data {channel: "quotes",        │
  │   payload: Quote}─────────────────│  (server pushes)
  │◄──data {channel: "quotes",        │
  │   payload: Quote}─────────────────│
  │                                    │
  │──ping ────────────────────────────►│
  │◄──pong ────────────────────────────│
  │                                    │
  │──unsubscribe {channel: "quotes"}──►│
  │◄──unsubscribed {channel}───────────│
  │                                    │
  │──close ───────────────────────────►│
  │◄──close ───────────────────────────│
```

---

# 4. Message Format

## Envelope

Mọi WebSocket message tuân theo envelope chuẩn:

```typescript
type WSMessage = {
  type: WSMessageType;
  id?: string;              // Client-generated ID for request tracking
  channel?: string;         // Channel name
  payload?: unknown;        // Message-specific data
  error?: {
    code: string;
    message: string;
  };
  timestamp: string;        // ISO8601 UTC
};

type WSMessageType =
  // Client → Server
  | "subscribe"
  | "unsubscribe"
  | "ping"
  // Server → Client
  | "connected"
  | "subscribed"
  | "unsubscribed"
  | "data"
  | "error"
  | "pong";
```

---

# 5. Channels

## 5.1 `quotes` — Live Quotes

```typescript
// Subscribe
{
  "type": "subscribe",
  "id": "req_001",
  "channel": "quotes",
  "payload": {
    "symbols": ["FPT", "VCB", "HPG"]    // max 50 symbols
  }
}

// Data push
{
  "type": "data",
  "channel": "quotes",
  "payload": {
    "symbol": "FPT",
    "price": "85200",
    "change": "1200",
    "changePercent": "1.43",
    "volume": "5420000",
    "timestamp": "2026-01-15T09:30:15Z"
  },
  "timestamp": "2026-01-15T09:30:15Z"
}
```

### Rules

- FREE tier: delayed 15 minutes, update mỗi 60s
- PRO tier: near-realtime, update mỗi 5-15s
- Max 50 symbols per subscription

---

## 5.2 `market` — Market Overview

```typescript
// Subscribe
{
  "type": "subscribe",
  "id": "req_002",
  "channel": "market"
}

// Data push
{
  "type": "data",
  "channel": "market",
  "payload": {
    "status": "OPEN",
    "indices": [
      { "symbol": "VNINDEX", "price": "1250.5", "change": "12.3", "changePercent": "0.99" }
    ],
    "topGainers": [...],
    "topLosers": [...],
    "topVolume": [...]
  },
  "timestamp": "2026-01-15T09:30:15Z"
}
```

### Rules

- Update mỗi 10-15 giây
- Gửi cho tất cả connected users
- Không cần subscribe symbols cụ thể

---

## 5.3 `alerts` — User Alert Notifications

```typescript
// Subscribe (auto-subscribed on connect for authenticated users)
{
  "type": "subscribe",
  "id": "req_003",
  "channel": "alerts"
}

// Data push
{
  "type": "data",
  "channel": "alerts",
  "payload": {
    "alertId": "uuid",
    "instrumentId": "uuid",
    "symbol": "FPT",
    "type": "PRICE_ABOVE",
    "threshold": "90000",
    "triggeredValue": "90500",
    "message": "FPT đã vượt 90,000 VND",
    "triggeredAt": "2026-01-15T09:30:15Z"
  },
  "timestamp": "2026-01-15T09:30:15Z"
}
```

### Rules

- Per-user channel (private)
- Auth required (PRO tier for advanced alerts)
- Delivered exactly once per trigger

---

## 5.4 `portfolio` — Portfolio PnL Updates

```typescript
// Subscribe
{
  "type": "subscribe",
  "id": "req_004",
  "channel": "portfolio",
  "payload": {
    "portfolioId": "uuid"
  }
}

// Data push
{
  "type": "data",
  "channel": "portfolio",
  "payload": {
    "portfolioId": "uuid",
    "totalValue": "150000000",
    "totalPnl": "5000000",
    "totalPnlPercent": "3.45",
    "positions": [
      {
        "symbol": "FPT",
        "currentPrice": "85200",
        "unrealizedPnl": "3200000",
        "unrealizedPnlPercent": "4.12"
      }
    ]
  },
  "timestamp": "2026-01-15T09:30:15Z"
}
```

### Rules

- Per-user, per-portfolio (private)
- Auth required
- Update mỗi 15-30 giây

---

# 6. Authentication

## Connection Auth

```text
// Option 1: Query parameter (for initial connect)
ws://api.stockintel.com/ws/v1?token=<jwt>

// Option 2: First message auth
{
  "type": "auth",
  "payload": {
    "token": "<jwt>"
  }
}
```

### Flow

```text
1. Client connects with JWT
2. Server verifies JWT
3. Server checks subscription tier → sets permissions
4. Server sends "connected" message with session info
5. If JWT expires during connection:
   a. Server sends "error" with code "TOKEN_EXPIRED"
   b. Client refreshes JWT via REST
   c. Client sends new "auth" message
   d. Server re-authenticates without disconnect
```

---

# 7. Error Handling

```typescript
// Error message format
{
  "type": "error",
  "id": "req_001",           // Links to client request
  "error": {
    "code": "SUBSCRIPTION_LIMIT",
    "message": "Maximum 50 symbols per subscription"
  },
  "timestamp": "2026-01-15T09:30:15Z"
}
```

### Error Codes

| Code | Description | Action |
|---|---|---|
| `AUTH_REQUIRED` | No auth token | Send auth message |
| `TOKEN_EXPIRED` | JWT expired | Refresh + re-auth |
| `FORBIDDEN` | Tier insufficient | Upgrade subscription |
| `SUBSCRIPTION_LIMIT` | Too many symbols | Reduce symbols |
| `CHANNEL_NOT_FOUND` | Invalid channel | Fix channel name |
| `RATE_LIMITED` | Too many messages | Back off |
| `INTERNAL_ERROR` | Server error | Retry later |

---

# 8. Heartbeat / Keep-Alive

```text
Client ──ping──► Server    (every 30 seconds)
Client ◄──pong── Server    (immediate response)

If no pong for 60 seconds:
  Client → close connection → reconnect
  
If no ping for 90 seconds:
  Server → close connection → cleanup subscriptions
```

```typescript
// Ping
{ "type": "ping", "timestamp": "2026-01-15T09:30:15Z" }

// Pong
{ "type": "pong", "timestamp": "2026-01-15T09:30:15Z" }
```

---

# 9. Reconnection Strategy (Client-Side)

```typescript
class WSClient {
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  
  private getReconnectDelay(): number {
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts),
      30_000,
    );
    // Add jitter (±20%)
    return delay + (Math.random() - 0.5) * delay * 0.4;
  }

  private onClose() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = this.getReconnectDelay();
      setTimeout(() => {
        this.reconnectAttempts++;
        this.connect();
      }, delay);
    }
  }

  private onOpen() {
    this.reconnectAttempts = 0;
    // Re-subscribe to previous channels
    this.resubscribeAll();
  }
}
```

### Reconnection Rules

1. Exponential backoff với jitter
2. Re-subscribe tất cả channels trước đó
3. Resume từ last known state
4. Max 10 attempts, sau đó show error UI
5. Reset counter khi connect thành công

---

# 10. Server-Side Architecture (NestJS)

```typescript
// apps/api/src/modules/market-data/market-data.gateway.ts

@WebSocketGateway({
  namespace: '/ws/v1',
  cors: { origin: process.env.CORS_ORIGIN },
})
export class MarketDataGateway implements OnGatewayConnection, OnGatewayDisconnect {
  
  @WebSocketServer()
  server: Server;

  // Track subscriptions
  private subscriptions = new Map<string, Set<string>>(); // socketId → symbols

  async handleConnection(client: Socket) {
    const token = client.handshake.query.token as string;
    const user = await this.authService.verifyToken(token);
    if (!user) {
      client.emit('error', { code: 'AUTH_REQUIRED' });
      client.disconnect();
      return;
    }
    client.data.user = user;
    client.emit('connected', { sessionId: client.id, tier: user.tier });
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(client: Socket, payload: SubscribePayload) {
    // Validate channel, symbols, tier permissions
    // Add to subscription tracking
    // Join socket.io rooms
    for (const symbol of payload.symbols) {
      client.join(`quote:${symbol}`);
    }
    return { event: 'subscribed', data: { channel: payload.channel } };
  }

  // Called by ingestion pipeline when new quotes arrive
  broadcastQuote(symbol: string, quote: Quote) {
    this.server.to(`quote:${symbol}`).emit('data', {
      type: 'data',
      channel: 'quotes',
      payload: quote,
      timestamp: new Date().toISOString(),
    });
  }
}
```

---

# 11. Scalability

## Single Server (Phase 1)

- NestJS WebSocket gateway
- In-memory subscription tracking
- Sufficient for < 1,000 concurrent connections

## Multi-Server (Phase 2+)

```text
                    ┌─────────────┐
                    │ Redis Pub/Sub│
                    │ (adapter)    │
                    └──────┬──────┘
              ┌────────────┼────────────┐
              ▼            ▼            ▼
         ┌────────┐  ┌────────┐  ┌────────┐
         │ WS Pod │  │ WS Pod │  │ WS Pod │
         │   #1   │  │   #2   │  │   #3   │
         └────────┘  └────────┘  └────────┘
```

- Socket.IO Redis adapter cho multi-pod sync
- Sticky sessions (connection affinity)
- Horizontal scaling via Kubernetes

---

# 12. Rate Limiting

| Action | Limit |
|---|---|
| Subscribe messages | 10 per minute per connection |
| Ping messages | 2 per minute |
| Total messages client→server | 30 per minute |

Exceed → error message → disconnect if persist.

---

# 13. Final Thesis

WebSocket protocol tốt:

1. **Predictable** — Message format chuẩn, error codes rõ
2. **Resilient** — Auto-reconnect, re-subscribe
3. **Efficient** — Subscribe only what's needed
4. **Secure** — JWT auth, tier-based access
5. **Scalable** — Redis pub/sub cho multi-pod
6. **Debuggable** — JSON format, timestamps, request IDs
