-- Stores daily specialist analysis results per user
CREATE TABLE IF NOT EXISTS specialist_insights (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date        DATE NOT NULL,
  specialist  TEXT NOT NULL,  -- psychology | sleep | nutrition | physical | goals | finance | spirituality | philosophy
  patterns    TEXT[] NOT NULL DEFAULT '{}',
  concerns    TEXT[] NOT NULL DEFAULT '{}',
  strengths   TEXT[] NOT NULL DEFAULT '{}',
  summary     TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date, specialist)
);

CREATE INDEX IF NOT EXISTS specialist_insights_user_date ON specialist_insights(user_id, date DESC);

-- RLS: users can only read their own insights
ALTER TABLE specialist_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own specialist insights"
  ON specialist_insights FOR SELECT
  USING (auth.uid() = user_id);
