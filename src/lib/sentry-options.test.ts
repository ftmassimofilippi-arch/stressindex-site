import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pulisciEvento, senzaEmail } from './sentry-options.ts'

// A Sentry non devono arrivare email, nomi o query string (regola in
// sentry-options.ts): questo test è la prova che `beforeSend` le toglie.

test('senzaEmail sostituisce ogni indirizzo', () => {
  assert.equal(senzaEmail('utente Mario.Rossi+x@example.co.uk non trovato'), 'utente [email] non trovato')
  assert.equal(senzaEmail('a@b.it, c@d.io'), '[email], [email]')
})

test("dell'utente resta solo l'uuid", () => {
  const out = pulisciEvento({
    type: undefined,
    user: { id: 'aaaaaaaa-0000-0000-0000-000000000001', email: 'mario@example.com', username: 'Mario', ip_address: '1.2.3.4' },
  })
  assert.deepEqual(out.user, { id: 'aaaaaaaa-0000-0000-0000-000000000001' })
})

test('un utente senza id sparisce', () => {
  const out = pulisciEvento({ type: undefined, user: { email: 'mario@example.com' } })
  assert.equal(out.user, undefined)
})

test('della richiesta resta metodo e percorso, senza query, header e cookie', () => {
  const out = pulisciEvento({
    type: undefined,
    request: {
      method: 'GET',
      url: 'https://www.stressindex.io/stampa/misurazione/abc?token=SEGRETO&clientId=1',
      query_string: 'token=SEGRETO',
      headers: { cookie: 'sb-access-token=x', authorization: 'Bearer y' },
      cookies: { a: 'b' },
      data: { nome: 'Mario' },
    },
  })
  assert.deepEqual(out.request, { method: 'GET', url: 'https://www.stressindex.io/stampa/misurazione/abc' })
})

test('messaggi, eccezioni e breadcrumb senza email né query', () => {
  const out = pulisciEvento({
    type: undefined,
    message: 'errore per mario@example.com',
    exception: { values: [{ type: 'Error', value: 'duplicate key (email)=(mario@example.com)' }] },
    breadcrumbs: [
      { message: 'login mario@example.com', data: { url: '/api/x?professionista=uuid', to: '/clienti/1?tab=a#x' } },
    ],
  })
  assert.equal(out.message, 'errore per [email]')
  assert.equal(out.exception?.values?.[0].value, 'duplicate key (email)=([email])')
  assert.equal(out.breadcrumbs?.[0].message, 'login [email]')
  assert.equal(out.breadcrumbs?.[0].data?.url, '/api/x')
  assert.equal(out.breadcrumbs?.[0].data?.to, '/clienti/1')
})
