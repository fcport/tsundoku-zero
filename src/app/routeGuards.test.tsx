import { Navigate, Outlet } from 'react-router';
import { describe, expect, it } from 'vitest';
import { RedirectIfAuthenticated, RequireAuth } from './routeGuards';
import { LOGIN_PATH, ROOT_PATH } from './routes';

// Righe della I/O Matrix per la DECISIONE del guard (storia 1.8). Le guardie
// sono funzioni PURE prop→elemento senza hook: si invocano DIRETTAMENTE e si
// asserisce tipo e props dell'elemento restituito (bersaglio del redirect +
// `replace`), coprendo meccanicamente AC1 senza jsdom né effetti. Il redirect
// reale nel browser (<Navigate> naviga in useEffect) è verifica live differita.

describe('RequireAuth — il guard delle rotte private', () => {
  it('non autenticato ⇒ Navigate a LOGIN_PATH con replace', () => {
    const el = RequireAuth({ authenticated: false });
    expect(el.type).toBe(Navigate);
    expect(el.props.to).toBe(LOGIN_PATH);
    expect(el.props.to).toBe('/login');
    expect(el.props.replace).toBe(true);
  });

  it('autenticato ⇒ Outlet (rende le rotte figlie protette)', () => {
    const el = RequireAuth({ authenticated: true });
    expect(el.type).toBe(Outlet);
  });
});

describe('RedirectIfAuthenticated — il contraltare della rotta pubblica', () => {
  it('autenticato ⇒ Navigate a ROOT_PATH con replace', () => {
    const el = RedirectIfAuthenticated({ authenticated: true });
    expect(el.type).toBe(Navigate);
    expect(el.props.to).toBe(ROOT_PATH);
    expect(el.props.to).toBe('/');
    expect(el.props.replace).toBe(true);
  });

  it('anonimo ⇒ Outlet (rende la rotta figlia, il form)', () => {
    const el = RedirectIfAuthenticated({ authenticated: false });
    expect(el.type).toBe(Outlet);
  });
});
