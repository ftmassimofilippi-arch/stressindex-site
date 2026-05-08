export interface FormErrors {
  nome?: string
  cognome?: string
  email?: string
  password?: string
  confermaPassword?: string
  professione?: string
  general?: string
}

export function validateRegistrationForm(data: {
  nome: string
  cognome: string
  email: string
  password: string
  confermaPassword: string
  professione: string
}): FormErrors {
  const errors: FormErrors = {}

  // Nome
  if (!data.nome.trim()) {
    errors.nome = 'Il nome è obbligatorio'
  } else if (data.nome.trim().length < 2) {
    errors.nome = 'Il nome deve avere almeno 2 caratteri'
  }

  // Cognome
  if (!data.cognome.trim()) {
    errors.cognome = 'Il cognome è obbligatorio'
  } else if (data.cognome.trim().length < 2) {
    errors.cognome = 'Il cognome deve avere almeno 2 caratteri'
  }

  // Email
  if (!data.email.trim()) {
    errors.email = "L'email è obbligatoria"
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = 'Inserisci un indirizzo email valido'
  }

  // Password
  if (!data.password) {
    errors.password = 'La password è obbligatoria'
  } else if (data.password.length < 8) {
    errors.password = 'La password deve avere almeno 8 caratteri'
  }

  // Conferma password
  if (!data.confermaPassword) {
    errors.confermaPassword = 'Conferma la password'
  } else if (data.password !== data.confermaPassword) {
    errors.confermaPassword = 'Le password non corrispondono'
  }

  // Professione
  if (!data.professione) {
    errors.professione = 'Seleziona la tua professione'
  }

  return errors
}

export function hasErrors(errors: FormErrors): boolean {
  return Object.keys(errors).length > 0
}
