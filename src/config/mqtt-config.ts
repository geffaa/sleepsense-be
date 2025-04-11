export const mqttConfig = {
    host: process.env.MQTT_HOST || '0.0.0.0',
    port: parseInt(process.env.MQTT_PORT || '1883', 10),
    username: process.env.MQTT_USERNAME || '',
    password: process.env.MQTT_PASSWORD || '',
    clientId: `sleepsense_server_${Math.random().toString(16).substring(2, 10)}`
  };