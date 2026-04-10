-- Cleanup incorrect contact names in chats
UPDATE uazapi_chats SET contact_name = NULL WHERE contact_name = 'Aline- Financeiro Sismais' AND (contact_phone IS NULL OR contact_phone != '557781054718');

-- Cleanup incorrect customer names in conversations
UPDATE ai_conversations SET customer_name = customer_phone WHERE customer_name = 'Aline- Financeiro Sismais';