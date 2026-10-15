// Test di src/lib/sensor-label.ts (npm test).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sensorLabel, isOpaqueSensorId } from './sensor-label.ts'

const FB = 'Sensore BLE'

test('un nome leggibile resta com è', () => {
  assert.equal(sensorLabel('Polar H10 8A2B3C4D', 'polar_h10', FB), 'Polar H10 8A2B3C4D')
})

test('UUID iOS: si usa il tipo se leggibile', () => {
  assert.equal(sensorLabel('1C2D3E4F-AAAA-BBBB-CCCC-111122223333', 'Polar H10', FB), 'Polar H10')
  assert.equal(sensorLabel('1c2d3e4f-aaaa-bbbb-cccc-111122223333', 'Polar H10', FB), 'Polar H10')
})

test('indirizzo BLE Android: si usa il tipo, altrimenti il ripiego', () => {
  assert.equal(sensorLabel('A0:9E:1A:12:34:56', 'Garmin HRM', FB), 'Garmin HRM')
  assert.equal(sensorLabel('a0:9e:1a:12:34:56', null, FB), FB)
})

test('nome e tipo assenti o opachi: ripiego, mai "Polar H10" inventato', () => {
  assert.equal(sensorLabel(null, null, FB), FB)
  assert.equal(sensorLabel('', '  ', FB), FB)
  assert.equal(sensorLabel('1C2D3E4F-AAAA-BBBB-CCCC-111122223333', 'A0:9E:1A:12:34:56', FB), FB)
})

test('isOpaqueSensorId', () => {
  assert.equal(isOpaqueSensorId('Polar H10'), false)
  assert.equal(isOpaqueSensorId(undefined), true)
  assert.equal(isOpaqueSensorId('12345678-1234-'), true)
})
