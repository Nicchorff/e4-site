fx_version 'cerulean'
game 'gta5'

author 'Elite Four'
description 'Entrega automática de compras da loja E4 (Stripe + Supabase)'
version '1.0.0'

server_scripts {
  'config.lua',
  'server/api.lua',
  'server/main.lua'
}
