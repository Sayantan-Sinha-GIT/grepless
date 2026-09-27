// Runs in <head> before first paint: stored choice, else the OS setting.
// Kept out of the 'use client' theme module so the server can inline it.
export const THEME_STORAGE_KEY = 'grepless-theme';
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}var d=document.documentElement;d.setAttribute('data-theme',t);d.style.colorScheme=t}catch(e){}`;
