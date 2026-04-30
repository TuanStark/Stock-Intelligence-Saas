Project StockIntelligenceSaaS {
  database_type: "PostgreSQL"
  Note: "Stock Intelligence SaaS - Production-ready DB Blueprint v1"
}

Enum user_status {
  ACTIVE
  SUSPENDED
  DELETED
}

Enum subscription_tier {
  FREE
  PRO
  API
}

Enum subscription_status {
  ACTIVE
  CANCELED
  EXPIRED
  TRIALING
}

Enum api_key_status {
  ACTIVE
  REVOKED
}

Enum instrument_status {
  ACTIVE
  HALTED
  DELISTED
}

Enum portfolio_tx_side {
  BUY
  SELL
}

Enum news_sentiment {
  POSITIVE
  NEUTRAL
  NEGATIVE
}

Enum signal_strength {
  LOW
  MEDIUM
  HIGH
}

Enum signal_type {
  RSI_OVERBOUGHT
  RSI_OVERSOLD
  MACD_BULLISH
  MACD_BEARISH
  BREAKOUT
  BREAKDOWN
  VOLUME_SPIKE
}

Enum stock_rating {
  STRONG_BUY
  BUY
  HOLD
  SELL
  STRONG_SELL
}

Enum ai_sentiment {
  BULLISH
  NEUTRAL
  BEARISH
}

Enum alert_status {
  PENDING
  DELIVERED
  FAILED
}

Table users {
  id uuid [pk]
  email varchar(255) [not null, unique]
  password_hash text [not null]
  status user_status [not null, default: 'ACTIVE']
  created_at timestamptz [not null]
  updated_at timestamptz [not null]
}

Table subscriptions {
  id uuid [pk]
  user_id uuid [not null, unique]
  tier subscription_tier [not null, default: 'FREE']
  status subscription_status [not null, default: 'ACTIVE']
  renewal_at timestamptz
  created_at timestamptz [not null]
}

Table api_keys {
  id uuid [pk]
  user_id uuid [not null]
  key_hash text [not null, unique]
  status api_key_status [not null, default: 'ACTIVE']
  last_used_at timestamptz
  created_at timestamptz [not null]

  indexes {
    user_id
  }
}

Table exchanges {
  id uuid [pk]
  code varchar(20) [not null, unique] // HOSE, HNX, NASDAQ
  name varchar(100) [not null]
  market varchar(20) [not null] // VN, US
}

Table sectors {
  id uuid [pk]
  name varchar(100) [not null, unique]
}

Table instruments {
  id uuid [pk]
  symbol varchar(20) [not null]
  name varchar(255) [not null]
  exchange_id uuid [not null]
  sector_id uuid
  industry varchar(150)
  currency varchar(10) [not null]
  isin varchar(20)
  status instrument_status [not null, default: 'ACTIVE']
  tradable boolean [not null, default: true]
  created_at timestamptz [not null]
  updated_at timestamptz [not null]

  indexes {
    (symbol, exchange_id) [unique]
    exchange_id
    sector_id
  }
}

Table watchlists {
  id uuid [pk]
  user_id uuid [not null]
  name varchar(100) [not null]
  created_at timestamptz [not null]

  indexes {
    user_id
  }
}

Table watchlist_items {
  id uuid [pk]
  watchlist_id uuid [not null]
  instrument_id uuid [not null]
  added_at timestamptz [not null]

  indexes {
    (watchlist_id, instrument_id) [unique]
    instrument_id
  }
}

Table portfolios {
  id uuid [pk]
  user_id uuid [not null]
  name varchar(100) [not null]
  base_currency varchar(10) [not null]
  created_at timestamptz [not null]

  indexes {
    user_id
  }
}

Table portfolio_positions {
  id uuid [pk]
  portfolio_id uuid [not null]
  instrument_id uuid [not null]
  quantity numeric(24,8) [not null]
  average_cost numeric(24,8) [not null]
  created_at timestamptz [not null]
  updated_at timestamptz [not null]

  indexes {
    (portfolio_id, instrument_id) [unique]
    instrument_id
  }
}

Table portfolio_transactions {
  id uuid [pk]
  portfolio_id uuid [not null]
  instrument_id uuid [not null]
  side portfolio_tx_side [not null]
  quantity numeric(24,8) [not null]
  price numeric(24,8) [not null]
  fee numeric(24,8) [not null, default: 0]
  executed_at timestamptz [not null]
  created_at timestamptz [not null]

  indexes {
    (portfolio_id, executed_at)
    instrument_id
  }
}

Table news_articles {
  id uuid [pk]
  headline text [not null]
  summary text
  content text
  url text [not null, unique]
  source varchar(100) [not null]
  language varchar(10) [not null]
  sentiment news_sentiment
  relevance_score numeric(10,4)
  published_at timestamptz [not null]
  ingested_at timestamptz [not null]

  indexes {
    published_at
    source
    sentiment
  }
}

Table news_instruments {
  news_id uuid [not null]
  instrument_id uuid [not null]

  indexes {
    (news_id, instrument_id) [pk]
    instrument_id
  }
}

Table signals {
  id uuid [pk]
  instrument_id uuid [not null]
  type signal_type [not null]
  strength signal_strength [not null]
  score numeric(10,4) [not null]
  value numeric(24,8)
  explanation text
  detected_at timestamptz [not null]
  expires_at timestamptz

  indexes {
    (instrument_id, detected_at)
    (type, detected_at)
    expires_at
  }
}

Table stock_scores {
  id uuid [pk]
  instrument_id uuid [not null]
  score numeric(10,4) [not null]
  rating stock_rating [not null]
  technical_score numeric(10,4) [not null]
  fundamentals_score numeric(10,4) [not null]
  momentum_score numeric(10,4) [not null]
  valuation_score numeric(10,4) [not null]
  sentiment_score numeric(10,4) [not null]
  as_of timestamptz [not null]

  indexes {
    (instrument_id, as_of)
  }
}

Table ai_summaries {
  id uuid [pk]
  instrument_id uuid [not null]
  summary text [not null]
  sentiment ai_sentiment [not null]
  confidence numeric(10,4) [not null]
  drivers jsonb [not null]
  risks jsonb [not null]
  model varchar(100) [not null]
  generated_at timestamptz [not null]
  expires_at timestamptz

  indexes {
    (instrument_id, generated_at)
    expires_at
  }
}

Table alert_rules {
  id uuid [pk]
  user_id uuid [not null]
  instrument_id uuid [not null]
  type varchar(50) [not null]
  condition varchar(20) [not null] // >, <, crosses_above...
  threshold numeric(24,8) [not null]
  enabled boolean [not null, default: true]
  created_at timestamptz [not null]

  indexes {
    user_id
    instrument_id
  }
}

Table alert_events {
  id uuid [pk]
  alert_rule_id uuid [not null]
  triggered_value numeric(24,8) [not null]
  triggered_at timestamptz [not null]
  delivered_at timestamptz
  status alert_status [not null, default: 'PENDING']

  indexes {
    (alert_rule_id, triggered_at)
  }
}

Ref: subscriptions.user_id > users.id
Ref: api_keys.user_id > users.id

Ref: instruments.exchange_id > exchanges.id
Ref: instruments.sector_id > sectors.id

Ref: watchlists.user_id > users.id
Ref: watchlist_items.watchlist_id > watchlists.id
Ref: watchlist_items.instrument_id > instruments.id

Ref: portfolios.user_id > users.id
Ref: portfolio_positions.portfolio_id > portfolios.id
Ref: portfolio_positions.instrument_id > instruments.id
Ref: portfolio_transactions.portfolio_id > portfolios.id
Ref: portfolio_transactions.instrument_id > instruments.id

Ref: news_instruments.news_id > news_articles.id
Ref: news_instruments.instrument_id > instruments.id

Ref: signals.instrument_id > instruments.id
Ref: stock_scores.instrument_id > instruments.id
Ref: ai_summaries.instrument_id > instruments.id

Ref: alert_rules.user_id > users.id
Ref: alert_rules.instrument_id > instruments.id
Ref: alert_events.alert_rule_id > alert_rules.id