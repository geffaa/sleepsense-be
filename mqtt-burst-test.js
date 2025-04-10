// mqtt-burst-test.js
const mqtt = require('mqtt');
const client = mqtt.connect('mqtt://localhost:1883');

const deviceId = 'SS-2025-X1-28934';
const totalMessages = 100;
const interval = 1000; // 1 detik

let count = 0;

client.on('connect', () => {
  console.log('Terhubung ke MQTT broker');
  
  // Interval untuk mengirim data
  const intervalId = setInterval(() => {
    // Data finger sensor
    const fingerData = {
      data: [
        {
          timestamp: new Date().toISOString(),
          spo2: 95 + Math.floor(Math.random() * 5),
          bpm: 70 + Math.floor(Math.random() * 15)
        }
      ],
      battery_level: 85,
      timestamp: new Date().toISOString()
    };
    
    client.publish(`sleepsense/device/${deviceId}/finger`, JSON.stringify(fingerData));
    
    // Data belt sensor
    const beltData = {
      data: [
        {
          timestamp: new Date().toISOString(),
          ecg: 1.2 + (Math.random() * 0.4 - 0.2),
          piezoelectric_voltage: 2.5 + (Math.random() * 0.6 - 0.3),
          rcwl_amplitude: 115 + Math.floor(Math.random() * 15)
        }
      ],
      battery_level: 82,
      timestamp: new Date().toISOString()
    };
    
    client.publish(`sleepsense/device/${deviceId}/belt`, JSON.stringify(beltData));
    
    count++;
    console.log(`Pesan #${count} dikirim`);
    
    if (count >= totalMessages) {
      clearInterval(intervalId);
      client.end();
      console.log('Test burst selesai');
    }
  }, interval);
});

client.on('error', (err) => {
  console.error('Error MQTT:', err);
});