import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useThemeStore } from '@/stores/theme'

const DOCS_URLS: Record<string, string> = {
  sv: 'https://docs.heads.com/broadcaster/',
  en: 'https://docs.heads.com/broadcaster/e'
}

export function docsUrl(lang: string): string {
  return DOCS_URLS[lang] ?? DOCS_URLS.en
}

/** JS to set GitBook's next-themes with repeated application to survive React hydration */
function themeScript(theme: 'light' | 'dark'): string {
  return `(function() {
    var t = "${theme}";
    function apply() {
      localStorage.setItem("theme", t);
      document.documentElement.classList.remove("light", "dark");
      document.documentElement.classList.add(t);
      document.documentElement.style.colorScheme = t;
    }
    apply();
    setTimeout(apply, 0);
    setTimeout(apply, 50);
    setTimeout(apply, 200);
    setTimeout(apply, 500);
  })()`
}

export function DocumentationPage(): JSX.Element {
  const { i18n } = useTranslation()
  const theme = useThemeStore((s) => s.theme)
  const wvRef = useRef<Electron.WebviewTag | null>(null)
  const readyRef = useRef(false)
  const [themeReady, setThemeReady] = useState(false)

  // Set nativeTheme BEFORE rendering the webview
  useEffect(() => {
    window.api.setNativeTheme(theme).then(
      () => new Promise((r) => setTimeout(r, 100))
    ).then(() => setThemeReady(true))

    return () => {
      window.api.setNativeTheme('system')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Attach dom-ready listener via querySelector (webview ref may not work in React)
  useEffect(() => {
    if (!themeReady) return
    const wv = document.querySelector('webview') as Electron.WebviewTag | null
    if (!wv) return
    wvRef.current = wv

    const onReady = (): void => {
      readyRef.current = true
      wv.executeJavaScript(themeScript(useThemeStore.getState().theme)).catch(console.error)
    }
    wv.addEventListener('dom-ready', onReady)
    return () => wv.removeEventListener('dom-ready', onReady)
  }, [themeReady])

  // Forward live theme changes
  useEffect(() => {
    if (!themeReady) return
    window.api.setNativeTheme(theme)
    const wv = wvRef.current
    if (wv && readyRef.current) {
      wv.executeJavaScript(themeScript(theme)).catch(console.error)
    }
  }, [theme, themeReady])

  if (!themeReady) return <div className="flex-1" />

  return (
    <webview
      src={docsUrl(i18n.language)}
      style={{ width: '100%', height: '100%' }}
      // @ts-expect-error -- webview is an Electron-specific element not in React's type defs
      allowpopups="true"
    />
  )
}
