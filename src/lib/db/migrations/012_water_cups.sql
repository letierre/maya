-- Add water_cups to track daily water intake by cup count (1 cup = 250ml, goal = 4 cups = 1L)
ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS water_cups INTEGER NOT NULL DEFAULT 0;
