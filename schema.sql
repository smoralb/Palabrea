-- Tabla rooms
CREATE TABLE IF NOT EXISTS rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'waiting',
  player1_name text NOT NULL,
  player2_name text,
  current_turn text,
  current_word text,
  winner text,
  score_p1 int DEFAULT 0,
  score_p2 int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Tabla moves
CREATE TABLE IF NOT EXISTS moves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES rooms(id) ON DELETE CASCADE,
  player text NOT NULL,
  word text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Tabla player_sessions
CREATE TABLE IF NOT EXISTS player_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_name text NOT NULL,
  room_id uuid REFERENCES rooms(id) ON DELETE CASCADE,
  room_code text NOT NULL,
  player_slot text NOT NULL,
  created_at timestamptz DEFAULT now()
);