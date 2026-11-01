// Login do jogo.
// - Com Supabase configurado (js/config.js): conta de verdade com e-mail e senha, e o perfil
//   (nomes, configurações e estatísticas) fica salvo na nuvem, protegido por RLS.
// - Sem Supabase: conta local com usuário e senha, guardada só neste aparelho (hash PBKDF2).
import { store } from './util.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');

async function hash(pass, saltHex) {
  if (!crypto?.subtle) { let h = 0; for (const ch of saltHex + pass) h = (h * 31 + ch.charCodeAt(0)) | 0; return 'x' + h; }
  const key = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveBits']);
  const salt = new Uint8Array(saltHex.match(/../g).map(h => parseInt(h, 16)));
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 120000, hash: 'SHA-256' }, key, 256);
  return hex(bits);
}

function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.append(s); });
}

const MSG = {
  'Invalid login credentials': 'E-mail ou senha incorretos.',
  'Email not confirmed': 'Confirme seu e-mail pelo link que enviamos antes de entrar.',
  'User already registered': 'Esse e-mail já tem conta. Tente entrar.',
};
const msg = e => MSG[e?.message] ?? e?.message ?? 'Algo deu errado. Tente de novo.';

export const auth = {
  cloud: Boolean(SUPABASE_URL && SUPABASE_ANON_KEY),
  sb: null,
  session: null,

  async init() {
    if (!this.cloud) return;
    try {
      await loadScript('vendor/supabase/supabase.js');
      this.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
      });
      this.session = (await this.sb.auth.getSession()).data.session;
      this.sb.auth.onAuthStateChange((_e, s) => { this.session = s; });
    } catch { this.cloud = false; } // sem internet: cai para a conta local
  },

  // ---------------------------------------------------------------- estado
  hasAccount() { return this.cloud ? true : !!store.get('conta', null); },
  user() { return this.cloud ? this.session?.user?.email ?? '' : store.get('conta', null)?.usuario ?? ''; },
  isLogged() {
    if (this.cloud) return !!this.session;
    if (!store.get('conta', null)) return true; // sem conta criada: acesso livre
    try { if (sessionStorage.getItem('nad:sessao') === '1') return true; } catch {}
    return store.get('lembrar', false);
  },

  // ---------------------------------------------------------------- ações (devolvem '' ou a mensagem de erro)
  async create(usuario, senha) {
    if (this.cloud) {
      const { data, error } = await this.sb.auth.signUp({ email: usuario.trim(), password: senha,
        options: { emailRedirectTo: location.origin + location.pathname } });
      if (error) return msg(error);
      this.session = data.session;
      return data.session ? '' : 'Conta criada! Confirme pelo link que enviamos para o seu e-mail e depois entre.';
    }
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
    store.set('conta', { usuario: usuario.trim(), salt, hash: await hash(senha, salt) });
    this._session();
    return '';
  },

  async login(usuario, senha, lembrar) {
    if (this.cloud) {
      const { data, error } = await this.sb.auth.signInWithPassword({ email: usuario.trim(), password: senha });
      if (error) return msg(error);
      this.session = data.session;
      return '';
    }
    const a = store.get('conta', null);
    if (!a || a.usuario.toLowerCase() !== usuario.trim().toLowerCase() || (await hash(senha, a.salt)) !== a.hash)
      return 'Usuário ou senha incorretos.';
    store.set('lembrar', !!lembrar);
    this._session();
    return '';
  },

  async reset(email) {
    if (!this.cloud) return 'Na conta local não há como recuperar a senha. Use "Apagar conta deste aparelho".';
    const { error } = await this.sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: location.origin + location.pathname });
    return error ? msg(error) : 'Enviamos um link para redefinir a senha no seu e-mail.';
  },

  async changePassword(atual, nova) {
    if (this.cloud) {
      const { error } = await this.sb.auth.updateUser({ password: nova });
      return error ? msg(error) : '';
    }
    const a = store.get('conta', null);
    if (!a || (await hash(atual, a.salt)) !== a.hash) return 'Senha atual incorreta.';
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
    store.set('conta', { ...a, salt, hash: await hash(nova, salt) });
    return '';
  },

  async logout() {
    if (this.cloud) { await this.sb.auth.signOut(); this.session = null; return; }
    store.set('lembrar', false);
    try { sessionStorage.removeItem('nad:sessao'); } catch {}
  },

  removeLocal() { store.del('conta'); store.del('lembrar'); },

  // ---------------------------------------------------------------- perfil na nuvem
  async loadProfile() {
    if (!this.cloud || !this.session) return null;
    const { data } = await this.sb.from('perfis').select('*').eq('id', this.session.user.id).maybeSingle();
    return data;
  },
  async saveProfile(patch) {
    if (!this.cloud || !this.session) return;
    await this.sb.from('perfis').upsert({ id: this.session.user.id, ...patch });
  },

  _session() { try { sessionStorage.setItem('nad:sessao', '1'); } catch {} },
};
