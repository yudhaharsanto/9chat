-- Add thinking column to messages table
-- This stores the thinking/reasoning content from AI models that support it

ALTER TABLE messages ADD COLUMN IF NOT EXISTS thinking TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS response_time_ms INTEGER;

-- Add index for faster queries on thinking content
CREATE INDEX IF NOT EXISTS idx_messages_thinking ON messages(thinking) WHERE thinking IS NOT NULL;

-- Update the messages table comment
COMMENT ON COLUMN messages.thinking IS 'Stores thinking/reasoning content from AI models (e.g., DeepSeek R1, Claude extended thinking, etc.)';
COMMENT ON COLUMN messages.response_time_ms IS 'Total response time in milliseconds from request to completion';
