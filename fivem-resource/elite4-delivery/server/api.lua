Elite4Api = {}

function Elite4Api.fetchPending(callback)
  PerformHttpRequest(Config.ApiBaseUrl .. '/fivem-pending', function(statusCode, response)
    if statusCode ~= 200 then
      print('[elite4-delivery] Falha ao buscar entregas: ' .. tostring(statusCode))
      callback({})
      return
    end

    local data = json.decode(response)
    callback(data and data.deliveries or {})
  end, 'GET', '', {
    ['Content-Type'] = 'application/json',
    ['x-api-key'] = Config.ApiKey
  })
end

function Elite4Api.markDelivery(deliveryId, status, errorMessage, callback)
  local payload = json.encode({
    deliveryId = deliveryId,
    status = status,
    errorMessage = errorMessage
  })

  PerformHttpRequest(Config.ApiBaseUrl .. '/fivem-deliver', function(statusCode, response)
    if callback then callback(statusCode, response) end
  end, 'POST', payload, {
    ['Content-Type'] = 'application/json',
    ['x-api-key'] = Config.ApiKey
  })
end
