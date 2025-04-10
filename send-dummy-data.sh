#!/bin/bash

# Device ID
DEVICE="SS-2025-X1-28934"

# Kirim data sensor jari (pulse oximeter)
mosquitto_pub -h localhost -t "sleepsense/device/$DEVICE/finger" -m '{
  "data": [
    {"timestamp": "'$(date -Iseconds)'", "spo2": 98, "bpm": 75},
    {"timestamp": "'$(date -Iseconds -d "+1 second")'", "spo2": 97, "bpm": 76}
  ],
  "battery_level": 85,
  "timestamp": "'$(date -Iseconds)'"
}'

# Kirim data sensor belt (ECG, thoracic, breathing)
mosquitto_pub -h localhost -t "sleepsense/device/$DEVICE/belt" -m '{
  "data": [
    {"timestamp": "'$(date -Iseconds)'", "ecg": 1.2, "piezoelectric_voltage": 2.5, "rcwl_amplitude": 120},
    {"timestamp": "'$(date -Iseconds -d "+1 second")'", "ecg": 1.3, "piezoelectric_voltage": 2.6, "rcwl_amplitude": 115}
  ],
  "battery_level": 82,
  "timestamp": "'$(date -Iseconds)'"
}'

# Kirim data status perangkat
mosquitto_pub -h localhost -t "sleepsense/device/$DEVICE/status" -m '{
  "battery_level": 84,
  "status": "active",
  "timestamp": "'$(date -Iseconds)'"
}'

echo "Data dummy telah dikirim ke broker MQTT."