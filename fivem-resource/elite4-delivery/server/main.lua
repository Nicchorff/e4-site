local function findPlayerByDiscordId(discordId)
  if not discordId or discordId == '' or discordId == 'unknown' then
    return nil
  end

  local needle = 'discord:' .. tostring(discordId)
  for _, playerId in ipairs(GetPlayers()) do
    for _, identifier in ipairs(GetPlayerIdentifiers(playerId)) do
      if identifier == needle then
        return tonumber(playerId)
      end
    end
  end
  return nil
end

-- TODO: implemente a entrega conforme o framework do servidor
function ApplyDelivery(source, payload)
  print(('[elite4-delivery] Entregar para %s: %s'):format(source, json.encode(payload)))

  if payload.type == 'vip' then
    -- ESX/QBCore/vRP: aplicar grupo VIP por payload.tier e payload.duration_days
    return true
  elseif payload.type == 'item' then
    -- Adicionar item payload.item_name quantidade payload.quantity
    return true
  elseif payload.type == 'vehicle' then
    -- Entregar veículo payload.vehicle_model
    return true
  elseif payload.type == 'cosmetic' then
    return true
  end

  return false
end

local function processDeliveries()
  Elite4Api.fetchPending(function(deliveries)
    for _, delivery in ipairs(deliveries) do
      local source = findPlayerByDiscordId(delivery.player_discord_id)

      Elite4Api.markDelivery(delivery.id, 'processing', nil, function() end)

      if not source then
        Elite4Api.markDelivery(
          delivery.id,
          'failed',
          'Jogador offline ou Discord ID não encontrado',
          function() end
        )
      else
        local ok = ApplyDelivery(source, delivery.payload or {})
        if ok then
          Elite4Api.markDelivery(delivery.id, 'delivered', nil, function() end)
        else
          Elite4Api.markDelivery(delivery.id, 'failed', 'Falha ao aplicar entrega', function() end)
        end
      end
    end
  end)
end

CreateThread(function()
  while true do
    processDeliveries()
    Wait(Config.PollInterval)
  end
end)
