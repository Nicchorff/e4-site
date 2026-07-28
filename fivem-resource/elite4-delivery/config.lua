Config = {}

-- Base das Edge Functions Supabase (sem barra no final)
Config.ApiBaseUrl = 'https://dppyamtmjzmmkzjlmiew.supabase.co/functions/v1'

-- Mesma chave em FIVEM_API_KEY (Supabase Edge Function secrets)
Config.ApiKey = 'change-me-to-a-long-random-secret'

-- Polling em ms
Config.PollInterval = 30000

-- TODO: adapte para o framework do servidor (ESX/QBCore/vRP)
Config.Framework = 'standalone'
