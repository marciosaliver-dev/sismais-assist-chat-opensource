DELETE FROM human_agents WHERE id = '20afc552-e8da-4c58-9c5d-1ed575576042';
ALTER TABLE human_agents ADD CONSTRAINT human_agents_user_id_unique UNIQUE (user_id);