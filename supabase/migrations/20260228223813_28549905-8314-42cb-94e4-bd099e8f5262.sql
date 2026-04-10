-- Fase 1: Desativar test_mode em todas as instâncias produtivas
UPDATE uazapi_instances SET test_mode = false WHERE instance_name IN ('Financeiro', 'Márcio Saraiva');