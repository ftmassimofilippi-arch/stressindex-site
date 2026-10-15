// Test dello scope dei dati (src/lib/data-scope.ts): un professionista non
// superadmin vede solo i propri dati, qualunque cosa dica il cookie.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isDataScope, puoCambiareScope, risolviScope } from './data-scope.ts'

test('un professionista normale resta su "mine" anche con il cookie a "all"', () => {
  assert.equal(risolviScope({ isSuperadmin: false, cookie: 'all' }), 'mine')
  assert.equal(risolviScope({ isSuperadmin: false, cookie: 'mine' }), 'mine')
  assert.equal(risolviScope({ isSuperadmin: false, cookie: null }), 'mine')
  assert.equal(puoCambiareScope(false), false)
})

test('un superadmin parte da "mine" e passa a "all" solo con il cookie', () => {
  assert.equal(risolviScope({ isSuperadmin: true, cookie: undefined }), 'mine')
  assert.equal(risolviScope({ isSuperadmin: true, cookie: 'qualunque' }), 'mine')
  assert.equal(risolviScope({ isSuperadmin: true, cookie: 'all' }), 'all')
  assert.equal(puoCambiareScope(true), true)
})

test('valori ammessi del cookie', () => {
  assert.equal(isDataScope('all'), true)
  assert.equal(isDataScope('mine'), true)
  assert.equal(isDataScope('tutti'), false)
  assert.equal(isDataScope(null), false)
})
