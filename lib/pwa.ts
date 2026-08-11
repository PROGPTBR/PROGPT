/**
 * Detecção de "estou rodando como app instalado (PWA)?" vs "sou uma aba do
 * navegador".
 *
 * O `/` é a landing pública — no celular, abrir o site no navegador deve
 * mostrar a landing, não a tela de login. Já quem instalou o PWA e tocou no
 * ícone quer entrar no app direto. Esta função é o único ponto que separa os
 * dois casos.
 *
 * Cobre os três sinais que existem na prática:
 *  - `display-mode: standalone|fullscreen|minimal-ui` — Android/Chrome e
 *    iOS 16.4+ (o manifest declara `standalone`, mas o usuário pode ter o
 *    app em outro modo)
 *  - `navigator.standalone` — Safari iOS legado (Add to Home Screen), que
 *    não implementava a media query
 *  - referrer `android-app://` — TWA / atalho aberto pelo WebView do Android
 *
 * SSR-safe: sem `window`, retorna false (renderiza a landing).
 */
export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;

  const modes = ['standalone', 'fullscreen', 'minimal-ui'];
  if (typeof window.matchMedia === 'function') {
    for (const mode of modes) {
      try {
        if (window.matchMedia(`(display-mode: ${mode})`).matches) return true;
      } catch {
        // matchMedia com query não suportada pode lançar em browsers antigos.
      }
    }
  }

  const iosStandalone = (
    window.navigator as Navigator & { standalone?: boolean }
  ).standalone;
  if (iosStandalone === true) return true;

  if (
    typeof document !== 'undefined' &&
    typeof document.referrer === 'string' &&
    document.referrer.startsWith('android-app://')
  ) {
    return true;
  }

  return false;
}
