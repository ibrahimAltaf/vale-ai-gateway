export function ThemeScript() {
  const source = `(function(){try{var s=localStorage.getItem("vale-theme");var t=s==="light"||s==="dark"?s:"light";document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme="light";}})();`;
  return <script dangerouslySetInnerHTML={{ __html: source }} />;
}
